import { Controller, Get, Post, Body, Patch, Param, Delete, Req } from '@nestjs/common';
import { StaffService } from './staff.service.js';
import { CreateStaffDto } from './dto/create-staff.dto.js';
import { Public } from '../auth/public.decorator.js';
import { RequestFrom } from '../auth/request-from.decorator.js';
import type { StaffPayload } from '../auth/staff-payload.interface.js';
import { UpdateStaffDto } from './dto/update-staff.dto.js';
import { Staff } from '../generated/prisma/client.js';

@Controller('staff')
export class StaffController {
  constructor(private readonly staffService: StaffService) { }

  @Public()
  @Get('is-setup-complete')
  isinitialSetupComplete() {
    return this.staffService.isInitialSetupComplete();
  }

  @Public()
  @Post()
  create(
    @Body() createStaffDto: CreateStaffDto,
    @RequestFrom() staff?: StaffPayload
  ) {
    return this.staffService.create(createStaffDto, staff);
  }

  @Get()
  findAll() {
    return this.staffService.findAll();
  }

  @Get(':email')
  findOneByEmail(@Param('email') email: Staff["email"]) {
    return this.staffService.findOneByEmail(email);
  }

  // @Get(':id')
  // findOne(@Param('id') id: string) {
  //   return this.staffService.findOne(+id);
  // }

  @Patch(':id')
  update(@Param('id') id: Staff["id"], @Body() updateStaffDto: UpdateStaffDto, @RequestFrom() staff: StaffPayload) {
    return this.staffService.update(id, updateStaffDto, staff);
  }

  @Delete(':id')
  remove(@Param('id') id: Staff["id"], @RequestFrom() staff: StaffPayload) {
    return this.staffService.remove(id, staff);
  }
}
