import { Body, Controller, Get, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { AuthenticationService } from './auth.service';
import { SignInDto } from './dto/signIn.dto';
import { Public } from './public.decorator';
import { RequestFrom } from './request-from.decorator';
import type { StaffPayload } from './staff-payload.interface';

@Controller('authentication')
export class AuthenticationController {
  constructor(private readonly authService: AuthenticationService) {}

  @Public()
  @HttpCode(HttpStatus.OK)
  @Post('sign-in')
  signIn(@Body() signInDto: SignInDto) {
    return this.authService.signIn(signInDto.email, signInDto.password);
  }

  @Get('profile')
  getProfile(@RequestFrom() staff: StaffPayload): StaffPayload {
    return staff;
  }
}
