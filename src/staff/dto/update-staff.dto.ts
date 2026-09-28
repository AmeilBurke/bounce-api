import { IsEmail, IsEnum, IsOptional, IsString } from 'class-validator';
import { Roles } from '../../generated/prisma/enums.js';
import { Staff } from '../../generated/prisma/client.js';

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
    (Roles)
  role: Staff["role"];
}
