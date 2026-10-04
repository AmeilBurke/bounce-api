import { Module } from '@nestjs/common';
import { StaffService } from './staff.service.js';
import { StaffController } from './staff.controller.js';
import { PrismaService } from '../prisma.service.js';
import { EventsModule } from '../events/events.module.js';

@Module({
  controllers: [StaffController],
  providers: [StaffService, PrismaService],
  exports: [StaffService],
  imports: [EventsModule]
})
export class StaffModule { }
