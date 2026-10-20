import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import { VenuesService } from './venues.service';
import { CreateVenueDto } from './dto/create-venue.dto';
import { UpdateVenueDto } from './dto/update-venue.dto';
import { RequestFrom } from '../auth/request-from.decorator';
import type { StaffPayload } from '../auth/staff-payload.interface';
import { Venue } from '../generated/prisma/client';

@Controller('venues')
export class VenuesController {
  constructor(private readonly venuesService: VenuesService) {}

  @Post()
  create(@Body() createVenueDto: CreateVenueDto, @RequestFrom() staff: StaffPayload) {
    return this.venuesService.create(createVenueDto, staff.id);
  }

  @Get()
  findAll(@RequestFrom() staff: StaffPayload) {
    return this.venuesService.findAll(staff.id);
  }

  @Get(':id')
  findOne(@Param('id') id: Venue['id'], @RequestFrom() staff: StaffPayload) {
    return this.venuesService.findOne(id, staff.id);
  }

  @Patch(':id')
  update(
    @Param('id') id: Venue['id'],
    @Body() updateVenueDto: UpdateVenueDto,
    @RequestFrom() staff: StaffPayload,
  ) {
    return this.venuesService.update(id, updateVenueDto, staff.id);
  }

  @Delete(':id')
  remove(@Param('id') id: Venue['id'], @RequestFrom() staff: StaffPayload) {
    return this.venuesService.remove(id, staff.id);
  }
}
