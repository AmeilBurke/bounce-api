import {
  ArrayNotEmpty,
  IsArray,
  IsDateString,
  IsOptional,
  IsString,
  IsUUID,
} from 'class-validator';
import { Ban } from '../../generated/prisma/client';

export class CreateBanDto {
  @IsString()
  reason: Ban['reason'];

  // Defaults to now when not given
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @IsDateString()
  endDate: string;

  @IsUUID()
  bannedPersonId: Ban['bannedPersonId'];

  @IsArray()
  @ArrayNotEmpty()
  @IsUUID('all', { each: true })
  venueIds: string[];
}
