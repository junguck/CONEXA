import { Module } from '@nestjs/common';
import { HealthModule, createJwtVerifier, AuthModule } from '@conexa/service-kit';

import { AiService } from './ai.service.js';
import { env } from './config.js';
import { pingDatabase } from './db.js';
import { EmbeddingsController } from './embeddings.controller.js';

@Module({
  imports: [
    AuthModule.forRoot(
      createJwtVerifier({ publicKey: env.JWT_PUBLIC_KEY, issuer: env.JWT_ISSUER }),
    ),
    HealthModule.forRoot(pingDatabase),
  ],
  controllers: [EmbeddingsController],
  providers: [AiService],
})
export class AppModule {}
