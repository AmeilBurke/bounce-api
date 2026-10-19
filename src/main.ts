import { NestFactory, Reflector } from '@nestjs/core';
import { AppModule } from './app.module';
import { ClassSerializerInterceptor, ValidationPipe } from '@nestjs/common';
import { join } from 'path';
import { NestExpressApplication } from '@nestjs/platform-express';
import { createImageFolders } from './utils';

async function bootstrap() {
  await createImageFolders();

  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  // transform: true hands the services the validated DTO, including any @Transform changes
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  app.useGlobalInterceptors(new ClassSerializerInterceptor(app.get(Reflector)));
  // Same uploads folder the image helpers in utils/images.ts write to
  app.useStaticAssets(join(process.cwd(), 'uploads'), {
    prefix: '/uploads',
  });
  app.enableCors({
    // origin: ['http://192.168.1.95:5173', 'http://localhost:5173']
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
  });
  // await app.listen(process.env.PORT ?? 3000);
  await app.listen(process.env.PORT ?? 3000, '0.0.0.0');
  console.log('Server running at: http://192.168.1.95:3000');
}

bootstrap();
