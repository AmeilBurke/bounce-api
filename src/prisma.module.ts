import { Global, Module } from '@nestjs/common';
import { PrismaService } from './prisma.service';

// Global so every module shares one PrismaService (and one database connection pool)
@Global()
@Module({
  providers: [PrismaService],
  exports: [PrismaService],
})
export class PrismaModule {}
