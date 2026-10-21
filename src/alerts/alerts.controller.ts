import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { AlertsService } from './alerts.service';
import { CreateAlertDto } from './dto/create-alert.dto';
import { RequestFrom } from '../auth/request-from.decorator';
import type { StaffPayload } from '../auth/staff-payload.interface';
import { Alert } from '../generated/prisma/client';
import { ImageUpload } from '../utils';

@Controller('alerts')
export class AlertsController {
  constructor(private readonly alertsService: AlertsService) {}

  @UseInterceptors(ImageUpload())
  @Post()
  create(
    @Body() createAlertDto: CreateAlertDto,
    @RequestFrom() staff: StaffPayload,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    return this.alertsService.create(createAlertDto, staff.id, file);
  }

  @Get()
  findAll() {
    return this.alertsService.findAll();
  }

  @Delete(':id')
  remove(@Param('id') id: Alert['id'], @RequestFrom() staff: StaffPayload) {
    return this.alertsService.remove(id, staff.id);
  }
}
