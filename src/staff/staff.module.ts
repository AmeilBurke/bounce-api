import { Module } from '@nestjs/common';
import { StaffService } from './staff.service';
import { StaffController } from './staff.controller';
import { EventsModule } from '../events/events.module';

@Module({
  controllers: [StaffController],
  providers: [StaffService],
  imports: [EventsModule],
  exports: [StaffService],
})
export class StaffModule {}
