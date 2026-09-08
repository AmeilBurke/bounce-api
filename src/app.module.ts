import { Module } from '@nestjs/common';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { StaffModule } from './staff/staff.module.js';
import { AuthenticationModule } from './auth/auth.module';
import { AlertsModule } from './alerts/alerts.module';
import { EventsModule } from './events/events.module.js';

@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true }), ScheduleModule.forRoot(), StaffModule, AuthenticationModule, AlertsModule, EventsModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule { }
