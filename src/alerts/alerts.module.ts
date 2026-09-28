import { Module } from '@nestjs/common';
import { AlertsService } from './alerts.service';
import { AlertsController } from './alerts.controller';
import { PrismaService } from '../prisma.service';
import { EventsModule } from '../events/events.module';

@Module({
  controllers: [AlertsController],
  providers: [AlertsService, PrismaService],
  imports: [EventsModule]
})
export class AlertsModule {}
