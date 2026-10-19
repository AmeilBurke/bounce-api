import { IsArray, IsOptional, IsString, IsUUID } from 'class-validator';
import { Venue } from '../../generated/prisma/client';

export class CreateVenueDto {
  @IsString()
  name: Venue['name'];

  @IsOptional()
  @IsArray()
  @IsUUID('all', { each: true })
  managers?: string[];

  @IsOptional()
  @IsArray()
  @IsUUID('all', { each: true })
  dutyManagers?: string[];
}
