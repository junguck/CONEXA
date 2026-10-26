import { randomUUID } from 'node:crypto';

import {
  Catch,
  HttpException,
  HttpStatus,
  type ArgumentsHost,
  type ExceptionFilter,
  type INestApplication,
  type Type,
} from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { ERROR_STATUS, type ErrorCode } from '@conexa/contracts';
import { AppError } from '@conexa/errors';
import type { NextFunction, Request, Response } from 'express';
import { pinoHttp } from 'pino-http';
import { ZodError } from 'zod';
import type { Logger } from 'pino';

import { createLogger } from './logger.js';

type RequestWithId = Request & { id?: string };

export function requestIdMiddleware(
  request: Request,
  response: Response,
  next: NextFunction,
): void {
  const incoming = request.header('x-request-id');
  const valid = incoming && /^[\w.:-]{8,128}$/.test(incoming);
  const id = valid ? incoming : `req_${randomUUID()}`;
  (request as RequestWithId).id = id;
  response.setHeader('X-Request-Id', id);
  next();
}

function isErrorCode(value: unknown): value is ErrorCode {
  return typeof value === 'string' && Object.hasOwn(ERROR_STATUS, value);
}

function codeForStatus(status: number, exception: HttpException): ErrorCode {
  const body = exception.getResponse();
  if (typeof body === 'object' && body !== null && 'code' in body) {
    const candidate = (body as { code?: unknown }).code;
    if (isErrorCode(candidate)) {
      return candidate;
    }
  }
  switch (status) {
    case HttpStatus.UNAUTHORIZED:
      return 'UNAUTHENTICATED';
    case HttpStatus.FORBIDDEN:
      return 'FORBIDDEN';
    case HttpStatus.NOT_FOUND:
      return 'NOT_FOUND';
    case HttpStatus.PAYMENT_REQUIRED:
      return 'PAYMENT_REQUIRED';
    case HttpStatus.CONFLICT:
      return 'INVALID_STATE';
    case HttpStatus.TOO_MANY_REQUESTS:
      return 'RATE_LIMITED';
    case HttpStatus.UNPROCESSABLE_ENTITY:
      return 'VALIDATION_ERROR';
    default:
      return status >= 500 ? 'INTERNAL_ERROR' : 'VALIDATION_ERROR';
  }
}

/** Traduit toute exception en enveloppe d'erreur de API.md §1. */
@Catch()
export class ApiExceptionFilter implements ExceptionFilter {
  constructor(private readonly logger: Logger) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    const context = host.switchToHttp();
    const request = context.getRequest<RequestWithId>();
    const response = context.getResponse<Response>();
    const requestId = request.id ?? 'req_unknown';

    let status: number = HttpStatus.INTERNAL_SERVER_ERROR;
    let code: ErrorCode = 'INTERNAL_ERROR';
    let message = 'Erreur interne';
    let details: Record<string, unknown> | undefined;

    if (exception instanceof AppError) {
      status = exception.status;
      code = exception.code;
      message = exception.message;
      details = exception.details;
    } else if (exception instanceof ZodError) {
      status = HttpStatus.UNPROCESSABLE_ENTITY;
      code = 'VALIDATION_ERROR';
      message = 'Champs invalides';
      details = {
        fields: exception.issues.map((issue) => ({
          path: issue.path.join('.'),
          message: issue.message,
        })),
      };
    } else if (exception instanceof HttpException) {
      status = exception.getStatus();
      code = codeForStatus(status, exception);
      message = status >= 500 ? 'Erreur interne' : exception.message;
      const body = exception.getResponse();
      if (typeof body === 'object' && body !== null && 'details' in body) {
        details = (body as { details?: Record<string, unknown> }).details;
      }
    }

    if (status >= 500) {
      this.logger.error({ err: exception, request_id: requestId }, 'requête en erreur');
    }

    response.status(status).json({
      error: {
        code,
        message,
        ...(details === undefined ? {} : { details }),
        request_id: requestId,
      },
    });
  }
}

export async function createServiceApp(options: {
  name: string;
  module: Type<unknown>;
}): Promise<INestApplication> {
  const logger = createLogger(options.name);
  const app = await NestFactory.create(options.module, { logger: false });

  app.use(requestIdMiddleware);
  app.use(
    pinoHttp({
      logger,
      genReqId: (request) => (request as RequestWithId).id ?? `req_${randomUUID()}`,
      autoLogging: { ignore: (request) => request.url === '/health' || request.url === '/ready' },
    }),
  );
  app.useGlobalFilters(new ApiExceptionFilter(logger));
  app.enableShutdownHooks();

  const port = Number(process.env.PORT ?? 3000);
  await app.listen(port);
  logger.info({ port }, `${options.name} écoute`);
  return app;
}
