import { IsNumber, IsOptional, IsString } from "class-validator";
import { Alerts } from "../../generated/prisma/client";

export class CreateAlertsDto {

    @IsString()
    reason: Alerts["reason"];

    @IsOptional()
    @IsNumber()
    personId?: Alerts["personId"];
}
