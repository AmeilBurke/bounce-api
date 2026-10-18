import {
  BadRequestException,
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
import { Prisma, Role, Staff } from '../generated/prisma/client';
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

    const role = isFirstAccount ? Role.ADMIN : createStaffDto.role;
    const venueIds = [...new Set(createStaffDto.venueManages ?? [])];
    const dutyVenueIds = [...new Set(createStaffDto.dutyManages ?? [])];

    if (venueIds.length > 0 && role !== Role.VENUE_MANAGER) {
      throw new BadRequestException('Only venue managers can be assigned venues to manage');
    }

    if (
      dutyVenueIds.length > 0 &&
      role !== Role.VENUE_MANAGER &&
      role !== Role.DUTY_MANAGER
    ) {
      throw new BadRequestException(
        'Only venue managers and duty managers can be assigned venues to duty manage',
      );
    }

    try {
      const newStaff = await this.prisma.staff.create({
        data: {
          email: createStaffDto.email.toLowerCase().trim(),
          password: await argon2.hash(createStaffDto.password),
          name: toTitleCase(createStaffDto.name),
          role,
          venueManages: {
            create: venueIds.map((venueId) => ({ venueId })),
          },
          dutyManages: {
            create: dutyVenueIds.map((venueId) => ({ venueId })),
          },
        },
      });

      this.events.notifyStaffChanged();

      return new StaffEntity(newStaff);
    } catch (err) {
      console.log(err);

      if (err instanceof Prisma.PrismaClientKnownRequestError) {
        if (err.code === 'P2002') {
          throw new ConflictException('Email already in use');
        }
        if (err.code === 'P2003') {
          throw new BadRequestException('One or more venues do not exist');
        }
      }
      throw err;
    }
  }

  async findAll(): Promise<StaffEntity[]> {
    const allStaff = await this.prisma.staff.findMany({
      orderBy: [{ role: 'asc' }, { name: 'asc' }],
      include: {
        venueManages: true,
        dutyManages: true
      }
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

    if (!isAdmin && updateStaffDto.role !== undefined) {
      throw new ForbiddenException('Only admins can change roles');
    }

    if (
      !isAdmin &&
      (updateStaffDto.venueManages !== undefined || updateStaffDto.dutyManages !== undefined)
    ) {
      throw new ForbiddenException('Only admins can change venue assignments');
    }

    const target = await this.prisma.staff.findUnique({
      where: { id },
      select: { role: true },
    });
    if (!target) {
      throw new NotFoundException('Staff not found');
    }

    if (updateStaffDto.role && updateStaffDto.role !== Role.ADMIN && target.role === Role.ADMIN) {
      const adminCount = await this.prisma.staff.count({
        where: { role: Role.ADMIN },
      });
      if (adminCount <= 1) {
        throw new BadRequestException('The last admin account cannot be demoted');
      }
    }

    const newRole = updateStaffDto.role ?? target.role;
    const roleChanged = newRole !== target.role;

    // undefined = leave untouched, array = replace the full set
    let venueIds =
      updateStaffDto.venueManages !== undefined
        ? [...new Set(updateStaffDto.venueManages)]
        : undefined;
    let dutyVenueIds =
      updateStaffDto.dutyManages !== undefined
        ? [...new Set(updateStaffDto.dutyManages)]
        : undefined;

    const canManageVenues = newRole === Role.VENUE_MANAGER;
    const canDutyManage = newRole === Role.VENUE_MANAGER || newRole === Role.DUTY_MANAGER;

    if (venueIds && venueIds.length > 0 && !canManageVenues) {
      throw new BadRequestException('Only venue managers can be assigned venues to manage');
    }

    if (dutyVenueIds && dutyVenueIds.length > 0 && !canDutyManage) {
      throw new BadRequestException(
        'Only venue managers and duty managers can be assigned venues to duty manage',
      );
    }

    // Role changed to one that no longer allows existing assignments: clear them
    if (roleChanged && !canManageVenues) {
      venueIds = [];
    }
    if (roleChanged && !canDutyManage) {
      dutyVenueIds = [];
    }

    try {
      const updatedStaff = await this.prisma.staff.update({
        where: { id },
        data: {
          email: updateStaffDto.email ? updateStaffDto.email.toLowerCase().trim() : undefined,
          password: updateStaffDto.password
            ? await argon2.hash(updateStaffDto.password)
            : undefined,
          name: updateStaffDto.name ? toTitleCase(updateStaffDto.name) : undefined,
          role: updateStaffDto.role ? updateStaffDto.role : undefined,
          venueManages:
            venueIds !== undefined
              ? {
                deleteMany: {},
                create: venueIds.map((venueId) => ({ venueId })),
              }
              : undefined,
          dutyManages:
            dutyVenueIds !== undefined
              ? {
                deleteMany: {},
                create: dutyVenueIds.map((venueId) => ({ venueId })),
              }
              : undefined,
        },
      });
      this.events.notifyStaffChanged();

      return new StaffEntity(updatedStaff);
    } catch (err) {
      console.log(err);

      if (err instanceof Prisma.PrismaClientKnownRequestError) {
        if (err.code === 'P2002') {
          throw new ConflictException('Email already in use');
        }
        if (err.code === 'P2003') {
          throw new BadRequestException('One or more venues do not exist');
        }
        if (err.code === 'P2025') {
          throw new NotFoundException('Staff not found');
        }
      }
      throw err;
    }
  }

  async remove(id: Staff['id'], staff: StaffPayload) {
    const isAdmin = await isAccountAdmin(this.prisma, staff.id);
    if (!isAdmin) {
      throw new ForbiddenException();
    }

    if (id === staff.id) {
      throw new BadRequestException('You cannot delete your own account');
    }

    try {
      const deletedAccount = await this.prisma.$transaction(async (tx) => {
        await tx.alert.updateMany({
          where: { createdById: id },
          data: { createdById: staff.id },
        });

        await tx.venueManager.deleteMany({ where: { staffId: id } });
        await tx.dutyManager.deleteMany({ where: { staffId: id } });

        return tx.staff.delete({ where: { id } });
      });

      this.events.notifyStaffChanged();
      this.events.notifyStaffDeleted(deletedAccount.id);

      return `Deleted account of ${deletedAccount.name}`;
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2025') {
        throw new NotFoundException('Staff not found');
      }
      throw err;
    }
  }
}
