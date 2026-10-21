import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { CreateBannedPersonDto } from './dto/create-banned-person.dto';
import { UpdateBannedPersonDto } from './dto/update-banned-person.dto';
import { PrismaService } from '../prisma.service';
import { EventsGateway } from '../events/events.gateway';
import { BannedPerson, Prisma, Staff, Venue } from '../generated/prisma/client';
import {
  assertAdmin,
  copyImage,
  deleteImage,
  ImageFolder,
  imageUrl,
  saveImage,
  toTitleCase,
} from '../utils';

const banInclude = {
  createdBy: { select: { id: true, name: true } },
  venueBans: { include: { venue: { select: { id: true, name: true } } } },
} satisfies Prisma.BanInclude;

// Pending bans are only shown on their own, in the pending bans list
const bannedPersonInclude = {
  alert: true,
  bans: {
    where: { isPending: false },
    orderBy: { startDate: 'desc' },
    include: banInclude,
  },
} satisfies Prisma.BannedPersonInclude;

type BannedPersonWithBans = Prisma.BannedPersonGetPayload<{
  include: typeof bannedPersonInclude;
}>;

const activeBanWhere = (now: Date) =>
  ({
    isPending: false,
    startDate: { lte: now },
    endDate: { gt: now },
  }) satisfies Prisma.BanWhereInput;

@Injectable()
export class BannedPeopleService {
  constructor(
    private prisma: PrismaService,
    private events: EventsGateway,
  ) {}

  async create(
    createBannedPersonDto: CreateBannedPersonDto,
    file: Express.Multer.File | undefined,
  ) {
    let savedImage: string | undefined;

    try {
      if (!file) {
        throw new BadRequestException('No image was given');
      }

      savedImage = await saveImage(file, ImageFolder.PEOPLE);

      const person = await this.prisma.bannedPerson.create({
        data: {
          name: toTitleCase(createBannedPersonDto.name),
          imagePath: savedImage,
        },
        include: bannedPersonInclude,
      });
      // The person now points at the image, so a later error mustn't delete it
      savedImage = undefined;

      this.events.notifyBannedPeopleChanged();

      return this.withImageUrl(person);
    } catch (err) {
      if (savedImage) await deleteImage(ImageFolder.PEOPLE, savedImage);
      throw err;
    }
  }

  async findAll() {
    const people = await this.prisma.bannedPerson.findMany({
      orderBy: { name: 'asc' },
      include: bannedPersonInclude,
    });

    return people.map((person) => this.withImageUrl(person));
  }

  // People with an approved ban at the venue, carrying only their bans at that venue
  async findAtVenue(venueId: Venue['id']) {
    const atVenue = {
      isPending: false,
      venueBans: { some: { venueId } },
    } satisfies Prisma.BanWhereInput;

    const people = await this.prisma.bannedPerson.findMany({
      where: { bans: { some: atVenue } },
      orderBy: { name: 'asc' },
      include: {
        ...bannedPersonInclude,
        bans: { ...bannedPersonInclude.bans, where: atVenue },
      },
    });

    return people.map((person) => this.withImageUrl(person));
  }

  // People whose active bans, taken together, cover every venue
  async findBlanketBanned() {
    const venues = await this.prisma.venue.findMany({ select: { id: true } });
    if (venues.length === 0) return [];

    const now = new Date();

    // Narrowed in the database to anyone with an active ban, then checked for full coverage here
    const candidates = await this.prisma.bannedPerson.findMany({
      where: { bans: { some: activeBanWhere(now) } },
      orderBy: { name: 'asc' },
      include: bannedPersonInclude,
    });

    return candidates
      .filter((person) => this.coversEveryVenue(person, venues, now))
      .map((person) => this.withImageUrl(person));
  }

  // Just enough to pick a person from a list
  async findNames() {
    return this.prisma.bannedPerson.findMany({
      orderBy: { name: 'asc' },
      select: { id: true, name: true },
    });
  }

  async findOne(id: BannedPerson['id']) {
    const person = await this.prisma.bannedPerson.findUnique({
      where: { id },
      include: bannedPersonInclude,
    });

    if (!person) {
      throw new NotFoundException('Banned person not found');
    }

    return this.withImageUrl(person);
  }

  async update(
    id: BannedPerson['id'],
    updateBannedPersonDto: UpdateBannedPersonDto,
    staffId: Staff['id'],
    file: Express.Multer.File | undefined,
  ) {
    let savedImage: string | undefined;

    try {
      await assertAdmin(this.prisma, staffId);

      const existing = await this.prisma.bannedPerson.findUnique({
        where: { id },
        select: { imagePath: true },
      });
      if (!existing) {
        throw new NotFoundException('Banned person not found');
      }

      if (file) {
        savedImage = await saveImage(file, ImageFolder.PEOPLE);
      }

      const person = await this.prisma.bannedPerson.update({
        where: { id },
        data: {
          name: updateBannedPersonDto.name ? toTitleCase(updateBannedPersonDto.name) : undefined,
          imagePath: savedImage,
          // A linked alert stores a copy of the person's image filename
          alert: savedImage ? { update: { imagePath: savedImage } } : undefined,
        },
        include: bannedPersonInclude,
      });

      if (savedImage) {
        // The person now points at the new image, so a later error mustn't delete it
        savedImage = undefined;
        await deleteImage(ImageFolder.PEOPLE, existing.imagePath);
        if (person.alert) this.events.notifyAlertsChanged();
      }

      this.events.notifyBannedPeopleChanged();

      return this.withImageUrl(person);
    } catch (err) {
      if (savedImage) await deleteImage(ImageFolder.PEOPLE, savedImage);

      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2025') {
        throw new NotFoundException('Banned person not found');
      }
      throw err;
    }
  }

  async remove(id: BannedPerson['id'], staffId: Staff['id']): Promise<string> {
    await assertAdmin(this.prisma, staffId);

    const person = await this.prisma.bannedPerson.findUnique({
      where: { id },
      select: { imagePath: true, alert: { select: { id: true } } },
    });
    if (!person) {
      throw new NotFoundException('Banned person not found');
    }

    // Deleting the person sets the alert's bannedPersonId to null, after which the
    // alert looks for its image in the alerts folder, so copy it there first
    if (person.alert) {
      await copyImage(ImageFolder.PEOPLE, ImageFolder.ALERTS, person.imagePath);
    }

    try {
      const deletedPerson = await this.prisma.bannedPerson.delete({ where: { id } });

      await deleteImage(ImageFolder.PEOPLE, deletedPerson.imagePath);

      this.events.notifyBannedPeopleChanged();
      if (person.alert) this.events.notifyAlertsChanged();

      return `Deleted ${deletedPerson.name}`;
    } catch (err) {
      if (person.alert) await deleteImage(ImageFolder.ALERTS, person.imagePath);

      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2025') {
        throw new NotFoundException('Banned person not found');
      }
      throw err;
    }
  }

  private coversEveryVenue(person: BannedPersonWithBans, venues: { id: Venue['id'] }[], now: Date) {
    const covered = new Set(
      person.bans
        .filter((ban) => ban.startDate <= now && now < ban.endDate)
        .flatMap((ban) => ban.venueBans.map((venueBan) => venueBan.venueId)),
    );
    return venues.every((venue) => covered.has(venue.id));
  }

  private withImageUrl<T extends BannedPerson>(person: T): T {
    return { ...person, imagePath: imageUrl(ImageFolder.PEOPLE, person.imagePath) };
  }
}
