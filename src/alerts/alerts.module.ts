import { Module } from '@nestjs/common';
import { AlertsService } from './alerts.service';
import { AlertsController } from './alerts.controller';
import { EventsModule } from '../events/events.module';

@Module({
  controllers: [AlertsController],
  providers: [AlertsService],
  imports: [EventsModule],
})
export class AlertsModule {}
