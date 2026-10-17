import { IsNumber, IsOptional, IsString } from "class-validator";
import { Alert } from "../../generated/prisma/client";

export class CreateAlertDto {

    @IsString()
    reason: Alert["reason"];

    @IsOptional()
    @IsNumber()
    bannedPersonId?: Alert["bannedPersonId"];
}
