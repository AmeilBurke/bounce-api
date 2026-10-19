import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Req,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import express from 'express';
import { VenuesService } from './venues.service';
import { CreateVenueDto } from './dto/create-venue.dto';
import { UpdateVenueDto } from './dto/update-venue.dto';
import { RequestFrom } from '../auth/request-from.decorator';
import type { StaffPayload } from '../auth/staff-payload.interface';
import { Venue } from '../generated/prisma/client';
import { getBaseUrl, ImageUpload } from '../utils';

@Controller('venues')
export class VenuesController {
  constructor(private readonly venuesService: VenuesService) {}

  @UseInterceptors(ImageUpload())
  @Post()
  create(
    @Body() createVenueDto: CreateVenueDto,
    @RequestFrom() staff: StaffPayload,
    @Req() req: express.Request,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    return this.venuesService.create(createVenueDto, staff.id, file, getBaseUrl(req));
  }

  @Get()
  findAll(@RequestFrom() staff: StaffPayload, @Req() req: express.Request) {
    return this.venuesService.findAll(staff.id, getBaseUrl(req));
  }

  // Must be declared before ':id' or 'ids' would be treated as an id
  @Get('ids')
  findAllIds() {
    return this.venuesService.findAllIds();
  }

  @Get(':id')
  findOne(
    @Param('id') id: Venue['id'],
    @RequestFrom() staff: StaffPayload,
    @Req() req: express.Request,
  ) {
    return this.venuesService.findOne(id, staff.id, getBaseUrl(req));
  }

  @UseInterceptors(ImageUpload())
  @Patch(':id')
  update(
    @Param('id') id: Venue['id'],
    @Body() updateVenueDto: UpdateVenueDto,
    @RequestFrom() staff: StaffPayload,
    @Req() req: express.Request,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    return this.venuesService.update(id, updateVenueDto, staff.id, file, getBaseUrl(req));
  }

  @Delete(':id')
  remove(@Param('id') id: Venue['id'], @RequestFrom() staff: StaffPayload) {
    return this.venuesService.remove(id, staff.id);
  }
}
