import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { CreateAlertDto } from './dto/create-alert.dto';
import { PrismaService } from '../prisma.service';
import { EventsGateway } from '../events/events.gateway';
import { Alert, Prisma, Staff } from '../generated/prisma/client';
import {
  assertAdmin,
  capitalize,
  deleteImage,
  ImageFolder,
  imageUrl,
  saveImage,
} from '../utils';

@Injectable()
export class AlertsService {
  constructor(
    private prisma: PrismaService,
    private events: EventsGateway,
  ) {}

  private readonly logger = new Logger(AlertsService.name);

  async create(
    createAlertDto: CreateAlertDto,
    staffId: Staff['id'],
    file: Express.Multer.File | undefined,
  ): Promise<Alert> {
    const bannedPersonId = createAlertDto.bannedPersonId || undefined;
    let savedImage: string | undefined;

    try {
      if (!file && !bannedPersonId) {
        throw new BadRequestException('No image or banned person id was given');
      }

      let imagePath: string;

      if (bannedPersonId) {
        // Alerts for a banned person reuse that person's image
        const person = await this.prisma.bannedPerson.findUnique({
          where: { id: bannedPersonId },
          select: { imagePath: true },
        });
        if (!person) {
          throw new NotFoundException('Banned person not found');
        }

        imagePath = person.imagePath;
      } else {
        savedImage = await saveImage(file!, ImageFolder.ALERTS);
        imagePath = savedImage;
      }

      const alert = await this.prisma.alert.create({
        data: {
          reason: capitalize(createAlertDto.reason),
          imagePath,
          createdById: staffId,
          bannedPersonId,
        },
      });

      this.events.notifyAlertsChanged();

      return this.withImageUrl(alert);
    } catch (err) {
      if (savedImage) await deleteImage(ImageFolder.ALERTS, savedImage);

      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        throw new ConflictException('An alert already exists for this person');
      }
      throw err;
    }
  }

  async findAll(): Promise<Alert[]> {
    const alerts = await this.prisma.alert.findMany({
      orderBy: { startDate: 'desc' },
    });

    return alerts.map((alert) => this.withImageUrl(alert));
  }

  async remove(id: Alert['id'], staffId: Staff['id']): Promise<string> {
    await assertAdmin(this.prisma, staffId);

    const alert = await this.prisma.alert.findUnique({
      where: { id },
      select: { bannedPersonId: true, imagePath: true },
    });
    if (!alert) {
      throw new NotFoundException('Alert not found');
    }

    await this.prisma.alert.delete({ where: { id } });

    // Only standalone alerts own their image file
    if (!alert.bannedPersonId) {
      await deleteImage(ImageFolder.ALERTS, alert.imagePath);
    }

    this.events.notifyAlertsChanged();

    return 'Deleted alert';
  }

  // Deletes every alert at 5:00am each day
  @Cron('0 5 * * *', { timeZone: 'Pacific/Auckland' })
  async removeAll(): Promise<void> {
    try {
      const alerts = await this.prisma.alert.findMany({
        select: { id: true, imagePath: true, bannedPersonId: true },
      });

      if (alerts.length === 0) return;

      const { count } = await this.prisma.alert.deleteMany({
        where: { id: { in: alerts.map((alert) => alert.id) } },
      });

      // Only standalone alerts own their image file
      await Promise.allSettled(
        alerts
          .filter((alert) => !alert.bannedPersonId)
          .map((alert) => deleteImage(ImageFolder.ALERTS, alert.imagePath)),
      );

      this.events.notifyAlertsChanged();

      this.logger.log(`Cronjob deleted ${count} alerts`);
    } catch (err) {
      this.logger.error(
        'Cronjob failed to delete alerts',
        err instanceof Error ? err.stack : String(err),
      );
    }
  }

  private withImageUrl(alert: Alert): Alert {
    const folder = alert.bannedPersonId ? ImageFolder.PEOPLE : ImageFolder.ALERTS;
    return { ...alert, imagePath: imageUrl(folder, alert.imagePath) };
  }
}
