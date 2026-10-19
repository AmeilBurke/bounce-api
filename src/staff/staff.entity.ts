import { Exclude } from 'class-transformer';
import { Role } from '../generated/prisma/client';

// Returned instead of the raw Staff model so the password hash is never sent
export class StaffEntity {
  id: string;
  email: string;
  name: string;
  role: Role;

  @Exclude()
  password: string;

  constructor(partial: Partial<StaffEntity>) {
    Object.assign(this, partial);
  }
}
