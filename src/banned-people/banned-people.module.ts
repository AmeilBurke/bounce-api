import { Module } from '@nestjs/common';
import { BannedPeopleService } from './banned-people.service';
import { BannedPeopleController } from './banned-people.controller';
import { EventsModule } from '../events/events.module';

@Module({
  controllers: [BannedPeopleController],
  providers: [BannedPeopleService],
  imports: [EventsModule],
})
export class BannedPeopleModule {}
