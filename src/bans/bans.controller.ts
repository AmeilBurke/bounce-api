import { Body, Controller, Delete, Get, Param, Patch, Post, Req } from '@nestjs/common';
import express from 'express';
import { BansService } from './bans.service';
import { CreateBanDto } from './dto/create-ban.dto';
import { UpdateBanDto } from './dto/update-ban.dto';
import { RequestFrom } from '../auth/request-from.decorator';
import type { StaffPayload } from '../auth/staff-payload.interface';
import { Ban } from '../generated/prisma/client';
import { getBaseUrl } from '../utils';

@Controller('bans')
export class BansController {
  constructor(private readonly bansService: BansService) {}

  @Post()
  create(
    @Body() createBanDto: CreateBanDto,
    @RequestFrom() staff: StaffPayload,
    @Req() req: express.Request,
  ) {
    return this.bansService.create(createBanDto, staff.id, getBaseUrl(req));
  }

  @Get()
  findAll(@Req() req: express.Request) {
    return this.bansService.findAll(getBaseUrl(req));
  }

  // Must be declared before ':id' or 'pending' would be treated as an id
  @Get('pending')
  findPending(@RequestFrom() staff: StaffPayload, @Req() req: express.Request) {
    return this.bansService.findPending(staff.id, getBaseUrl(req));
  }

  @Get(':id')
  findOne(@Param('id') id: Ban['id'], @Req() req: express.Request) {
    return this.bansService.findOne(id, getBaseUrl(req));
  }

  @Patch(':id/approve')
  approve(
    @Param('id') id: Ban['id'],
    @RequestFrom() staff: StaffPayload,
    @Req() req: express.Request,
  ) {
    return this.bansService.approve(id, staff.id, getBaseUrl(req));
  }

  @Patch(':id')
  update(
    @Param('id') id: Ban['id'],
    @Body() updateBanDto: UpdateBanDto,
    @RequestFrom() staff: StaffPayload,
    @Req() req: express.Request,
  ) {
    return this.bansService.update(id, updateBanDto, staff.id, getBaseUrl(req));
  }

  @Delete(':id')
  remove(@Param('id') id: Ban['id'], @RequestFrom() staff: StaffPayload) {
    return this.bansService.remove(id, staff.id);
  }
}
