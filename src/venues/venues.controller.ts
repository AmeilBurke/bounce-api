import { Controller, Get, Post, Body, Patch, Param, Delete, UseInterceptors, UploadedFile, Req } from '@nestjs/common';
import { VenuesService } from './venues.service';
import { CreateVenueDto } from './dto/create-venue.dto';
import { UpdateVenueDto } from './dto/update-venue.dto';
import { RequestFrom } from '../auth/request-from.decorator';
import type { StaffPayload } from '../auth/staff-payload.interface';
import { FileInterceptor } from '@nestjs/platform-express';
import multer from "multer";
import { v4 as uuidv4 } from "uuid";
import { getBaseUrl, imageFileValidator } from '../utils';
import express from "express";
import { Venue } from '../generated/prisma/client';

const imageUpload = FileInterceptor("image", {
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
});

@Controller('venues')
export class VenuesController {
  constructor(private readonly venuesService: VenuesService) { }

  @UseInterceptors(imageUpload)
  @Post()
  create(@Body() createVenueDto: CreateVenueDto, @RequestFrom() staff: StaffPayload, @Req() req: express.Request, @UploadedFile() file: Express.Multer.File) {
    const baseUrl = getBaseUrl(req);
    return this.venuesService.create(createVenueDto, staff.id, file, baseUrl);
  }

  @Get()
  findAll(@Req() req: express.Request) {
    const baseUrl = getBaseUrl(req);
    return this.venuesService.findAll(baseUrl);
  }

  @Get(':id')
  findOne(@Param('id') id: Venue["id"], @Req() req: express.Request) {
    const baseUrl = getBaseUrl(req);
    return this.venuesService.findOne(id, baseUrl);
  }

  @UseInterceptors(imageUpload)
  @Patch(':id')
  update(@Param('id') id: Venue["id"], @Body() updateVenueDto: UpdateVenueDto, @RequestFrom() staff: StaffPayload, @Req() req: express.Request, @UploadedFile() file?: Express.Multer.File) {
    const baseUrl = getBaseUrl(req);
    return this.venuesService.update(id, updateVenueDto, staff.id, file, baseUrl);
  }

  @Delete(':id')
  remove(@Param('id') id: Venue["id"], @RequestFrom() staff: StaffPayload) {
    return this.venuesService.remove(id, staff.id);
  }
}
