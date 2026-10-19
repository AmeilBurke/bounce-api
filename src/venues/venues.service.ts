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
import {
  assertAdmin,
  deleteImage,
  deleteUpload,
  ImageFolder,
  imageUrl,
  saveImage,
  toTitleCase,
  uniqueIds,
} from '../utils';

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

  async create(
    createVenueDto: CreateVenueDto,
    staffId: Staff['id'],
    file: Express.Multer.File | undefined,
    baseUrl: string,
  ) {
    let savedImage: string | undefined;

    try {
      await assertAdmin(this.prisma, staffId);

      if (!file) {
        throw new BadRequestException('No image was given');
      }

      const managerIds = uniqueIds(createVenueDto.managers) ?? [];
      const dutyManagerIds = uniqueIds(createVenueDto.dutyManagers) ?? [];
      await this.assertAssignable(managerIds, dutyManagerIds);

      savedImage = await saveImage(file, ImageFolder.VENUES);

      const venue = await this.prisma.venue.create({
        data: {
          name: toTitleCase(createVenueDto.name),
          imagePath: savedImage,
          managers: { create: managerIds.map((staffId) => ({ staffId })) },
          dutyManagers: { create: dutyManagerIds.map((staffId) => ({ staffId })) },
        },
        include: venueInclude,
      });

      this.events.notifyVenuesChanged();

      return this.withImageUrl(venue, baseUrl);
    } catch (err) {
      if (savedImage) await deleteImage(ImageFolder.VENUES, savedImage);
      throw err;
    } finally {
      await deleteUpload(file);
    }
  }

  async findAll(staffId: Staff['id'], baseUrl: string) {
    const venues = await this.prisma.venue.findMany({
      where: await this.visibleTo(staffId),
      orderBy: { name: 'asc' },
      include: venueInclude,
    });

    return venues.map((venue) => this.withImageUrl(venue, baseUrl));
  }

  // Every venue's id regardless of who is asking, so "banned from every venue" can be worked out
  async findAllIds(): Promise<string[]> {
    const venues = await this.prisma.venue.findMany({ select: { id: true } });
    return venues.map((venue) => venue.id);
  }

  async findOne(id: Venue['id'], staffId: Staff['id'], baseUrl: string) {
    // A venue the requester can't see is reported as missing rather than forbidden
    const venue = await this.prisma.venue.findFirst({
      where: { id, ...(await this.visibleTo(staffId)) },
      include: venueInclude,
    });

    if (!venue) {
      throw new NotFoundException('Venue not found');
    }

    return this.withImageUrl(venue, baseUrl);
  }

  async update(
    id: Venue['id'],
    updateVenueDto: UpdateVenueDto,
    staffId: Staff['id'],
    file: Express.Multer.File | undefined,
    baseUrl: string,
  ) {
    let savedImage: string | undefined;

    try {
      await assertAdmin(this.prisma, staffId);

      const existing = await this.prisma.venue.findUnique({
        where: { id },
        select: { imagePath: true },
      });
      if (!existing) {
        throw new NotFoundException('Venue not found');
      }

      // undefined = leave untouched, array = replace the full set
      const managerIds = uniqueIds(updateVenueDto.managers);
      const dutyManagerIds = uniqueIds(updateVenueDto.dutyManagers);
      await this.assertAssignable(managerIds ?? [], dutyManagerIds ?? []);

      if (file) {
        savedImage = await saveImage(file, ImageFolder.VENUES);
      }

      const venue = await this.prisma.venue.update({
        where: { id },
        data: {
          name: updateVenueDto.name ? toTitleCase(updateVenueDto.name) : undefined,
          imagePath: savedImage,
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

      if (savedImage) {
        await deleteImage(ImageFolder.VENUES, existing.imagePath);
      }

      this.events.notifyVenuesChanged();

      return this.withImageUrl(venue, baseUrl);
    } catch (err) {
      if (savedImage) await deleteImage(ImageFolder.VENUES, savedImage);

      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2025') {
        throw new NotFoundException('Venue not found');
      }
      throw err;
    } finally {
      await deleteUpload(file);
    }
  }

  async remove(id: Venue['id'], staffId: Staff['id']): Promise<string> {
    await assertAdmin(this.prisma, staffId);

    try {
      const deletedVenue = await this.prisma.venue.delete({ where: { id } });

      await deleteImage(ImageFolder.VENUES, deletedVenue.imagePath);

      this.events.notifyVenuesChanged();

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

  private withImageUrl<T extends Venue>(venue: T, baseUrl: string): T {
    return { ...venue, imagePath: imageUrl(baseUrl, ImageFolder.VENUES, venue.imagePath) };
  }
}
