import { Staff } from "../generated/prisma/client";

export interface StaffPayload {
    id: Staff["id"];
    email: Staff["email"];
    name: Staff["name"];
    role: Staff["role"];
    iat: number;
}