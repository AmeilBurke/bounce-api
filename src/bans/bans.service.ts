import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CreateBanDto } from './dto/create-ban.dto';
import { UpdateBanDto } from './dto/update-ban.dto';
import { PrismaService } from '../prisma.service';
import { EventsGateway } from '../events/events.gateway';
import { Ban, Prisma, Role, Staff } from '../generated/prisma/client';
import { assertAdmin, capitalize, ImageFolder, imageUrl, uniqueIds } from '../utils';

const banInclude = {
  bannedPerson: true,
  createdBy: { select: { id: true, name: true } },
  venueBans: { include: { venue: { select: { id: true, name: true } } } },
} satisfies Prisma.BanInclude;

type BanWithRelations = Prisma.BanGetPayload<{ include: typeof banInclude }>;

type Requester = {
  id: Staff['id'];
  role: Role;
  managedVenueIds: Set<string>;
};

@Injectable()
export class BansService {
  constructor(
    private prisma: PrismaService,
    private events: EventsGateway,
  ) {}

  async create(createBanDto: CreateBanDto, staffId: Staff['id'], baseUrl: string) {
    const requester = await this.getRequester(staffId);
    const venueIds = uniqueIds(createBanDto.venueIds) ?? [];

    if (requester.role === Role.VENUE_MANAGER && !this.managesAll(requester, venueIds)) {
      throw new ForbiddenException('Venue managers can only ban people from venues they manage');
    }

    const startDate = createBanDto.startDate ? new Date(createBanDto.startDate) : new Date();
    const endDate = new Date(createBanDto.endDate);
    this.assertDateRange(startDate, endDate);

    // Admins and venue managers are trusted; anyone else's ban needs approving
    const isPending = requester.role !== Role.ADMIN && requester.role !== Role.VENUE_MANAGER;

    try {
      const ban = await this.prisma.ban.create({
        data: {
          reason: capitalize(createBanDto.reason),
          startDate,
          endDate,
          isPending,
          bannedPersonId: createBanDto.bannedPersonId,
          createdById: requester.id,
          venueBans: { create: venueIds.map((venueId) => ({ venueId })) },
        },
        include: banInclude,
      });

      this.notifyChanged();

      return this.withImageUrl(ban, baseUrl);
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2003') {
        throw new BadRequestException('The banned person or one or more venues do not exist');
      }
      throw err;
    }
  }

  async findAll(baseUrl: string) {
    const bans = await this.prisma.ban.findMany({
      where: { isPending: false },
      orderBy: { startDate: 'desc' },
      include: banInclude,
    });

    return bans.map((ban) => this.withImageUrl(ban, baseUrl));
  }

  // Only admins review pending bans
  async findPending(staffId: Staff['id'], baseUrl: string) {
    await assertAdmin(this.prisma, staffId);

    const bans = await this.prisma.ban.findMany({
      where: { isPending: true },
      orderBy: { startDate: 'desc' },
      include: banInclude,
    });

    return bans.map((ban) => this.withImageUrl(ban, baseUrl));
  }

  async findOne(id: Ban['id'], baseUrl: string) {
    const ban = await this.findBanOrThrow(id);
    return this.withImageUrl(ban, baseUrl);
  }

  async approve(id: Ban['id'], staffId: Staff['id'], baseUrl: string) {
    const requester = await this.getRequester(staffId);
    const ban = await this.findBanOrThrow(id);

    if (!ban.isPending) {
      throw new BadRequestException('Ban is already approved');
    }

    this.assertCanManage(requester, this.venueIdsOf(ban));

    const approved = await this.prisma.ban.update({
      where: { id },
      data: { isPending: false },
      include: banInclude,
    });

    this.notifyChanged();

    return this.withImageUrl(approved, baseUrl);
  }

  async update(id: Ban['id'], updateBanDto: UpdateBanDto, staffId: Staff['id'], baseUrl: string) {
    const requester = await this.getRequester(staffId);
    const ban = await this.findBanOrThrow(id);

    // undefined = leave untouched, array = replace the full set
    const venueIds = uniqueIds(updateBanDto.venueIds);

    // Must be allowed to manage both the venues it covers now and the ones it will cover
    this.assertCanManage(requester, [...this.venueIdsOf(ban), ...(venueIds ?? [])]);

    const startDate = updateBanDto.startDate ? new Date(updateBanDto.startDate) : ban.startDate;
    const endDate = updateBanDto.endDate ? new Date(updateBanDto.endDate) : ban.endDate;
    this.assertDateRange(startDate, endDate);

    try {
      const updated = await this.prisma.ban.update({
        where: { id },
        data: {
          reason: updateBanDto.reason ? capitalize(updateBanDto.reason) : undefined,
          startDate,
          endDate,
          venueBans:
            venueIds !== undefined
              ? {
                  deleteMany: {},
                  create: venueIds.map((venueId) => ({ venueId })),
                }
              : undefined,
        },
        include: banInclude,
      });

      this.notifyChanged();

      return this.withImageUrl(updated, baseUrl);
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError) {
        if (err.code === 'P2003') {
          throw new BadRequestException('One or more venues do not exist');
        }
        if (err.code === 'P2025') {
          throw new NotFoundException('Ban not found');
        }
      }
      throw err;
    }
  }

  // Also used to reject a pending ban
  async remove(id: Ban['id'], staffId: Staff['id']): Promise<string> {
    const requester = await this.getRequester(staffId);
    const ban = await this.findBanOrThrow(id);

    this.assertCanManage(requester, this.venueIdsOf(ban));

    try {
      await this.prisma.ban.delete({ where: { id } });
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2025') {
        throw new NotFoundException('Ban not found');
      }
      throw err;
    }

    this.notifyChanged();

    return `Deleted ban for ${ban.bannedPerson.name}`;
  }

  private async getRequester(staffId: Staff['id']): Promise<Requester> {
    const staff = await this.prisma.staff.findUnique({
      where: { id: staffId },
      select: { id: true, role: true, venueManages: { select: { venueId: true } } },
    });

    if (!staff) {
      throw new ForbiddenException();
    }

    return {
      id: staff.id,
      role: staff.role,
      managedVenueIds: new Set(staff.venueManages.map((v) => v.venueId)),
    };
  }

  private async findBanOrThrow(id: Ban['id']): Promise<BanWithRelations> {
    const ban = await this.prisma.ban.findUnique({
      where: { id },
      include: banInclude,
    });

    if (!ban) {
      throw new NotFoundException('Ban not found');
    }

    return ban;
  }

  private managesAll(requester: Requester, venueIds: string[]): boolean {
    return venueIds.every((venueId) => requester.managedVenueIds.has(venueId));
  }

  // Admins can manage any ban, venue managers only bans limited to their venues
  private assertCanManage(requester: Requester, venueIds: string[]) {
    if (requester.role === Role.ADMIN) return;

    if (requester.role === Role.VENUE_MANAGER && this.managesAll(requester, venueIds)) return;

    throw new ForbiddenException();
  }

  private assertDateRange(startDate: Date, endDate: Date) {
    if (endDate <= startDate) {
      throw new BadRequestException('End date must be after the start date');
    }
  }

  private venueIdsOf(ban: BanWithRelations): string[] {
    return ban.venueBans.map((venueBan) => venueBan.venueId);
  }

  // The webapp also refreshes banned people on this, since they're returned with their bans
  private notifyChanged() {
    this.events.notifyBansChanged();
  }

  private withImageUrl(ban: BanWithRelations, baseUrl: string): BanWithRelations {
    return {
      ...ban,
      bannedPerson: {
        ...ban.bannedPerson,
        imagePath: imageUrl(baseUrl, ImageFolder.PEOPLE, ban.bannedPerson.imagePath),
      },
    };
  }
}
