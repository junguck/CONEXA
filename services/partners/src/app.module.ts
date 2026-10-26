import { Module } from '@nestjs/common';
import { AuthModule, HealthModule, createJwtVerifier } from '@conexa/service-kit';

import { env } from './config.js';
import { pingDatabase } from './db.js';
import {
  OffersController,
  OrganisationsController,
  VenuesController,
} from './partners.controller.js';
import { PartnersService } from './partners.service.js';

@Module({
  imports: [
    AuthModule.forRoot(
      createJwtVerifier({ publicKey: env.JWT_PUBLIC_KEY, issuer: env.JWT_ISSUER }),
    ),
    HealthModule.forRoot(pingDatabase),
  ],
  controllers: [OrganisationsController, VenuesController, OffersController],
  providers: [PartnersService],
})
export class AppModule {}
