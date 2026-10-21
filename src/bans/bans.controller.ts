import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import { BansService } from './bans.service';
import { CreateBanDto } from './dto/create-ban.dto';
import { UpdateBanDto } from './dto/update-ban.dto';
import { RequestFrom } from '../auth/request-from.decorator';
import type { StaffPayload } from '../auth/staff-payload.interface';
import { Ban } from '../generated/prisma/client';

@Controller('bans')
export class BansController {
  constructor(private readonly bansService: BansService) {}

  @Post()
  create(
    @Body() createBanDto: CreateBanDto,
    @RequestFrom() staff: StaffPayload,
  ) {
    return this.bansService.create(createBanDto, staff.id);
  }

  @Get()
  findAll() {
    return this.bansService.findAll();
  }

  // Must be declared before ':id' or 'pending' would be treated as an id
  @Get('pending')
  findPending(@RequestFrom() staff: StaffPayload) {
    return this.bansService.findPending(staff.id);
  }

  @Get(':id')
  findOne(@Param('id') id: Ban['id']) {
    return this.bansService.findOne(id);
  }

  @Patch(':id/approve')
  approve(
    @Param('id') id: Ban['id'],
    @RequestFrom() staff: StaffPayload,
  ) {
    return this.bansService.approve(id, staff.id);
  }

  @Patch(':id')
  update(
    @Param('id') id: Ban['id'],
    @Body() updateBanDto: UpdateBanDto,
    @RequestFrom() staff: StaffPayload,
  ) {
    return this.bansService.update(id, updateBanDto, staff.id);
  }

  @Delete(':id')
  remove(@Param('id') id: Ban['id'], @RequestFrom() staff: StaffPayload) {
    return this.bansService.remove(id, staff.id);
  }
}
