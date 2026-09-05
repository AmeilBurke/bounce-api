import { IsNumber, IsOptional, IsString } from "class-validator";
import { Alert } from "../../generated/prisma/client";

export class CreateAlertDto {

    @IsNumber()
    reason: Alert["reason"];

    @IsString()
    imagePath: Alert["imagePath"];

    @IsNumber()
    createdById: Alert["id"];

    @IsOptional()
    @IsNumber()
    personId?: Alert["personId"];
}
