import { Module } from '@nestjs/common';
import { InMemoryEventBus } from '@conexa/events';
import { AuthModule, HealthModule, createJwtVerifier } from '@conexa/service-kit';

import { BillingInternalController, BillingController } from './billing.controller.js';
import { BillingService } from './billing.service.js';
import { env } from './config.js';
import { BILLING_EVENT_BUS } from './events.js';
import { pingDatabase } from './db.js';

@Module({
  imports: [
    AuthModule.forRoot(
      createJwtVerifier({ publicKey: env.JWT_PUBLIC_KEY, issuer: env.JWT_ISSUER }),
    ),
    HealthModule.forRoot(pingDatabase),
  ],
  controllers: [BillingController, BillingInternalController],
  providers: [{ provide: BILLING_EVENT_BUS, useValue: new InMemoryEventBus() }, BillingService],
})
export class AppModule {}
