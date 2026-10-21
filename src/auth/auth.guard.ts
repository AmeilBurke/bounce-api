import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Request } from 'express';
import { IS_PUBLIC_KEY } from './public.decorator';
import { Reflector } from '@nestjs/core';
import { PrismaService } from '../prisma.service';
import type { StaffPayload } from './staff-payload.interface';

@Injectable()
export class AuthenticationGuard implements CanActivate {
  constructor(
    private jwtService: JwtService,
    private reflector: Reflector,
    private prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    const request = context.switchToHttp().getRequest();
    const token = this.extractTokenFromHeader(request);

    // Always try to decode the token if present
    const staff = token ? await this.verify(token) : undefined;

    if (staff) {
      request['staff'] = staff;
    } else if (!isPublic) {
      throw new UnauthorizedException();
    }

    return true;
  }

  // A valid signature isn't enough: the account may have been deleted since the token was issued
  private async verify(token: string): Promise<StaffPayload | undefined> {
    try {
      const payload = await this.jwtService.verifyAsync<StaffPayload>(token);
      const exists = await this.prisma.staff.findUnique({
        where: { id: payload.id },
        select: { id: true },
      });
      return exists ? payload : undefined;
    } catch {
      return undefined;
    }
  }

  private extractTokenFromHeader(request: Request): string | undefined {
    const [type, token] = request.headers.authorization?.split(' ') ?? [];
    return type === 'Bearer' ? token : undefined;
  }
}
