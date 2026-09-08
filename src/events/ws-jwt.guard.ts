import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Reflector } from '@nestjs/core';
import { Socket } from 'socket.io';
import { IS_PUBLIC_KEY } from '../auth/public.decorator';

@Injectable()
export class WsAuthenticationGuard implements CanActivate {
  constructor(private jwtService: JwtService, private reflector: Reflector) { }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    const client: Socket = context.switchToWs().getClient();
    const token = this.extractToken(client);

    if (token) {
      try {
        const payload = await this.jwtService.verifyAsync(token);
        client.data.staff = payload;
      } catch {
        if (!isPublic) throw new UnauthorizedException();
      }
    } else if (!isPublic) {
      throw new UnauthorizedException();
    }

    return true;
  }

  private extractToken(client: Socket): string | undefined {
    const authToken = client.handshake.auth?.token;
    if (authToken) return authToken;

    const [type, bearerToken] = client.handshake.headers.authorization?.split(' ') ?? [];
    if (type === 'Bearer') return bearerToken;

    // fallback for clients (like Postman) that can't send socket.io's `auth` object
    const headerToken = client.handshake.headers.token;
    return typeof headerToken === 'string' ? headerToken : undefined;
  }
}