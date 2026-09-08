import { BadRequestException, ForbiddenException, Injectable, Logger } from '@nestjs/common';
import { CreateAlertsDto } from './dto/create-alert.dto';
import { Alerts, Prisma, Staff } from '../generated/prisma/client';
import { PrismaService } from '../prisma.service';
import { capitalize, isAccountAdmin } from '../utils';
import path from 'path';
import * as fs from "fs";
import sharp from 'sharp';
import { Cron } from '@nestjs/schedule';

@Injectable()
export class AlertsService {
  constructor(private prisma: PrismaService) { }

  private readonly ALERT_IMAGE_FOLDER = path.join(process.cwd(), 'uploads', 'compressed', 'alerts');
  private readonly URL_ALERT_IMAGE = '/uploads/compressed/alerts/';
  private readonly logger = new Logger(AlertsService.name);

  async create(createAlertsDto: CreateAlertsDto, staffId: Staff["id"], file: Express.Multer.File, baseUrl: string): Promise<Alerts> {
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
        createdById: staffId,
        personId: createAlertsDto.personId,
      },
    });

    return {
      ...result,
      imagePath: `${baseUrl}${this.URL_ALERT_IMAGE}${result.imagePath}`,
    };
  }

  async findAll(baseUrl: string): Promise<Alerts[]> {
    const alerts = await this.prisma.alerts.findMany({
      orderBy: {
        startDate: 'desc'
      }
    })

    const allAlerts = alerts.map((alert) => {
      if (alert.personId) {
        return {
          ...alert,
          imagePath: `${baseUrl}/uploads/compressed/people/${alert.imagePath}`,
        };
      } else {
        return {
          ...alert,
          imagePath: `${baseUrl}/uploads/compressed/alerts/${alert.imagePath}`,
        };
      }
    });

    return allAlerts;
  }

  async remove(id: Alerts["id"], staffId: Staff["id"]): Promise<string> {
    const isAdmin = await isAccountAdmin(this.prisma, staffId);

    if (!isAdmin) {
      throw new ForbiddenException();
    }

    const alertToDelete = await this.prisma.alerts.findUniqueOrThrow({
      where: { id },
      select: {
        personId: true,
        imagePath: true
      },
    });

    if (!alertToDelete.personId) {
      await fs.promises.rm(
        path.join(this.ALERT_IMAGE_FOLDER, alertToDelete.imagePath)
      );
    }

    await this.prisma.alerts.delete({ where: { id } });
    return 'Deleted alert';
  }

  //cronjob to delete all next day @ 5:00am
  @Cron('0 5 * * *')
  // @Cron('* * * * *')
  private async removeAll(): Promise<void> {
    const allAlertsWithoutBannedPersonId = await this.prisma.alerts.findMany({
      where: {
        personId: null
      },
      select: {
        imagePath: true
      },
    });

    await Promise.allSettled(
      allAlertsWithoutBannedPersonId.map(({ imagePath }) =>
        fs.promises.rm(path.join(this.ALERT_IMAGE_FOLDER, imagePath), { force: true })
      )
    );

    const { count } = await this.prisma.alerts.deleteMany();

    this.logger.debug(`Cronjob deleted ${count} alerts on ${new Date()}`);
  }

}
