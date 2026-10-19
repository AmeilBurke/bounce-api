import { OmitType, PartialType } from '@nestjs/mapped-types';
import { CreateBanDto } from './create-ban.dto';

// A ban can't be moved to a different person
export class UpdateBanDto extends PartialType(
  OmitType(CreateBanDto, ['bannedPersonId'] as const),
) {}
