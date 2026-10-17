import { IsArray, IsEmail, IsEnum, IsOptional, IsString, IsUUID } from 'class-validator';
import { Role } from '../../generated/prisma/enums.js';
import { Staff } from '../../generated/prisma/client.js';

export class CreateStaffDto {
  @IsEmail()
  email: Staff["email"];

  @IsString()
  password: Staff["password"];

  @IsString()
  name: Staff["name"];

  @IsEnum(Role)
  role: Staff["role"];

  @IsOptional()
  @IsArray()
  @IsUUID('all', { each: true })
  venueManages?: string[];

  @IsOptional()
  @IsArray()
  @IsUUID('all', { each: true })
  dutyManages?: string[];
}
