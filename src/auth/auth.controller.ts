import { Body, Controller, Get, HttpCode, HttpStatus, Post, UseGuards } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';
import { AuthenticationService } from './auth.service';
import { SignInDto } from './dto/signIn.dto';
import { Public } from './public.decorator';
import { RequestFrom } from './request-from.decorator';
import type { StaffPayload } from './staff-payload.interface';

@Controller('authentication')
export class AuthenticationController {
  constructor(private readonly authService: AuthenticationService) {}

  // Rate limited per IP to slow down password guessing
  @Public()
  @UseGuards(ThrottlerGuard)
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
