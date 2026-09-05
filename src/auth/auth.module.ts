import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { StaffModule } from '../staff/staff.module';
import { AuthenticationController } from './auth.controller';
import { AuthenticationGuard } from './auth.guard';
import { AuthenticationService } from './auth.service';
import { PrismaService } from '../prisma.service';

@Module({
  imports: [
    StaffModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>('JWT_SECRET'),
      }),
      inject: [ConfigService],
    }),
  ],
  providers: [AuthenticationService, {
    provide: APP_GUARD,
    useClass: AuthenticationGuard,
  }],
  controllers: [AuthenticationController],
  exports: [AuthenticationService]
})
export class AuthenticationModule { }