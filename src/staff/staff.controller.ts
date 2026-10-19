import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import { StaffService } from './staff.service';
import { CreateStaffDto } from './dto/create-staff.dto';
import { UpdateStaffDto } from './dto/update-staff.dto';
import { StaffEntity } from './staff.entity';
import { Public } from '../auth/public.decorator';
import { RequestFrom } from '../auth/request-from.decorator';
import type { StaffPayload } from '../auth/staff-payload.interface';
import { Staff } from '../generated/prisma/client';

@Controller('staff')
export class StaffController {
  constructor(private readonly staffService: StaffService) {}

  @Public()
  @Get('is-setup-complete')
  isInitialSetupComplete() {
    return this.staffService.isInitialSetupComplete();
  }

  // Public so the very first admin account can be created; the service checks it otherwise
  @Public()
  @Post()
  create(@Body() createStaffDto: CreateStaffDto, @RequestFrom() staff?: StaffPayload) {
    return this.staffService.create(createStaffDto, staff?.id);
  }

  @Get()
  findAll() {
    return this.staffService.findAll();
  }

  @Get(':email')
  async findOneByEmail(@Param('email') email: Staff['email']) {
    return new StaffEntity(await this.staffService.findOneByEmail(email));
  }

  @Patch(':id')
  update(
    @Param('id') id: Staff['id'],
    @Body() updateStaffDto: UpdateStaffDto,
    @RequestFrom() staff: StaffPayload,
  ) {
    return this.staffService.update(id, updateStaffDto, staff.id);
  }

  @Delete(':id')
  remove(@Param('id') id: Staff['id'], @RequestFrom() staff: StaffPayload) {
    return this.staffService.remove(id, staff.id);
  }
}
