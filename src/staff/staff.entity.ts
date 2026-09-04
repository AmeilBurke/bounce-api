// staff.entity.ts
import { Exclude } from 'class-transformer';
import { Role } from '../generated/prisma/enums.js';

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
