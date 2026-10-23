import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CreateVenueDto } from './dto/create-venue.dto';
import { UpdateVenueDto } from './dto/update-venue.dto';
import { PrismaService } from '../prisma.service';
import { EventsGateway } from '../events/events.gateway';
import { Prisma, Role, Staff, Venue } from '../generated/prisma/client';
import { assertAdmin, toTitleCase, uniqueIds } from '../utils';

const venueInclude = {
  managers: { include: { staff: { select: { id: true, name: true } } } },
  dutyManagers: { include: { staff: { select: { id: true, name: true } } } },
} satisfies Prisma.VenueInclude;

@Injectable()
export class VenuesService {
  constructor(
    private prisma: PrismaService,
    private events: EventsGateway,
  ) {}

  async create(createVenueDto: CreateVenueDto, staffId: Staff['id']) {
    await assertAdmin(this.prisma, staffId);

    const managerIds = uniqueIds(createVenueDto.managers) ?? [];
    const dutyManagerIds = uniqueIds(createVenueDto.dutyManagers) ?? [];
    await this.assertAssignable(managerIds, dutyManagerIds);

    const venue = await this.prisma.venue.create({
      data: {
        name: toTitleCase(createVenueDto.name),
        managers: { create: managerIds.map((staffId) => ({ staffId })) },
        dutyManagers: { create: dutyManagerIds.map((staffId) => ({ staffId })) },
      },
      include: venueInclude,
    });

    this.events.notifyVenuesChanged();

    return venue;
  }

  async findAll(staffId: Staff['id']) {
    return this.prisma.venue.findMany({
      where: await this.visibleTo(staffId),
      orderBy: { name: 'asc' },
      include: venueInclude,
    });
  }

  async findOne(id: Venue['id'], staffId: Staff['id']) {
    // A venue the requester can't see is reported as missing rather than forbidden
    const venue = await this.prisma.venue.findFirst({
      where: { id, ...(await this.visibleTo(staffId)) },
      include: venueInclude,
    });

    if (!venue) {
      throw new NotFoundException('Venue not found');
    }

    return venue;
  }

  async update(id: Venue['id'], updateVenueDto: UpdateVenueDto, staffId: Staff['id']) {
    try {
      await assertAdmin(this.prisma, staffId);

      // undefined = leave untouched, array = replace the full set
      const managerIds = uniqueIds(updateVenueDto.managers);
      const dutyManagerIds = uniqueIds(updateVenueDto.dutyManagers);
      await this.assertAssignable(managerIds ?? [], dutyManagerIds ?? []);

      const venue = await this.prisma.venue.update({
        where: { id },
        data: {
          name: updateVenueDto.name ? toTitleCase(updateVenueDto.name) : undefined,
          managers:
            managerIds !== undefined
              ? {
                  deleteMany: {},
                  create: managerIds.map((staffId) => ({ staffId })),
                }
              : undefined,
          dutyManagers:
            dutyManagerIds !== undefined
              ? {
                  deleteMany: {},
                  create: dutyManagerIds.map((staffId) => ({ staffId })),
                }
              : undefined,
        },
        include: venueInclude,
      });

      this.events.notifyVenuesChanged();

      return venue;
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2025') {
        throw new NotFoundException('Venue not found');
      }
      throw err;
    }
  }

  async remove(id: Venue['id'], staffId: Staff['id']): Promise<string> {
    await assertAdmin(this.prisma, staffId);

    try {
      const deletedVenue = await this.prisma.$transaction(async (tx) => {
        // Bans covering only this venue would apply nowhere once it's gone, so they go with it.
        // `some` stops `every` also matching bans that already have no venues
        await tx.ban.deleteMany({
          where: {
            venueBans: { some: { venueId: id }, every: { venueId: id } },
          },
        });

        return tx.venue.delete({ where: { id } });
      });

      this.events.notifyVenuesChanged();
      this.events.notifyBansChanged();
      this.events.notifyBannedPeopleChanged();

      return `Deleted venue ${deletedVenue.name}`;
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2025') {
        throw new NotFoundException('Venue not found');
      }
      throw err;
    }
  }

  // Venue and duty managers only see the venues they're assigned to; everyone else sees them all
  private async visibleTo(staffId: Staff['id']): Promise<Prisma.VenueWhereInput> {
    const staff = await this.prisma.staff.findUnique({
      where: { id: staffId },
      select: { role: true },
    });

    if (!staff) {
      throw new ForbiddenException();
    }

    if (staff.role !== Role.VENUE_MANAGER && staff.role !== Role.DUTY_MANAGER) {
      return {};
    }

    return {
      OR: [{ managers: { some: { staffId } } }, { dutyManagers: { some: { staffId } } }],
    };
  }

  // Also catches ids that don't belong to any staff member
  private async assertAssignable(managerIds: string[], dutyManagerIds: string[]) {
    if (managerIds.length > 0) {
      const count = await this.prisma.staff.count({
        where: { id: { in: managerIds }, role: Role.VENUE_MANAGER },
      });
      if (count !== managerIds.length) {
        throw new BadRequestException('Managers must be existing venue managers');
      }
    }

    if (dutyManagerIds.length > 0) {
      const count = await this.prisma.staff.count({
        where: {
          id: { in: dutyManagerIds },
          role: { in: [Role.VENUE_MANAGER, Role.DUTY_MANAGER] },
        },
      });
      if (count !== dutyManagerIds.length) {
        throw new BadRequestException(
          'Duty managers must be existing venue managers or duty managers',
        );
      }
    }
  }
}
