import { Module } from '@nestjs/common';
import { InMemoryEventBus } from '@conexa/events';
import { AuthModule, HealthModule, createJwtVerifier } from '@conexa/service-kit';

import { env } from './config.js';
import { pingDatabase } from './db.js';
import {
  OffersController,
  OrganisationsController,
  VenuesController,
} from './partners.controller.js';
import { AgreementsController } from './agreements.controller.js';
import { AgreementsService } from './agreements.service.js';
import { SlotHoldsService } from './holds.service.js';
import { PartnersInternalController } from './internal.controller.js';
import { PARTNERS_CLOCK, PARTNERS_EVENTS, PartnersOutboxService } from './outbox.service.js';
import { PartnersService } from './partners.service.js';
import { PartnersScheduler } from './scheduler.js';

@Module({
  imports: [
    AuthModule.forRoot(
      createJwtVerifier({ publicKey: env.JWT_PUBLIC_KEY, issuer: env.JWT_ISSUER }),
    ),
    HealthModule.forRoot(pingDatabase),
  ],
  controllers: [
    OrganisationsController,
    VenuesController,
    OffersController,
    PartnersInternalController,
    AgreementsController,
  ],
  providers: [
    { provide: PARTNERS_CLOCK, useValue: () => new Date() },
    { provide: PARTNERS_EVENTS, useValue: new InMemoryEventBus() },
    PartnersService,
    PartnersOutboxService,
    SlotHoldsService,
    AgreementsService,
    PartnersScheduler,
  ],
})
export class AppModule {}
