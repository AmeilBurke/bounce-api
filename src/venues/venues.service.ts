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
import { isAccountAdmin, toTitleCase } from '../utils';
import path from 'path';
import * as fs from 'fs';
import sharp from 'sharp';

const venueInclude = {
  managers: { include: { staff: { select: { id: true, name: true } } } },
  dutyManagers: { include: { staff: { select: { id: true, name: true } } } },
} satisfies Prisma.VenueInclude;

// The global ValidationPipe doesn't transform, so the handler gets the raw body
const toIdList = (value: string | string[] | undefined): string[] | undefined =>
  value === undefined ? undefined : [...new Set(Array.isArray(value) ? value : [value])];

@Injectable()
export class VenuesService {
  constructor(
    private prisma: PrismaService,
    private events: EventsGateway,
  ) { }

  private readonly VENUE_IMAGE_FOLDER = path.join(process.cwd(), 'uploads', 'compressed', 'venues');
  private readonly URL_VENUE_IMAGE = '/uploads/compressed/venues/';

  async onModuleInit() {
    await fs.promises.mkdir(this.VENUE_IMAGE_FOLDER, { recursive: true });
  }

  async create(
    createVenueDto: CreateVenueDto,
    staffId: Staff['id'],
    file: Express.Multer.File,
    baseUrl: string,
  ) {
    let createdFile: string | undefined;

    try {
      await this.assertAdmin(staffId);

      if (!file) {
        throw new BadRequestException('No image was given');
      }

      const managerIds = toIdList(createVenueDto.managers) ?? [];
      const dutyManagerIds = toIdList(createVenueDto.dutyManagers) ?? [];
      await this.assertAssignable(managerIds, dutyManagerIds);

      const webpFilename = `${file.filename}.webp`;
      createdFile = path.join(this.VENUE_IMAGE_FOLDER, webpFilename);
      await sharp(file.path).rotate().webp({ quality: 75 }).toFile(createdFile);

      const venue = await this.prisma.venue.create({
        data: {
          name: toTitleCase(createVenueDto.name),
          imagePath: webpFilename,
          managers: { create: managerIds.map((staffId) => ({ staffId })) },
          dutyManagers: { create: dutyManagerIds.map((staffId) => ({ staffId })) },
        },
        include: venueInclude,
      });

      this.events.notifyVenuesChanged();

      return this.withImageUrl(venue, baseUrl);
    } catch (err) {
      if (createdFile) await fs.promises.rm(createdFile, { force: true });
      throw err;
    } finally {
      if (file) await fs.promises.unlink(file.path).catch(() => { });
    }
  }

  async findAll(baseUrl: string) {
    const venues = await this.prisma.venue.findMany({
      orderBy: { name: 'asc' },
      include: venueInclude,
    });

    return venues.map((venue) => this.withImageUrl(venue, baseUrl));
  }

  async findOne(id: Venue['id'], baseUrl: string) {
    const venue = await this.prisma.venue.findUnique({
      where: { id },
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
    let createdFile: string | undefined;

    try {
      await this.assertAdmin(staffId);

      const existing = await this.prisma.venue.findUnique({
        where: { id },
        select: { imagePath: true },
      });
      if (!existing) {
        throw new NotFoundException('Venue not found');
      }

      // undefined = leave untouched, array = replace the full set
      const managerIds = toIdList(updateVenueDto.managers);
      const dutyManagerIds = toIdList(updateVenueDto.dutyManagers);
      await this.assertAssignable(managerIds ?? [], dutyManagerIds ?? []);

      let imagePath: string | undefined;
      if (file) {
        imagePath = `${file.filename}.webp`;
        createdFile = path.join(this.VENUE_IMAGE_FOLDER, imagePath);
        await sharp(file.path).rotate().webp({ quality: 75 }).toFile(createdFile);
      }

      const venue = await this.prisma.venue.update({
        where: { id },
        data: {
          name: updateVenueDto.name ? toTitleCase(updateVenueDto.name) : undefined,
          imagePath,
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

      if (imagePath) {
        await fs.promises.rm(path.join(this.VENUE_IMAGE_FOLDER, existing.imagePath), { force: true });
      }

      this.events.notifyVenuesChanged();

      return this.withImageUrl(venue, baseUrl);
    } catch (err) {
      if (createdFile) await fs.promises.rm(createdFile, { force: true });

      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2025') {
        throw new NotFoundException('Venue not found');
      }
      throw err;
    } finally {
      if (file) await fs.promises.unlink(file.path).catch(() => { });
    }
  }

  async remove(id: Venue['id'], staffId: Staff['id']): Promise<string> {
    await this.assertAdmin(staffId);

    try {
      const deletedVenue = await this.prisma.venue.delete({ where: { id } });

      await fs.promises.rm(path.join(this.VENUE_IMAGE_FOLDER, deletedVenue.imagePath), { force: true });

      this.events.notifyVenuesChanged();

      return `Deleted venue ${deletedVenue.name}`;
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2025') {
        throw new NotFoundException('Venue not found');
      }
      throw err;
    }
  }

  private async assertAdmin(staffId: Staff['id']) {
    if (!(await isAccountAdmin(this.prisma, staffId))) {
      throw new ForbiddenException();
    }
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
        throw new BadRequestException('Duty managers must be existing venue managers or duty managers');
      }
    }
  }

  private withImageUrl<T extends Venue>(venue: T, baseUrl: string): T {
    return { ...venue, imagePath: `${baseUrl}${this.URL_VENUE_IMAGE}${venue.imagePath}` };
  }
}
