import { Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as argon2 from 'argon2';
import { StaffService } from '../staff/staff.service';
import { Staff } from '../generated/prisma/client';

@Injectable()
export class AuthenticationService {
  constructor(
    private staffService: StaffService,
    private jwtService: JwtService,
  ) {}

  async signIn(email: Staff['email'], plainPassword: string): Promise<{ access_token: string }> {
    // Same error for a wrong email or password so it doesn't reveal which emails exist
    const invalidLogin = new UnauthorizedException('Invalid email or password');

    const staff = await this.staffService.findOneByEmail(email).catch((err) => {
      throw err instanceof NotFoundException ? invalidLogin : err;
    });

    if (!(await argon2.verify(staff.password, plainPassword))) {
      throw invalidLogin;
    }

    const { password, ...payload } = staff;
    return {
      access_token: await this.jwtService.signAsync(payload),
    };
  }
}
