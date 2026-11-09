import { Body, Controller, HttpCode, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard, Roles } from '@conexa/service-kit';

import { ReservationSagaService } from './reservation.service.js';
import { DatingOutboxService } from './outbox.service.js';

/** Déclencheurs exploit dating, appelés par un compte de service uniquement. */
@UseGuards(JwtAuthGuard)
@Roles('service')
@Controller('internal/dating')
export class DatingInternalController {
  constructor(
    private readonly outbox: DatingOutboxService,
    private readonly reservations: ReservationSagaService,
  ) {}

  @Post('outbox/relay')
  @HttpCode(200)
  relay() {
    return this.outbox.relay();
  }

  /** Remise d'un `slot.released` (expiration) ou `payment.escrowed|failed` d'un date. */
  @Post('reservations/events')
  @HttpCode(200)
  reservationEvent(@Body() envelope: unknown) {
    return this.reservations.handleEnvelope(envelope);
  }

  /** Exécute les actions de la saga encore dues (reprise après crash). */
  @Post('reservations/run')
  @HttpCode(200)
  reservationRun() {
    return this.reservations.runDue();
  }
}
