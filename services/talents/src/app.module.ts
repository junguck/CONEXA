import { Module } from '@nestjs/common';
import { AuthModule, HealthModule, createJwtVerifier } from '@conexa/service-kit';

import { env } from './config.js';
import { pingDatabase } from './db.js';
import { EventsService } from './events.service.js';
import {
  ENTITLEMENTS_GATEWAY,
  FakePaymentsGateway,
  FixedEntitlementsGateway,
  PAYMENTS_GATEWAY,
  TALENTS_CLOCK,
} from './gateways.js';
import { MissionsService } from './missions.service.js';
import { PostsService } from './posts.service.js';
import { TalentsController } from './talents.controller.js';

@Module({
  imports: [
    AuthModule.forRoot(
      createJwtVerifier({ publicKey: env.JWT_PUBLIC_KEY, issuer: env.JWT_ISSUER }),
    ),
    HealthModule.forRoot(pingDatabase),
  ],
  controllers: [TalentsController],
  providers: [
    { provide: TALENTS_CLOCK, useValue: () => new Date() },
    { provide: PAYMENTS_GATEWAY, useValue: new FakePaymentsGateway() },
    { provide: ENTITLEMENTS_GATEWAY, useValue: new FixedEntitlementsGateway() },
    PostsService,
    MissionsService,
    EventsService,
  ],
})
export class AppModule {}
