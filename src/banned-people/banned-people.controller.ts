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
import { BannedPeopleService } from './banned-people.service';
import { CreateBannedPersonDto } from './dto/create-banned-person.dto';
import { UpdateBannedPersonDto } from './dto/update-banned-person.dto';
import { RequestFrom } from '../auth/request-from.decorator';
import type { StaffPayload } from '../auth/staff-payload.interface';
import { BannedPerson, Venue } from '../generated/prisma/client';
import { getBaseUrl, ImageUpload } from '../utils';

@Controller('banned-people')
export class BannedPeopleController {
  constructor(private readonly bannedPeopleService: BannedPeopleService) {}

  @UseInterceptors(ImageUpload())
  @Post()
  create(
    @Body() createBannedPersonDto: CreateBannedPersonDto,
    @Req() req: express.Request,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    return this.bannedPeopleService.create(createBannedPersonDto, file, getBaseUrl(req));
  }

  @Get()
  findAll(@Req() req: express.Request) {
    return this.bannedPeopleService.findAll(getBaseUrl(req));
  }

  // These must be declared before ':id' or their paths would be treated as an id
  @Get('venue/:venueId')
  findAtVenue(@Param('venueId') venueId: Venue['id'], @Req() req: express.Request) {
    return this.bannedPeopleService.findAtVenue(venueId, getBaseUrl(req));
  }

  @Get('blanket')
  findBlanketBanned(@Req() req: express.Request) {
    return this.bannedPeopleService.findBlanketBanned(getBaseUrl(req));
  }

  @Get('names')
  findNames() {
    return this.bannedPeopleService.findNames();
  }

  @Get(':id')
  findOne(@Param('id') id: BannedPerson['id'], @Req() req: express.Request) {
    return this.bannedPeopleService.findOne(id, getBaseUrl(req));
  }

  @UseInterceptors(ImageUpload())
  @Patch(':id')
  update(
    @Param('id') id: BannedPerson['id'],
    @Body() updateBannedPersonDto: UpdateBannedPersonDto,
    @RequestFrom() staff: StaffPayload,
    @Req() req: express.Request,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    return this.bannedPeopleService.update(
      id,
      updateBannedPersonDto,
      staff.id,
      file,
      getBaseUrl(req),
    );
  }

  @Delete(':id')
  remove(@Param('id') id: BannedPerson['id'], @RequestFrom() staff: StaffPayload) {
    return this.bannedPeopleService.remove(id, staff.id);
  }
}
