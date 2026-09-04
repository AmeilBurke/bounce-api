import { Module } from '@nestjs/common';
import { StaffService } from './staff.service.js';
import { StaffController } from './staff.controller.js';
import { PrismaService } from '../prisma.service.js';

@Module({
  controllers: [StaffController],
  providers: [StaffService, PrismaService],
  exports: [StaffService]
})
export class StaffModule { }
