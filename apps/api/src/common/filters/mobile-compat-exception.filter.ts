import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Response } from 'express';

/**
 * The nahu_buna_farmer mobile app's api.js interceptor was written against
 * the original Express backend's error shape: `{ error: "some message" }`.
 * Nest's default shape is `{ statusCode, message, error }`, where `message`
 * holds the specific text (a string, or an array for validation errors)
 * and `error` holds the generic HTTP reason phrase ("Bad Request", etc).
 *
 * Rather than rewrite the mobile app's error-handling logic across every
 * screen, this filter reshapes Nest's response to match what the app
 * already expects -- so its existing friendly-error substring matching
 * ("profile not found", "already exists", etc.) keeps working unchanged.
 *
 * Also catches non-HttpException errors so Prisma/runtime failures still
 * return the mobile-compatible `{ error: "..." }` shape instead of Nest's
 * default 500 body.
 */
@Catch()
export class MobileCompatExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(MobileCompatExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const body = exception.getResponse();
      let message: string;

      if (typeof body === 'string') {
        message = body;
      } else if (body && typeof body === 'object' && 'message' in body) {
        const m = (body as { message: string | string[] }).message;
        message = Array.isArray(m) ? m.join(', ') : m;
      } else {
        message = 'Something went wrong';
      }

      response.status(status ?? HttpStatus.INTERNAL_SERVER_ERROR).json({ error: message });
      return;
    }

    const err = exception instanceof Error ? exception : null;
    const prismaCode =
      exception &&
      typeof exception === 'object' &&
      'code' in exception &&
      typeof (exception as { code: unknown }).code === 'string'
        ? (exception as { code: string }).code
        : undefined;
    const prismaMeta =
      exception &&
      typeof exception === 'object' &&
      'meta' in exception
        ? (exception as { meta: unknown }).meta
        : undefined;

    this.logger.error(
      `Unhandled exception${prismaCode ? ` [${prismaCode}]` : ''}: ${
        err?.message ?? String(exception)
      }`,
      err?.stack,
    );
    if (prismaMeta !== undefined) {
      this.logger.error(`Prisma meta: ${JSON.stringify(prismaMeta)}`);
    }

    response.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
      error: 'Server error. Please try again later.',
    });
  }
}
