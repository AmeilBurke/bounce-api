import { IsString, IsEmail } from "class-validator";
import { Staff } from "../../generated/prisma/client";

export class SignInDto {
    @IsString()
    @IsEmail()
    email: Staff["email"];

    @IsString()
    password: Staff["password"];
}