import { IsArray, IsEmail, IsEnum, IsOptional, IsString, IsUUID } from 'class-validator';
import { Role, Staff } from '../../generated/prisma/client';

export class CreateStaffDto {
  @IsEmail()
  email: Staff['email'];

  @IsString()
  password: Staff['password'];

  @IsString()
  name: Staff['name'];

  @IsEnum(Role)
  role: Staff['role'];

  @IsOptional()
  @IsArray()
  @IsUUID('all', { each: true })
  venueManages?: string[];

  @IsOptional()
  @IsArray()
  @IsUUID('all', { each: true })
  dutyManages?: string[];
}
