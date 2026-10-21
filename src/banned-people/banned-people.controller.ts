import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { BannedPeopleService } from './banned-people.service';
import { CreateBannedPersonDto } from './dto/create-banned-person.dto';
import { UpdateBannedPersonDto } from './dto/update-banned-person.dto';
import { RequestFrom } from '../auth/request-from.decorator';
import type { StaffPayload } from '../auth/staff-payload.interface';
import { BannedPerson, Venue } from '../generated/prisma/client';
import { ImageUpload } from '../utils';

@Controller('banned-people')
export class BannedPeopleController {
  constructor(private readonly bannedPeopleService: BannedPeopleService) {}

  @UseInterceptors(ImageUpload())
  @Post()
  create(
    @Body() createBannedPersonDto: CreateBannedPersonDto,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    return this.bannedPeopleService.create(createBannedPersonDto, file);
  }

  @Get()
  findAll() {
    return this.bannedPeopleService.findAll();
  }

  // These must be declared before ':id' or their paths would be treated as an id
  @Get('venue/:venueId')
  findAtVenue(@Param('venueId') venueId: Venue['id']) {
    return this.bannedPeopleService.findAtVenue(venueId);
  }

  @Get('blanket')
  findBlanketBanned() {
    return this.bannedPeopleService.findBlanketBanned();
  }

  @Get('names')
  findNames() {
    return this.bannedPeopleService.findNames();
  }

  @Get(':id')
  findOne(@Param('id') id: BannedPerson['id']) {
    return this.bannedPeopleService.findOne(id);
  }

  @UseInterceptors(ImageUpload())
  @Patch(':id')
  update(
    @Param('id') id: BannedPerson['id'],
    @Body() updateBannedPersonDto: UpdateBannedPersonDto,
    @RequestFrom() staff: StaffPayload,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    return this.bannedPeopleService.update(
      id,
      updateBannedPersonDto,
      staff.id,
      file,
    );
  }

  @Delete(':id')
  remove(@Param('id') id: BannedPerson['id'], @RequestFrom() staff: StaffPayload) {
    return this.bannedPeopleService.remove(id, staff.id);
  }
}
