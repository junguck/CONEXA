import { Module } from '@nestjs/common';
import { AuthModule, HealthModule, createJwtVerifier } from '@conexa/service-kit';

import { BillingInternalController, BillingController } from './billing.controller.js';
import { BillingService } from './billing.service.js';
import { env } from './config.js';
import { pingDatabase } from './db.js';

@Module({
  imports: [
    AuthModule.forRoot(
      createJwtVerifier({ publicKey: env.JWT_PUBLIC_KEY, issuer: env.JWT_ISSUER }),
    ),
    HealthModule.forRoot(pingDatabase),
  ],
  controllers: [BillingController, BillingInternalController],
  providers: [BillingService],
})
export class AppModule {}
