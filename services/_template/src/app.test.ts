import 'reflect-metadata';

import { Module } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import {
  ApiExceptionFilter,
  HealthModule,
  createLogger,
  requestIdMiddleware,
} from '@conexa/service-kit';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import type { INestApplication } from '@nestjs/common';

@Module({ imports: [HealthModule.forRoot(async () => true)] })
class TestModule {}

describe('gabarit de service', () => {
  let app: INestApplication;

  beforeAll(async () => {
    app = await NestFactory.create(TestModule, { logger: false });
    app.use(requestIdMiddleware);
    app.useGlobalFilters(new ApiExceptionFilter(createLogger('test', { level: 'silent' })));
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('répond sur /health', async () => {
    const response = await request(app.getHttpServer()).get('/health').expect(200);
    expect(response.body).toEqual({ status: 'ok' });
  });

  it('répond sur /ready avec l’état de la base', async () => {
    const response = await request(app.getHttpServer()).get('/ready').expect(200);
    expect(response.body).toEqual({ status: 'ready', checks: { database: true } });
  });

  it('normalise une route inconnue en enveloppe d’erreur', async () => {
    const response = await request(app.getHttpServer()).get('/inconnu').expect(404);
    expect(response.body.error).toMatchObject({ code: 'NOT_FOUND' });
    expect(response.headers['x-request-id']).toBeDefined();
  });
});
