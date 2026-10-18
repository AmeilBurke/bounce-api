import { Module } from '@nestjs/common';
import { VenuesService } from './venues.service';
import { VenuesController } from './venues.controller';
import { PrismaService } from '../prisma.service';
import { EventsModule } from '../events/events.module';

@Module({
  controllers: [VenuesController],
  providers: [VenuesService, PrismaService],
  imports: [EventsModule]
})
export class VenuesModule {}
