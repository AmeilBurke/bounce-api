import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma.module';
import { EventsModule } from './events/events.module';
import { AuthenticationModule } from './auth/auth.module';
import { StaffModule } from './staff/staff.module';
import { AlertsModule } from './alerts/alerts.module';
import { VenuesModule } from './venues/venues.module';
import { BannedPeopleModule } from './banned-people/banned-people.module';
import { BansModule } from './bans/bans.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ScheduleModule.forRoot(),
    PrismaModule,
    EventsModule,
    AuthenticationModule,
    StaffModule,
    AlertsModule,
    VenuesModule,
    BannedPeopleModule,
    BansModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
