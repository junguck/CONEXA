import { Body, Controller, Get, HttpCode, Param, Post, UseGuards } from '@nestjs/common';
import { createServiceTokenGuard } from '@conexa/service-kit';
import { z } from 'zod';

import { AgreementsService } from './agreements.service.js';
import { env } from './config.js';
import { SlotHoldsService } from './holds.service.js';
import { PartnersOutboxService } from './outbox.service.js';

const ServiceTokenGuard = createServiceTokenGuard(env.SERVICE_TOKEN);

const HoldBody = z.object({ hold_ref: z.string().min(1).max(128) });

/** Appels de service à service (saga de réservation, tâches de fond), hors Gateway. */
@Controller('internal/partners')
export class PartnersInternalController {
  constructor(
    private readonly holds: SlotHoldsService,
    private readonly outbox: PartnersOutboxService,
    private readonly agreements: AgreementsService,
  ) {}

  @UseGuards(ServiceTokenGuard)
  @Post('slots/:id/hold')
  @HttpCode(200)
  hold(@Param('id') id: string, @Body() body: unknown) {
    return this.holds.hold(id, HoldBody.parse(body).hold_ref);
  }

  @UseGuards(ServiceTokenGuard)
  @Post('holds/:ref/confirm')
  @HttpCode(200)
  confirm(@Param('ref') ref: string) {
    return this.holds.confirm(ref);
  }

  @UseGuards(ServiceTokenGuard)
  @Post('holds/:ref/release')
  @HttpCode(200)
  release(@Param('ref') ref: string) {
    return this.holds.release(ref);
  }

  @UseGuards(ServiceTokenGuard)
  @Post('holds/sweep')
  @HttpCode(200)
  sweep() {
    return this.holds.sweepExpired();
  }

  @UseGuards(ServiceTokenGuard)
  @Post('outbox/relay')
  @HttpCode(200)
  relay() {
    return this.outbox.relay();
  }

  /** Commission du contrat actif d'un lieu, à copier dans la réservation. */
  @UseGuards(ServiceTokenGuard)
  @Get('venues/:id/commission')
  commission(@Param('id') id: string) {
    return this.agreements.commissionForVenue(id);
  }
}
