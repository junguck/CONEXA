import { Module } from '@nestjs/common';
import { AuthModule, HealthModule, createJwtVerifier } from '@conexa/service-kit';

import { env } from './config.js';
import { DatesService } from './dates.service.js';
import { DatingController } from './dating.controller.js';
import { DatingService } from './dating.service.js';
import { pingDatabase } from './db.js';
import { DATING_CLOCK } from './profile.js';

@Module({
  imports: [
    AuthModule.forRoot(
      createJwtVerifier({ publicKey: env.JWT_PUBLIC_KEY, issuer: env.JWT_ISSUER }),
    ),
    HealthModule.forRoot(pingDatabase),
  ],
  controllers: [DatingController],
  providers: [{ provide: DATING_CLOCK, useValue: () => new Date() }, DatingService, DatesService],
})
export class AppModule {}
