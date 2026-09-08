import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { CreateStaffDto } from './dto/create-staff.dto';
import { PrismaService } from '../prisma.service';
import { StaffEntity } from './staff.entity';
import * as argon2 from 'argon2';
import { Prisma, Roles, Staff } from '../generated/prisma/client';
import type { StaffPayload } from '../auth/staff-payload.interface';
import { toTitleCase } from '../utils';

@Injectable()
export class StaffService {
  constructor(private prisma: PrismaService) { }

  async create(createStaffDto: CreateStaffDto, staff?: StaffPayload): Promise<StaffEntity> {
    const staffCount = await this.prisma.staff.count();
    const isFirstAccount = staffCount === 0;

    if (!isFirstAccount) {
      if (!staff) {
        throw new UnauthorizedException();
      }

      const isAdmin = await this.isAccountAdmin(staff.id);
      if (!isAdmin) {
        throw new ForbiddenException();
      }
    }

    const hashedPassword = await argon2.hash(createStaffDto.password);

    try {
      const newStaff = await this.prisma.staff.create({
        data: {
          email: createStaffDto.email.toLowerCase().trim(),
          password: hashedPassword,
          name: toTitleCase(createStaffDto.name),
          role: isFirstAccount ? Roles.ADMIN : createStaffDto.role,
        },
      });

      return new StaffEntity(newStaff);
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        throw new ConflictException('Email already in use');
      }
      throw err;
    }
  }

  async findAll(): Promise<StaffEntity[]> {
    const allStaff = await this.prisma.staff.findMany({
      orderBy: [{ role: 'asc' }, { name: 'asc' }],
    });

    return allStaff.map((staff) => new StaffEntity(staff));
  }

  async findOneByEmail(email: string): Promise<Staff> {
    const foundStaff = await this.prisma.staff.findUnique({
      where: { email: email.toLowerCase().trim() },
    });

    if (!foundStaff) {
      throw new NotFoundException(`Staff with email ${email} not found`);
    }

    return foundStaff;
  }

  async isAccountAdmin(staffId: Staff["id"]) {
    const requestFrom = await this.prisma.staff.findUnique({
      where: {
        id: staffId
      }
    });

    return requestFrom?.role === Roles.ADMIN;
  }

  // update(id: number, updateStaffDto: UpdateStaffDto) {
  //   return `This action updates a #${id} staff`;
  // }

  // remove(id: number) {
  //   return `This action removes a #${id} staff`;
  // }
}
