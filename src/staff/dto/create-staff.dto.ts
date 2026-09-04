import { IsEmail, IsEnum, IsString } from 'class-validator';
import { Role } from '../../generated/prisma/enums.js';

export class CreateStaffDto {
  @IsEmail()
  email: string;

  @IsString()
  password: string;

  @IsString()
  name: string;

  @IsEnum(Role)
  role: Role;
}
