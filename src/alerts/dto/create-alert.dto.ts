import { IsOptional, IsString, IsUUID } from "class-validator";
import { Alert } from "../../generated/prisma/client";

export class CreateAlertDto {

    @IsString()
    reason: Alert["reason"];

    @IsOptional()
    @IsUUID()
    bannedPersonId?: Alert["bannedPersonId"];
}
