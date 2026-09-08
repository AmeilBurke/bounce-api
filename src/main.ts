import { NestFactory, Reflector } from '@nestjs/core';
import { AppModule } from './app.module';
import { ClassSerializerInterceptor, ValidationPipe } from '@nestjs/common';
import { join } from 'path';
import { NestExpressApplication } from '@nestjs/platform-express';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  app.useGlobalPipes(new ValidationPipe({ whitelist: true }));
  app.useGlobalInterceptors(new ClassSerializerInterceptor(app.get(Reflector)));
  app.useStaticAssets(join(__dirname, '..', 'uploads'), {
    prefix: '/uploads',
  });
  app.enableCors({
    origin: ['http://192.168.1.95:5173', 'http://localhost:5173'], // your Vite dev server
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
  });
  await app.listen(process.env.PORT ?? 3000);
  console.log('Server running at: http://192.168.1.95:3000');
}

bootstrap();
