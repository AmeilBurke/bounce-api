import { BadRequestException, ConflictException, Injectable } from '@nestjs/common';
import { CreateAlertsDto } from './dto/create-alert.dto';
import { UpdateAlertDto } from './dto/update-alert.dto';
import { Prisma, Staff } from '../generated/prisma/client';
import { PrismaService } from '../prisma.service';
import { StaffEntity } from '../staff/staff.entity';
import { capitalize } from '../utils';
import path from 'path';
import * as fs from "fs";
import sharp from 'sharp';

@Injectable()
export class AlertsService {
  constructor(private prisma: PrismaService) { }

  private readonly ALERT_IMAGE_FOLDER = path.join(process.cwd(), 'uploads', 'compressed', 'alerts');
  private readonly URL_ALERT_IMAGE = '/uploads/compressed/alerts/'

  async create(createAlertsDto: CreateAlertsDto, staffId: Staff["id"], file: Express.Multer.File, baseUrl: string) {
    if (!file && !createAlertsDto.personId) {
      throw new BadRequestException("No image or banned person id was given");
    }

    let imagePath: string | undefined;

    if (file) {
      try {
        const webpFilename = `${file.filename}.webp`;
        await sharp(file.path).webp({ quality: 75 }).toFile(path.join(this.ALERT_IMAGE_FOLDER, webpFilename));
        imagePath = webpFilename;
      } finally {
        await fs.promises.unlink(file.path).catch(() => { });
      }
    }

    // if (createAlertsDto.personId) {
    //   const bannedPerson = await this.prisma.bannedPerson.findUniqueOrThrow({
    //     where: { id: createAlertDto.personId },
    //     select: { imagePath: true },
    //   });


    //   if (!imagePath) {
    //     imagePath = bannedPerson.imagePath ?? undefined;
    //   }
    // }

    if (!imagePath) {
      throw new BadRequestException("No image could be resolved for this alert");
    }

    const result = await this.prisma.alerts.create({
      data: {
        reason: capitalize(createAlertsDto.reason),
        imagePath: imagePath,
        personId: createAlertsDto.personId,
        createdById: staffId,
      },
    });

    return {
      ...result,
      imagePath: `${baseUrl}${this.URL_ALERT_IMAGE}${result.imagePath}`,
    };
  }

  findAll() {
    return `This action returns all alerts`;
  }

  // findOne(id: number) {
  //   return `This action returns a #${id} alert`;
  // }

  // update(id: number, updateAlertDto: UpdateAlertDto) {
  //   return `This action updates a #${id} alert`;
  // }

  // remove(id: number) {
  //   return `This action removes a #${id} alert`;
  // }
}
