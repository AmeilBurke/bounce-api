import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import * as fs from 'fs';
import { CreateBannedPersonDto } from './dto/create-banned-person.dto';
import { UpdateBannedPersonDto } from './dto/update-banned-person.dto';
import { PrismaService } from '../prisma.service';
import { EventsGateway } from '../events/events.gateway';
import { BannedPerson, Prisma, Staff } from '../generated/prisma/client';
import {
  assertAdmin,
  deleteImage,
  deleteUpload,
  ImageFolder,
  imagePath,
  imageUrl,
  saveImage,
  toTitleCase,
} from '../utils';

const bannedPersonInclude = {
  alert: true,
  bans: {
    orderBy: { startDate: 'desc' },
    include: {
      createdBy: { select: { id: true, name: true } },
      venueBans: { include: { venue: { select: { id: true, name: true } } } },
    },
  },
} satisfies Prisma.BannedPersonInclude;

@Injectable()
export class BannedPeopleService {
  constructor(
    private prisma: PrismaService,
    private events: EventsGateway,
  ) {}

  async create(
    createBannedPersonDto: CreateBannedPersonDto,
    file: Express.Multer.File | undefined,
    baseUrl: string,
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

      this.events.notifyBannedPeopleChanged();

      return this.withImageUrl(person, baseUrl);
    } catch (err) {
      if (savedImage) await deleteImage(ImageFolder.PEOPLE, savedImage);
      throw err;
    } finally {
      await deleteUpload(file);
    }
  }

  async findAll(baseUrl: string) {
    const people = await this.prisma.bannedPerson.findMany({
      orderBy: { name: 'asc' },
      include: bannedPersonInclude,
    });

    return people.map((person) => this.withImageUrl(person, baseUrl));
  }

  async findOne(id: BannedPerson['id'], baseUrl: string) {
    const person = await this.prisma.bannedPerson.findUnique({
      where: { id },
      include: bannedPersonInclude,
    });

    if (!person) {
      throw new NotFoundException('Banned person not found');
    }

    return this.withImageUrl(person, baseUrl);
  }

  async update(
    id: BannedPerson['id'],
    updateBannedPersonDto: UpdateBannedPersonDto,
    staffId: Staff['id'],
    file: Express.Multer.File | undefined,
    baseUrl: string,
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
        await deleteImage(ImageFolder.PEOPLE, existing.imagePath);
        if (person.alert) this.events.notifyAlertsChanged();
      }

      this.events.notifyBannedPeopleChanged();

      return this.withImageUrl(person, baseUrl);
    } catch (err) {
      if (savedImage) await deleteImage(ImageFolder.PEOPLE, savedImage);

      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2025') {
        throw new NotFoundException('Banned person not found');
      }
      throw err;
    } finally {
      await deleteUpload(file);
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
      await fs.promises.copyFile(
        imagePath(ImageFolder.PEOPLE, person.imagePath),
        imagePath(ImageFolder.ALERTS, person.imagePath),
      );
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

  private withImageUrl<T extends BannedPerson>(person: T, baseUrl: string): T {
    return { ...person, imagePath: imageUrl(baseUrl, ImageFolder.PEOPLE, person.imagePath) };
  }
}
