import { Body, Controller, HttpCode, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard, Roles } from '@conexa/service-kit';

import { EmbeddingsConsumer } from './embeddings.consumer.js';
import { DatingOutboxService } from './outbox.service.js';

/** Déclencheurs exploit dating, appelés par un compte de service uniquement. */
@UseGuards(JwtAuthGuard)
@Roles('service')
@Controller('internal/dating')
export class DatingInternalController {
  constructor(
    private readonly outbox: DatingOutboxService,
    private readonly embeddings: EmbeddingsConsumer,
  ) {}

  @Post('outbox/relay')
  @HttpCode(200)
  relay() {
    return this.outbox.relay();
  }

  /** Remise d'un `embedding.computed` par le bus (ou par un rejeu manuel). */
  @Post('embeddings/computed')
  @HttpCode(200)
  embeddingComputed(@Body() envelope: unknown) {
    return this.embeddings.handle(envelope);
  }
}
