import { IsArray, IsOptional, IsString, IsUUID } from 'class-validator';
import { Transform } from 'class-transformer';
import { Venue } from '../../generated/prisma/client.js';

// multipart/form-data sends a single value as a string rather than an array
const toArray = ({ value }: { value: unknown }) =>
  value === undefined || Array.isArray(value) ? value : [value];

export class CreateVenueDto {
  @IsString()
  name: Venue["name"];

  @IsOptional()
  @Transform(toArray)
  @IsArray()
  @IsUUID('all', { each: true })
  managers?: string[];

  @IsOptional()
  @Transform(toArray)
  @IsArray()
  @IsUUID('all', { each: true })
  dutyManagers?: string[];
}
