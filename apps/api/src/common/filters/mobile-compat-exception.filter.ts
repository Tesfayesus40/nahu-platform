import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
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
 */
@Catch(HttpException)
export class MobileCompatExceptionFilter implements ExceptionFilter {
  catch(exception: HttpException, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const status = exception.getStatus();

    const body = exception.getResponse();
    let message: string;

    if (typeof body === 'string') {
      message = body;
    } else if (body && typeof body === 'object' && 'message' in body) {
      const m = (body as any).message;
      // class-validator puts each failed constraint in an array -- join
      // into one readable string rather than exposing an array.
      message = Array.isArray(m) ? m.join(', ') : m;
    } else {
      message = 'Something went wrong';
    }

    response.status(status ?? HttpStatus.INTERNAL_SERVER_ERROR).json({ error: message });
  }
}
