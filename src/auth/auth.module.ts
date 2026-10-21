import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerModule } from '@nestjs/throttler';
import { StaffModule } from '../staff/staff.module';
import { AuthenticationController } from './auth.controller';
import { AuthenticationGuard } from './auth.guard';
import { AuthenticationService } from './auth.service';

@Module({
  imports: [
    StaffModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>('JWT_SECRET'),
        // Roughly one shift, so a leaked token stops working on its own
        signOptions: { expiresIn: config.get('JWT_EXPIRES_IN') ?? '12h' },
      }),
      inject: [ConfigService],
    }),
    // Only applied where ThrottlerGuard is used, which is sign-in
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 10 }]),
  ],
  providers: [
    AuthenticationService,
    {
      provide: APP_GUARD,
      useClass: AuthenticationGuard,
    },
  ],
  controllers: [AuthenticationController],
  exports: [AuthenticationService],
})
export class AuthenticationModule {}
