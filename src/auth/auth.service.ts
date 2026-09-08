import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { StaffService } from '../staff/staff.service';
import * as argon2 from 'argon2';
import { PrismaService } from '../prisma.service';
import { Roles, Staff } from '../generated/prisma/client';

@Injectable()
export class AuthenticationService {
  constructor(
    private staffService: StaffService,
    private jwtService: JwtService,
  ) { }

  async signIn(email: string, plainPassword: string): Promise<{ access_token: string } | null> {
    const staff = await this.staffService.findOneByEmail(email);

    const isPasswordValid = await argon2.verify(staff.password, plainPassword);
    if (!isPasswordValid) {
      return null;
    }

    const { password, ...staffWithoutPassword } = staff;
    const payload = { ...staffWithoutPassword };
    return {
      access_token: await this.jwtService.signAsync(payload),
    };
  }
}