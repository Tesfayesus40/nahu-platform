import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
import helmet from 'helmet';
import { join } from 'path';
import { AppModule } from './app.module';
import { MobileCompatExceptionFilter } from './common/filters/mobile-compat-exception.filter';

const INSECURE_JWT_SECRETS = new Set([
  'dev-only-insecure-secret-change-me',
  'change-me-to-a-long-random-string',
]);

async function bootstrap() {
  const nodeEnv = process.env.NODE_ENV ?? 'development';
  const jwtSecret = process.env.JWT_SECRET ?? 'dev-only-insecure-secret-change-me';

  if (nodeEnv === 'production' && INSECURE_JWT_SECRETS.has(jwtSecret)) {
    throw new Error('JWT_SECRET must be set to a strong value in production');
  }

  if (nodeEnv === 'production' && !process.env.ADMIN_MFA_ENCRYPTION_KEY) {
    throw new Error('ADMIN_MFA_ENCRYPTION_KEY must be set in production');
  }

  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  const uploadDir = process.env.UPLOAD_DIR ?? join(process.cwd(), 'uploads');
  app.useStaticAssets(uploadDir, { prefix: '/uploads/files' });

  app.use(
    helmet({
      crossOriginResourcePolicy: { policy: 'cross-origin' },
    }),
  );

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

  const corsOrigins = process.env.CORS_ORIGINS?.split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

  if (corsOrigins?.length) {
    app.enableCors({
      origin: corsOrigins,
      credentials: true,
    });
  } else if (nodeEnv === 'production') {
    throw new Error(
      'CORS_ORIGINS must be set in production (comma-separated allowlist)',
    );
  } else {
    // Local/dev only: reflect request origin so admin-web BFF and mobile tools work.
    Logger.warn(
      'CORS_ORIGINS unset — reflecting request origin (non-production only)',
      'Bootstrap',
    );
    app.enableCors({ origin: true, credentials: true });
  }

  const port = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;
  await app.listen(port);

  Logger.log(`Nahu Platform API running on http://localhost:${port}`, 'Bootstrap');
  Logger.log(`Health check:            http://localhost:${port}/health`, 'Bootstrap');
}

bootstrap();
