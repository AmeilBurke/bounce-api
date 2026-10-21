import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { vi } from 'vitest';
import { BansService } from './bans.service';
import { PrismaService } from '../prisma.service';
import { EventsGateway } from '../events/events.gateway';
import { Prisma, Role } from '../generated/prisma/client';

process.env.SUPABASE_URL = 'https://project.supabase.co';
const DAY = 24 * 60 * 60 * 1000;
const inDays = (days: number) => new Date(Date.now() + days * DAY).toISOString();

// Velvet and Docks are managed by the venue manager in these tests, Neon isn't
const VELVET = 'venue-velvet';
const DOCKS = 'venue-docks';
const NEON = 'venue-neon';

function makeBan(overrides: { isPending?: boolean; venueIds?: string[] } = {}) {
  return {
    id: 'ban-1',
    reason: 'Fighting',
    startDate: new Date(inDays(-1)),
    endDate: new Date(inDays(30)),
    isPending: overrides.isPending ?? false,
    bannedPersonId: 'person-1',
    createdById: 'staff-1',
    bannedPerson: { id: 'person-1', name: 'Blake Turner', imagePath: 'blake.webp' },
    createdBy: { id: 'staff-1', name: 'Morgan Reid' },
    venueBans: (overrides.venueIds ?? [VELVET]).map((venueId) => ({
      venueId,
      banId: 'ban-1',
      venue: { id: venueId, name: venueId },
    })),
  };
}

describe('BansService', () => {
  let service: BansService;
  let prisma: {
    staff: { findUnique: ReturnType<typeof vi.fn> };
    ban: Record<'create' | 'findUnique' | 'findMany' | 'update' | 'delete', ReturnType<typeof vi.fn>>;
  };
  let events: { notifyBansChanged: ReturnType<typeof vi.fn> };

  // The staff member making the request, as getRequester and assertAdmin look them up
  const actAs = (role: Role, managedVenueIds: string[] = []) =>
    prisma.staff.findUnique.mockResolvedValue({
      id: 'staff-1',
      role,
      venueManages: managedVenueIds.map((venueId) => ({ venueId })),
    });

  const newBan = (venueIds: string[], dates: { start?: number; end?: number } = {}) => ({
    reason: 'fighting',
    startDate: dates.start === undefined ? undefined : inDays(dates.start),
    endDate: inDays(dates.end ?? 30),
    bannedPersonId: 'person-1',
    venueIds,
  });

  beforeEach(async () => {
    prisma = {
      staff: { findUnique: vi.fn() },
      ban: {
        create: vi.fn().mockImplementation(({ data }) =>
          makeBan({ isPending: data.isPending, venueIds: data.venueBans.create.map((v: { venueId: string }) => v.venueId) }),
        ),
        findUnique: vi.fn().mockResolvedValue(makeBan()),
        findMany: vi.fn().mockResolvedValue([]),
        update: vi.fn().mockResolvedValue(makeBan()),
        delete: vi.fn().mockResolvedValue(makeBan()),
      },
    };
    events = { notifyBansChanged: vi.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BansService,
        { provide: PrismaService, useValue: prisma },
        { provide: EventsGateway, useValue: events },
      ],
    }).compile();

    service = module.get<BansService>(BansService);
  });

  describe('create', () => {
    it('approves bans from admins straight away', async () => {
      actAs(Role.ADMIN);
      const ban = await service.create(newBan([NEON]), 'staff-1');
      expect(ban.isPending).toBe(false);
      expect(events.notifyBansChanged).toHaveBeenCalled();
    });

    it('approves bans from venue managers at their own venues', async () => {
      actAs(Role.VENUE_MANAGER, [VELVET, DOCKS]);
      const ban = await service.create(newBan([VELVET, DOCKS]), 'staff-1');
      expect(ban.isPending).toBe(false);
    });

    it('stops venue managers banning from venues they do not manage', async () => {
      actAs(Role.VENUE_MANAGER, [VELVET]);
      await expect(service.create(newBan([VELVET, NEON]), 'staff-1')).rejects.toThrow(
        ForbiddenException,
      );
      expect(prisma.ban.create).not.toHaveBeenCalled();
    });

    it.each([Role.DUTY_MANAGER, Role.BOUNCER])('leaves bans from a %s pending', async (role) => {
      actAs(role);
      const ban = await service.create(newBan([NEON]), 'staff-1');
      expect(ban.isPending).toBe(true);
    });

    it('rejects an end date before the start date', async () => {
      actAs(Role.ADMIN);
      await expect(
        service.create(newBan([VELVET], { start: 10, end: 5 }), 'staff-1'),
      ).rejects.toThrow(BadRequestException);
    });

    it('capitalises the reason and turns the image into a storage url', async () => {
      actAs(Role.ADMIN);
      await service.create(newBan([VELVET]), 'staff-1');
      expect(prisma.ban.create.mock.calls[0][0].data.reason).toBe('Fighting');

      const ban = await service.create(newBan([VELVET]), 'staff-1');
      expect(ban.bannedPerson.imagePath).toBe(
        'https://project.supabase.co/storage/v1/object/public/images/people/blake.webp',
      );
    });

    it('reports a missing person or venue as a bad request', async () => {
      actAs(Role.ADMIN);
      prisma.ban.create.mockRejectedValue(
        new Prisma.PrismaClientKnownRequestError('fk', { code: 'P2003', clientVersion: 'test' }),
      );
      await expect(service.create(newBan([VELVET]), 'staff-1')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('refuses staff whose account no longer exists', async () => {
      prisma.staff.findUnique.mockResolvedValue(null);
      await expect(service.create(newBan([VELVET]), 'staff-1')).rejects.toThrow(
        ForbiddenException,
      );
    });
  });

  describe('findPending', () => {
    it('is only for admins', async () => {
      actAs(Role.VENUE_MANAGER, [VELVET]);
      await expect(service.findPending('staff-1')).rejects.toThrow(ForbiddenException);
    });

    it('lists pending bans for admins', async () => {
      actAs(Role.ADMIN);
      prisma.ban.findMany.mockResolvedValue([makeBan({ isPending: true })]);
      const bans = await service.findPending('staff-1');
      expect(bans).toHaveLength(1);
      expect(prisma.ban.findMany.mock.calls[0][0].where).toEqual({ isPending: true });
    });
  });

  describe('approve', () => {
    it('lets a venue manager approve a pending ban at their venue', async () => {
      actAs(Role.VENUE_MANAGER, [VELVET]);
      prisma.ban.findUnique.mockResolvedValue(makeBan({ isPending: true, venueIds: [VELVET] }));
      await service.approve('ban-1', 'staff-1');
      expect(prisma.ban.update.mock.calls[0][0].data).toEqual({ isPending: false });
    });

    it('stops a venue manager approving a ban that covers another venue', async () => {
      actAs(Role.VENUE_MANAGER, [VELVET]);
      prisma.ban.findUnique.mockResolvedValue(makeBan({ isPending: true, venueIds: [VELVET, NEON] }));
      await expect(service.approve('ban-1', 'staff-1')).rejects.toThrow(ForbiddenException);
    });

    it.each([Role.DUTY_MANAGER, Role.BOUNCER])('stops a %s approving bans', async (role) => {
      actAs(role);
      prisma.ban.findUnique.mockResolvedValue(makeBan({ isPending: true }));
      await expect(service.approve('ban-1', 'staff-1')).rejects.toThrow(ForbiddenException);
    });

    it('rejects a ban that is already approved', async () => {
      actAs(Role.ADMIN);
      await expect(service.approve('ban-1', 'staff-1')).rejects.toThrow(BadRequestException);
    });

    it('reports a missing ban as not found', async () => {
      actAs(Role.ADMIN);
      prisma.ban.findUnique.mockResolvedValue(null);
      await expect(service.approve('ban-1', 'staff-1')).rejects.toThrow(NotFoundException);
    });
  });

  describe('update', () => {
    it('needs a venue manager to manage the venues being added as well as the current ones', async () => {
      actAs(Role.VENUE_MANAGER, [VELVET]);
      await expect(
        service.update('ban-1', { venueIds: [VELVET, NEON] }, 'staff-1'),
      ).rejects.toThrow(ForbiddenException);
    });

    it('replaces the venue list when venues are sent', async () => {
      actAs(Role.VENUE_MANAGER, [VELVET, DOCKS]);
      await service.update('ban-1', { venueIds: [DOCKS] }, 'staff-1');
      expect(prisma.ban.update.mock.calls[0][0].data.venueBans).toEqual({
        deleteMany: {},
        create: [{ venueId: DOCKS }],
      });
    });

    it('leaves venues alone when none are sent', async () => {
      actAs(Role.ADMIN);
      await service.update('ban-1', { reason: 'theft' }, 'staff-1');
      const { data } = prisma.ban.update.mock.calls[0][0];
      expect(data.venueBans).toBeUndefined();
      expect(data.reason).toBe('Theft');
    });

    it('checks the new end date against the existing start date', async () => {
      actAs(Role.ADMIN);
      await expect(
        service.update('ban-1', { endDate: inDays(-5) }, 'staff-1'),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('remove', () => {
    it('lets an admin delete any ban', async () => {
      actAs(Role.ADMIN);
      prisma.ban.findUnique.mockResolvedValue(makeBan({ venueIds: [NEON] }));
      await expect(service.remove('ban-1', 'staff-1')).resolves.toBe('Deleted ban for Blake Turner');
      expect(events.notifyBansChanged).toHaveBeenCalled();
    });

    it('stops a bouncer deleting bans', async () => {
      actAs(Role.BOUNCER);
      await expect(service.remove('ban-1', 'staff-1')).rejects.toThrow(ForbiddenException);
      expect(prisma.ban.delete).not.toHaveBeenCalled();
    });
  });
});
