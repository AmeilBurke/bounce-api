import { Module } from '@nestjs/common';
import { BansService } from './bans.service';
import { BansController } from './bans.controller';
import { EventsModule } from '../events/events.module';

@Module({
  controllers: [BansController],
  providers: [BansService],
  imports: [EventsModule],
})
export class BansModule {}
