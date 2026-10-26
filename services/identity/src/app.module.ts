import { Module } from '@nestjs/common';
import { AuthModule, HealthModule, createJwtVerifier } from '@conexa/service-kit';

import { env } from './config.js';
import { pingDatabase } from './db.js';
import { IdentityController } from './identity.controller.js';
import { IdentityService } from './identity.service.js';
import { JwksController } from './jwks.controller.js';

@Module({
  imports: [
    AuthModule.forRoot(
      createJwtVerifier({ publicKey: env.JWT_PUBLIC_KEY, issuer: env.JWT_ISSUER }),
    ),
    HealthModule.forRoot(pingDatabase),
  ],
  controllers: [IdentityController, JwksController],
  providers: [IdentityService],
})
export class AppModule {}
