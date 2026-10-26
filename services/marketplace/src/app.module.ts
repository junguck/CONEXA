import { Module } from '@nestjs/common';
import { AuthModule, HealthModule, createJwtVerifier } from '@conexa/service-kit';

import { env } from './config.js';
import { pingDatabase } from './db.js';
import {
  ENTITLEMENTS_GATEWAY,
  FakePaymentsGateway,
  FixedEntitlementsGateway,
  MARKETPLACE_CLOCK,
  PAYMENTS_GATEWAY,
} from './gateways.js';
import { ListingsService } from './listings.service.js';
import { MarketplaceController } from './marketplace.controller.js';
import { OrdersService } from './orders.service.js';

@Module({
  imports: [
    AuthModule.forRoot(
      createJwtVerifier({ publicKey: env.JWT_PUBLIC_KEY, issuer: env.JWT_ISSUER }),
    ),
    HealthModule.forRoot(pingDatabase),
  ],
  controllers: [MarketplaceController],
  providers: [
    { provide: MARKETPLACE_CLOCK, useValue: () => new Date() },
    { provide: PAYMENTS_GATEWAY, useValue: new FakePaymentsGateway() },
    { provide: ENTITLEMENTS_GATEWAY, useValue: new FixedEntitlementsGateway() },
    ListingsService,
    OrdersService,
  ],
})
export class AppModule {}
