import { IsEmail, IsEnum, IsString } from 'class-validator';
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
}
