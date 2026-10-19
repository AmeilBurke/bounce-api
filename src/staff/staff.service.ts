import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import * as argon2 from 'argon2';
import { CreateStaffDto } from './dto/create-staff.dto';
import { UpdateStaffDto } from './dto/update-staff.dto';
import { StaffEntity } from './staff.entity';
import { PrismaService } from '../prisma.service';
import { EventsGateway } from '../events/events.gateway';
import { Prisma, Role, Staff } from '../generated/prisma/client';
import { assertAdmin, isAccountAdmin, toTitleCase, uniqueIds } from '../utils';

@Injectable()
export class StaffService {
  constructor(
    private prisma: PrismaService,
    private events: EventsGateway,
  ) {}

  async isInitialSetupComplete(): Promise<boolean> {
    return (await this.prisma.staff.count()) > 0;
  }

  async create(createStaffDto: CreateStaffDto, staffId?: Staff['id']): Promise<StaffEntity> {
    const isFirstAccount = !(await this.isInitialSetupComplete());

    // Anyone can create the first account, which is always an admin
    if (!isFirstAccount) {
      if (!staffId) {
        throw new UnauthorizedException();
      }
      await assertAdmin(this.prisma, staffId);
    }

    const role = isFirstAccount ? Role.ADMIN : createStaffDto.role;
    const venueIds = uniqueIds(createStaffDto.venueManages) ?? [];
    const dutyVenueIds = uniqueIds(createStaffDto.dutyManages) ?? [];

    this.assertAssignable(role, venueIds, dutyVenueIds);

    try {
      const newStaff = await this.prisma.staff.create({
        data: {
          email: createStaffDto.email.toLowerCase().trim(),
          password: await argon2.hash(createStaffDto.password),
          name: toTitleCase(createStaffDto.name),
          role,
          venueManages: { create: venueIds.map((venueId) => ({ venueId })) },
          dutyManages: { create: dutyVenueIds.map((venueId) => ({ venueId })) },
        },
      });

      this.events.notifyStaffChanged();

      return new StaffEntity(newStaff);
    } catch (err) {
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
        dutyManages: true,
      },
    });

    return allStaff.map((staff) => new StaffEntity(staff));
  }

  // Returns the password hash for signing in; wrap in StaffEntity before sending it anywhere
  async findOneByEmail(email: Staff['email']): Promise<Staff> {
    const staff = await this.prisma.staff.findUnique({
      where: { email: email.toLowerCase().trim() },
    });

    if (!staff) {
      throw new NotFoundException('Staff not found');
    }

    return staff;
  }

  async update(
    id: Staff['id'],
    updateStaffDto: UpdateStaffDto,
    staffId: Staff['id'],
  ): Promise<StaffEntity> {
    const isAdmin = await isAccountAdmin(this.prisma, staffId);

    // Staff can update their own details, admins can update anyone's
    if (!isAdmin && staffId !== id) {
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
    let venueIds = uniqueIds(updateStaffDto.venueManages);
    let dutyVenueIds = uniqueIds(updateStaffDto.dutyManages);

    this.assertAssignable(newRole, venueIds ?? [], dutyVenueIds ?? []);

    // Role changed to one that no longer allows existing assignments: clear them
    if (roleChanged && !this.canManageVenues(newRole)) {
      venueIds = [];
    }
    if (roleChanged && !this.canDutyManage(newRole)) {
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
          role: updateStaffDto.role,
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

  async remove(id: Staff['id'], staffId: Staff['id']): Promise<string> {
    await assertAdmin(this.prisma, staffId);

    if (id === staffId) {
      throw new BadRequestException('You cannot delete your own account');
    }

    try {
      const deletedStaff = await this.prisma.$transaction(async (tx) => {
        // Alerts and bans need a creator, so hand them over to the admin deleting this account
        await tx.alert.updateMany({
          where: { createdById: id },
          data: { createdById: staffId },
        });
        await tx.ban.updateMany({
          where: { createdById: id },
          data: { createdById: staffId },
        });

        return tx.staff.delete({ where: { id } });
      });

      this.events.notifyStaffChanged();
      this.events.notifyStaffDeleted(deletedStaff.id);

      return `Deleted account of ${deletedStaff.name}`;
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2025') {
        throw new NotFoundException('Staff not found');
      }
      throw err;
    }
  }

  private canManageVenues(role: Role): boolean {
    return role === Role.VENUE_MANAGER;
  }

  private canDutyManage(role: Role): boolean {
    return role === Role.VENUE_MANAGER || role === Role.DUTY_MANAGER;
  }

  private assertAssignable(role: Role, venueIds: string[], dutyVenueIds: string[]) {
    if (venueIds.length > 0 && !this.canManageVenues(role)) {
      throw new BadRequestException('Only venue managers can be assigned venues to manage');
    }

    if (dutyVenueIds.length > 0 && !this.canDutyManage(role)) {
      throw new BadRequestException(
        'Only venue managers and duty managers can be assigned venues to duty manage',
      );
    }
  }
}
