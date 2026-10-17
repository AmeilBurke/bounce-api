import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
} from '@nestjs/common';
import { CreateAlertDto } from './dto/create-alert.dto';
import { Alert, Prisma, Staff } from '../generated/prisma/client';
import { PrismaService } from '../prisma.service';
import { capitalize, isAccountAdmin } from '../utils';
import path from 'path';
import * as fs from 'fs';
import sharp from 'sharp';
import { Cron } from '@nestjs/schedule';
import { EventsGateway } from '../events/events.gateway';

@Injectable()
export class AlertsService {
  constructor(
    private prisma: PrismaService,
    private events: EventsGateway,
  ) { }

  private readonly ALERT_IMAGE_FOLDER = path.join(process.cwd(), 'uploads', 'compressed', 'alerts');
  private readonly URL_ALERT_IMAGE = '/uploads/compressed/alerts/';
  private readonly BANNEDPERSON_ALERT_IMAGE = '/uploads/compressed/people/';
  private readonly logger = new Logger(AlertsService.name);

  async onModuleInit() {
    await fs.promises.mkdir(this.ALERT_IMAGE_FOLDER, { recursive: true });
  }

  async create(
    createAlertDto: CreateAlertDto,
    staffId: Staff['id'],
    file: Express.Multer.File,
    baseUrl: string,
  ): Promise<Alert> {
    const bannedPersonId = createAlertDto.bannedPersonId || undefined;
    let createdFile: string | undefined;

    try {
      if (!file && !bannedPersonId) {
        throw new BadRequestException('No image or banned person id was given');
      }

      let imagePath: string;

      if (bannedPersonId) {
        const person = await this.prisma.bannedPerson.findUniqueOrThrow({
          where: { id: bannedPersonId },
          select: { imagePath: true },
        });

        imagePath = person.imagePath;
      } else {
        const webpFilename = `${file.filename}.webp`;
        createdFile = path.join(this.ALERT_IMAGE_FOLDER, webpFilename);
        await sharp(file.path).rotate().webp({ quality: 75 }).toFile(createdFile);
        imagePath = webpFilename;
      }

      const result = await this.prisma.alert.create({
        data: {
          reason: capitalize(createAlertDto.reason),
          imagePath,
          createdById: staffId,
          bannedPersonId,
        },
      });

      this.events.notifyAlertsChanged();

      const folder = result.bannedPersonId ? this.BANNEDPERSON_ALERT_IMAGE : this.URL_ALERT_IMAGE;
      return { ...result, imagePath: `${baseUrl}${folder}${result.imagePath}` };

    } catch (err) {
      if (createdFile) await fs.promises.rm(createdFile, { force: true });

      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        throw new ConflictException('An alert already exists for this person');
      }
      throw err;
    } finally {
      if (file) await fs.promises.unlink(file.path).catch(() => { });
    }
  }

  async findAll(baseUrl: string): Promise<Alert[]> {
    const alerts = await this.prisma.alert.findMany({
      orderBy: { startDate: 'desc' },
    });

    return alerts.map((alert) => {
      const folder = alert.bannedPersonId
        ? this.BANNEDPERSON_ALERT_IMAGE
        : this.URL_ALERT_IMAGE;

      return { ...alert, imagePath: `${baseUrl}${folder}${alert.imagePath}` };
    });
  }

  async remove(id: Alert['id'], staffId: Staff['id']): Promise<string> {
    const isAdmin = await isAccountAdmin(this.prisma, staffId);

    if (!isAdmin) {
      throw new ForbiddenException();
    }

    const alertToDelete = await this.prisma.alert.findUniqueOrThrow({
      where: { id },
      select: {
        bannedPersonId: true,
        imagePath: true,
      },
    });

    await this.prisma.alert.delete({ where: { id } });

    if (!alertToDelete.bannedPersonId) {
      await fs.promises.rm(
        path.join(this.ALERT_IMAGE_FOLDER, alertToDelete.imagePath),
        { force: true },
      );
    }

    this.events.notifyAlertsChanged();

    return 'Deleted alert';
  }

  //cronjob to delete all next day @ 5:00am
  @Cron('0 5 * * *', { timeZone: 'Pacific/Auckland' })
  async removeAll(): Promise<void> {
    try {
      const alerts = await this.prisma.alert.findMany({
        select: { id: true, imagePath: true, bannedPersonId: true },
      });

      if (alerts.length === 0) return;

      const { count } = await this.prisma.alert.deleteMany({
        where: { id: { in: alerts.map((a) => a.id) } },
      });

      // Only standalone alerts own their image file
      await Promise.allSettled(
        alerts
          .filter((a) => !a.bannedPersonId)
          .map((a) =>
            fs.promises.rm(path.join(this.ALERT_IMAGE_FOLDER, a.imagePath), { force: true }),
          ),
      );

      this.events.notifyAlertsChanged();

      this.logger.log(`Cronjob deleted ${count} alerts`);
    } catch (err) {
      this.logger.error('Cronjob failed to delete alerts', err instanceof Error ? err.stack : String(err));
    }
  }
}
