import { IsString } from 'class-validator';
import { BannedPerson } from '../../generated/prisma/client';

export class CreateBannedPersonDto {
  @IsString()
  name: BannedPerson['name'];
}
