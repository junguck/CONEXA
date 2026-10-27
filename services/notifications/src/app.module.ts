import { Module } from '@nestjs/common';
import { AuthModule, HealthModule, createJwtVerifier } from '@conexa/service-kit';

import { env } from './config.js';
import { pingDatabase } from './db.js';
import { PushController, PushInternalController } from './notifications.controller.js';
import { NotificationsService } from './notifications.service.js';

@Module({
  imports: [
    AuthModule.forRoot(
      createJwtVerifier({ publicKey: env.JWT_PUBLIC_KEY, issuer: env.JWT_ISSUER }),
    ),
    HealthModule.forRoot(pingDatabase),
  ],
  controllers: [PushController, PushInternalController],
  providers: [NotificationsService],
})
export class AppModule {}
