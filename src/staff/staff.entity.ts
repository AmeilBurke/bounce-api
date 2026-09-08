// staff.entity.ts
import { Exclude } from 'class-transformer';
import { Roles } from '../generated/prisma/enums.js';

export class StaffEntity {
  id: string;
  email: string;
  name: string;
  role: Roles;

  @Exclude()
  password: string;

  constructor(partial: Partial<StaffEntity>) {
    Object.assign(this, partial);
  }
}
