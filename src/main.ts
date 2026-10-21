import { NestFactory, Reflector } from '@nestjs/core';
import { AppModule } from './app.module';
import { ClassSerializerInterceptor, Logger, ValidationPipe } from '@nestjs/common';
import { networkInterfaces } from 'os';
import { NestExpressApplication } from '@nestjs/platform-express';
import { IoAdapter } from '@nestjs/platform-socket.io';
import { ServerOptions } from 'socket.io';
import compression from 'compression';
import { corsOrigins } from './env';

// Gives socket.io the same allowed origins as the HTTP API
class CorsIoAdapter extends IoAdapter {
  createIOServer(port: number, options?: ServerOptions) {
    return super.createIOServer(port, { ...options, cors: { origin: corsOrigins() } } as ServerOptions);
  }
}

// IPv4 addresses other devices on the network can reach this machine on
function lanAddresses(): string[] {
  return Object.values(networkInterfaces())
    .flat()
    .filter((net) => net && net.family === 'IPv4' && !net.internal)
    .map((net) => net!.address);
}

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  // transform: true hands the services the validated DTO, including any @Transform changes
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  app.useGlobalInterceptors(new ClassSerializerInterceptor(app.get(Reflector)));
  app.use(compression());
  app.enableCors({
    origin: corsOrigins(),
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
  });
  app.useWebSocketAdapter(new CorsIoAdapter(app));

  const port = Number(process.env.PORT ?? 3000);
  await app.listen(port, '0.0.0.0');

  const logger = new Logger('Bootstrap');
  for (const host of ['localhost', ...lanAddresses()]) {
    logger.log(`Server running at: http://${host}:${port}`);
  }
}

bootstrap();
