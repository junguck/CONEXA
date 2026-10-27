import { Module } from '@nestjs/common';
import { InMemoryEventBus } from '@conexa/events';
import { AuthModule, HealthModule, createJwtVerifier } from '@conexa/service-kit';

import { env } from './config.js';
import { pingDatabase } from './db.js';
import { PAYMENT_EVENT_BUS } from './events.js';
import { PaymentPoller } from './payment-poller.service.js';
import {
  MyPaymentsController,
  PaymentsController,
  PaymentsInternalController,
  PayoutAccountsController,
} from './payments.controller.js';
import { PaymentsService } from './payments.service.js';
import { ReconciliationService } from './reconciliation.service.js';

@Module({
  imports: [
    AuthModule.forRoot(
      createJwtVerifier({ publicKey: env.JWT_PUBLIC_KEY, issuer: env.JWT_ISSUER }),
    ),
    HealthModule.forRoot(pingDatabase),
  ],
  controllers: [
    PaymentsController,
    MyPaymentsController,
    PayoutAccountsController,
    PaymentsInternalController,
  ],
  providers: [
    { provide: PAYMENT_EVENT_BUS, useValue: new InMemoryEventBus() },
    PaymentsService,
    PaymentPoller,
    ReconciliationService,
  ],
})
export class AppModule {}
