import { IsArray, IsEmail, IsEnum, IsOptional, IsString, IsUUID } from 'class-validator';
import { Role } from '../../generated/prisma/enums.js';
import { DutyManager, Staff, VenueManager } from '../../generated/prisma/client.js';

export class UpdateStaffDto {
  @IsOptional()
  @IsEmail()
  email: Staff["email"];

  @IsOptional()
  @IsString()
  password: Staff["password"];

  @IsOptional()
  @IsString()
  name: Staff["name"];

  @IsOptional()
  @IsEnum
    (Role)
  role: Staff["role"];

  @IsOptional()
  @IsArray()
  @IsUUID('all', { each: true })
  venueManages?: string[];

  @IsOptional()
  @IsArray()
  @IsUUID('all', { each: true })
  dutyManages?: DutyManager[];
}
