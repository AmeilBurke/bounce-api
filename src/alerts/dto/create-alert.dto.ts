import { IsOptional, IsString, IsUUID } from 'class-validator';
import { Alert } from '../../generated/prisma/client';

export class CreateAlertDto {
  @IsString()
  reason: Alert['reason'];

  // When given, the alert uses the banned person's image instead of an upload
  @IsOptional()
  @IsUUID()
  bannedPersonId?: Alert['bannedPersonId'];
}
