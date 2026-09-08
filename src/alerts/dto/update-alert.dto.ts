import { PartialType } from '@nestjs/mapped-types';
import { CreateAlertsDto } from './create-alert.dto';

export class UpdateAlertDto extends PartialType(CreateAlertsDto) {}
