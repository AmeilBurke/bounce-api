import { Body, Controller, Post, HttpCode, HttpStatus, Get, Req, UnauthorizedException } from '@nestjs/common';
import { SignInDto } from './dto/signIn.dto';
import { Public } from './public.decorator';
import { AuthenticationService } from './auth.service';

@Controller('authentication')
export class AuthenticationController {
  constructor(private authService: AuthenticationService) { }

  @Public()
  @HttpCode(HttpStatus.OK)
  @Post('/sign-in')
  signIn(@Body() signInDto: SignInDto) {
    return this.authService.signIn(signInDto.email, signInDto.password);
  }

  @Get('profile')
  getProfile(@Req() req: any): Promise<{
    id: string,
    email: string,
    name: string,
    role: string,
    iat: number
  }> {
    return req.staff;
  }
}