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
import { isAccountAdmin, toTitleCase } from '../utils';
import { UpdateStaffDto } from './dto/update-staff.dto';
import { EventsGateway } from '../events/events.gateway';

@Injectable()
export class StaffService {
  constructor(private prisma: PrismaService, private events: EventsGateway) { }

  async isInitialSetupComplete(): Promise<boolean> {
    return (await this.prisma.staff.count()) > 0;
  }

  async create(createStaffDto: CreateStaffDto, staff?: StaffPayload): Promise<StaffEntity> {
    const staffCount = await this.prisma.staff.count();
    const isFirstAccount = staffCount === 0;

    if (!isFirstAccount) {
      if (!staff) {
        throw new UnauthorizedException();
      }

      const isAdmin = await isAccountAdmin(this.prisma, staff.id);
      if (!isAdmin) {
        throw new ForbiddenException();
      }
    }

    try {
      const newStaff = await this.prisma.staff.create({
        data: {
          email: createStaffDto.email.toLowerCase().trim(),
          password: await argon2.hash(createStaffDto.password),
          name: toTitleCase(createStaffDto.name),
          role: isFirstAccount ? Roles.ADMIN : createStaffDto.role,
        },
      });

      this.events.notifyStaffChanged();

      return new StaffEntity(newStaff);
    } catch (err) {
      console.log(err);

      // need to figure out what to return when this happens
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

  async findOneByEmail(email: Staff['email']): Promise<Staff> {
    const foundStaff = await this.prisma.staff.findUnique({
      where: { email: email.toLowerCase().trim() },
    });

    if (!foundStaff) {
      throw new NotFoundException(`Staff with email ${email} not found`);
    }

    return foundStaff;
  }

  async update(id: Staff['id'], updateStaffDto: UpdateStaffDto, staff: StaffPayload) {

    const isAdmin = await isAccountAdmin(this.prisma, staff.id);
    if (!isAdmin && staff.id !== id) {
      throw new ForbiddenException();
    }

    try {
      const updatedStaff = await this.prisma.staff.update({
        where: {
          id: id,
        },
        data: {
          email: updateStaffDto.email ? updateStaffDto.email.toLowerCase().trim() : undefined,
          password: updateStaffDto.password
            ? await argon2.hash(updateStaffDto.password)
            : undefined,
          name: updateStaffDto.name ? toTitleCase(updateStaffDto.name) : undefined,
          role: updateStaffDto.role ? updateStaffDto.role : undefined,
        },
      });
      this.events.notifyStaffChanged();

      return new StaffEntity(updatedStaff);
    } catch (err) {
      console.log(err);
      throw err;
    }
  }

  // need to remove account & link anything to them back to admin doing deleting
  async remove(id: Staff['id'], staff: StaffPayload) {
    const isAdmin = await isAccountAdmin(this.prisma, staff.id);
    if (!isAdmin) {
      throw new ForbiddenException();
    }

    await this.prisma.alerts.updateMany({
      where: {
        createdById: id,
      },
      data: {
        createdById: staff.id,
      },
    });

    const deletedAccount = await this.prisma.staff.delete({
      where: {
        id: id,
      },
    });

    this.events.notifyStaffChanged();

    this.events.notifyStaffDeleted(deletedAccount.id);

    return `Deleted account of ${deletedAccount.name}`;
  }
}
