import { Strategy } from 'passport-local';
import { PassportStrategy } from '@nestjs/passport';
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { AuthenticationService } from './auth.service';

@Injectable()
export class LocalStrategy extends PassportStrategy(Strategy) {
  constructor(private authService: AuthenticationService) {
    super();
  }

  async validate(email: string, plainPassword: string): Promise<any> {
    const staff = await this.authService.signIn(email, plainPassword);

    if (!staff) {
      throw new UnauthorizedException();
    }
    return staff;
  }
}
