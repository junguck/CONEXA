import { Controller, HttpCode, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard, Roles } from '@conexa/service-kit';

import { DatingOutboxService } from './outbox.service.js';

/** Déclencheurs exploit dating, appelés par un compte de service uniquement. */
@UseGuards(JwtAuthGuard)
@Roles('service')
@Controller('internal/dating')
export class DatingInternalController {
  constructor(private readonly outbox: DatingOutboxService) {}

  @Post('outbox/relay')
  @HttpCode(200)
  relay() {
    return this.outbox.relay();
  }
}
