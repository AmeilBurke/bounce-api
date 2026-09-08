import { Controller, Get, Post, Body, Patch, Param, Delete, UseInterceptors, UploadedFile, Req } from '@nestjs/common';
import { AlertsService } from './alerts.service';
import { CreateAlertsDto } from './dto/create-alert.dto';
import { UpdateAlertDto } from './dto/update-alert.dto';
import { RequestFrom } from '../auth/request-from.decorator';
import type { StaffPayload } from '../auth/staff-payload.interface';
import { FileInterceptor } from '@nestjs/platform-express';
import multer from "multer";
import { v4 as uuidv4 } from "uuid";
import { getBaseUrl, imageFileValidator } from '../utils';
import express from "express";

@Controller('alerts')
export class AlertsController {
  constructor(private readonly alertsService: AlertsService) { }

  @UseInterceptors(
    FileInterceptor("image", {
      limits: {
        files: 1,
      },
      storage: multer.diskStorage({
        destination: "uploads/uncompressed",
        filename: (req, file, callback) => {
          callback(null, `${uuidv4()}`);
        },
      }),
      fileFilter(req, file, callback) {
        imageFileValidator(file, callback);
      },
    }),
  )
  @Post()
  create(@Body() createAlertsDto: CreateAlertsDto, @RequestFrom() staff: StaffPayload, @Req() req: express.Request, @UploadedFile() file: Express.Multer.File,) {
    const baseUrl = getBaseUrl(req);
    return this.alertsService.create(createAlertsDto, staff.id, file, baseUrl);
  }

  @Get()
  findAll() {
    return this.alertsService.findAll();
  }

  // @Get(':id')
  // findOne(@Param('id') id: string) {
  //   return this.alertsService.findOne(+id);
  // }

  // @Patch(':id')
  // update(@Param('id') id: string, @Body() updateAlertDto: UpdateAlertDto) {
  //   return this.alertsService.update(+id, updateAlertDto);
  // }

  // @Delete(':id')
  // remove(@Param('id') id: string) {
  //   return this.alertsService.remove(+id);
  // }
}
