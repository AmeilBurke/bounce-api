import { PartialType } from '@nestjs/mapped-types';
import { CreateBannedPersonDto } from './create-banned-person.dto';

export class UpdateBannedPersonDto extends PartialType(CreateBannedPersonDto) {}
