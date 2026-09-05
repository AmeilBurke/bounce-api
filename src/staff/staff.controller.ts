import { Controller, Get, Post, Body, Patch, Param, Delete, Req } from '@nestjs/common';
import { StaffService } from './staff.service.js';
import { CreateStaffDto } from './dto/create-staff.dto.js';
import { Public } from '../auth/public.decorator.js';
import { RequestFrom } from '../auth/request-from.decorator.js';
import type { StaffPayload } from '../auth/staff-payload.interface.js';

@Controller('staff')
export class StaffController {
  constructor(private readonly staffService: StaffService) { }

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
  findOneByEmail(@Param('email') email: string) {
    return this.staffService.findOneByEmail(email);
  }

  // @Get(':id')
  // findOne(@Param('id') id: string) {
  //   return this.staffService.findOne(+id);
  // }

  // @Patch(':id')
  // update(@Param('id') id: string, @Body() updateStaffDto: UpdateStaffDto) {
  //   return this.staffService.update(+id, updateStaffDto);
  // }

  // @Delete(':id')
  // remove(@Param('id') id: string) {
  //   return this.staffService.remove(+id);
  // }
}
