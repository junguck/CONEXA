import { Body, Controller, HttpCode, Param, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard, Roles } from '@conexa/service-kit';

import { EmbeddingsConsumer } from './embeddings.consumer.js';
import { DatingOutboxService } from './outbox.service.js';
import { ReservationSagaService } from './reservation.service.js';

/** Déclencheurs exploit dating, appelés par un compte de service uniquement. */
@UseGuards(JwtAuthGuard)
@Roles('service')
@Controller('internal/dating')
export class DatingInternalController {
  constructor(
    private readonly outbox: DatingOutboxService,
    private readonly embeddings: EmbeddingsConsumer,
    private readonly saga: ReservationSagaService,
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

  /** Exécute les actions de saga dues (reprise après incident). */
  @Post('sagas/run')
  @HttpCode(200)
  runSagas() {
    return this.saga.runDue();
  }

  @Post('sagas/:dateId/view')
  @HttpCode(200)
  sagaView(@Param('dateId') dateId: string) {
    return this.saga.get(dateId);
  }

  /** Remise d'un événement du bus à la saga (`payment.*`, `slot.*`). */
  @Post('sagas/events')
  @HttpCode(200)
  sagaEvent(@Body() envelope: unknown) {
    return this.saga.handleEnvelope(envelope);
  }
}
