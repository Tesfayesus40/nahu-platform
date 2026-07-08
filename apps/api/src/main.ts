import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { AppModule } from './app.module';
import { MobileCompatExceptionFilter } from './common/filters/mobile-compat-exception.filter';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Matches the original nahu-buna-gebaya Express backend's /api/v1
  // prefix, which the nahu_buna_farmer mobile app is already built
  // against -- this way the app's endpoint paths need zero changes.
  // /health stays unprefixed, same as the original backend.
  app.setGlobalPrefix('api/v1', { exclude: ['health'] });

  // Global validation — every DTO in every module gets this for free.
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  app.useGlobalFilters(new MobileCompatExceptionFilter());

  app.enableCors();

  const port = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;
  await app.listen(port);

  Logger.log(`Nahu Platform API running on http://localhost:${port}`, 'Bootstrap');
  Logger.log(`Health check:            http://localhost:${port}/health`, 'Bootstrap');
}

bootstrap();
