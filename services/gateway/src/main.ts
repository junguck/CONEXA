import 'reflect-metadata';

import { NestFactory } from '@nestjs/core';
import {
  ApiExceptionFilter,
  createJwtVerifier,
  createLogger,
  requestIdMiddleware,
} from '@conexa/service-kit';

import { AppModule } from './app.module.js';
import { createGatewayMiddleware } from './gateway.middleware.js';
import { loadManifests } from './manifest.js';

const logger = createLogger('gateway');

const app = await NestFactory.create(AppModule, { logger: false });
app.use(requestIdMiddleware);
app.useGlobalFilters(new ApiExceptionFilter(logger));

const manifests = loadManifests(process.env.SERVICES_DIR ?? 'services');
logger.info({ services: manifests.map((manifest) => manifest.service) }, 'manifestes chargés');

app.use(
  createGatewayMiddleware({
    manifests,
    verifier: createJwtVerifier({
      ...(process.env.JWT_JWKS_URL === undefined ? {} : { jwksUrl: process.env.JWT_JWKS_URL }),
      ...(process.env.JWT_PUBLIC_KEY === undefined
        ? {}
        : { publicKey: process.env.JWT_PUBLIC_KEY }),
      ...(process.env.JWT_ISSUER === undefined ? {} : { issuer: process.env.JWT_ISSUER }),
    }),
  }),
);

const port = Number(process.env.PORT ?? 3000);
await app.listen(port);
logger.info({ port }, 'gateway écoute');
