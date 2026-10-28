import { Module } from '@nestjs/common';
import { InMemoryEventBus } from '@conexa/events';
import { AuthModule, HealthModule, createJwtVerifier } from '@conexa/service-kit';

import { env } from './config.js';
import { DatesService } from './dates.service.js';
import { DatingController } from './dating.controller.js';
import { DatingService } from './dating.service.js';
import { pingDatabase } from './db.js';
import { DatingInternalController } from './internal.controller.js';
import { DATING_EVENTS, DatingOutboxService } from './outbox.service.js';
import { DATING_CLOCK } from './profile.js';
import { DatingScheduler } from './scheduler.js';

@Module({
  imports: [
    AuthModule.forRoot(
      createJwtVerifier({ publicKey: env.JWT_PUBLIC_KEY, issuer: env.JWT_ISSUER }),
    ),
    HealthModule.forRoot(pingDatabase),
  ],
  controllers: [DatingController, DatingInternalController],
  providers: [
    { provide: DATING_CLOCK, useValue: () => new Date() },
    { provide: DATING_EVENTS, useValue: new InMemoryEventBus() },
    DatingService,
    DatesService,
    DatingOutboxService,
    DatingScheduler,
  ],
})
export class AppModule {}
