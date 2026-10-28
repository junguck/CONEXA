import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  Param,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  CreatePaymentSchema,
  PayoutStatusSchema,
  RefundPaymentSchema,
  ReleasePaymentSchema,
  type JwtClaims,
} from '@conexa/contracts';
import { validationError } from '@conexa/errors';
import { CurrentUser, JwtAuthGuard, Public, createServiceTokenGuard } from '@conexa/service-kit';
import type { RawBodyRequest } from '@nestjs/common';
import type { Request } from 'express';

import { env } from './config.js';
import { PaymentsService } from './payments.service.js';
import { ReconciliationService } from './reconciliation.service.js';

const ServiceTokenGuard = createServiceTokenGuard(env.SERVICE_TOKEN);

@Controller('payments')
export class PaymentsController {
  constructor(private readonly payments: PaymentsService) {}

  @UseGuards(JwtAuthGuard)
  @Post()
  create(@CurrentUser() user: JwtClaims, @Body() body: unknown) {
    return this.payments.create(user.sub, CreatePaymentSchema.parse(body));
  }

  @UseGuards(JwtAuthGuard)
  @Get(':id')
  get(@CurrentUser() user: JwtClaims, @Param('id') id: string) {
    return this.payments.getForPayer(id, user.sub);
  }

  /**
   * Webhook de l'agrégateur : public mais signé. Le corps brut est indispensable
   * (la signature couvre les octets reçus), et le statut est relu par l'API
   * avant toute transition.
   */
  @Public()
  @Post('webhooks/campay')
  @HttpCode(200)
  async webhook(
    @Req() request: RawBodyRequest<Request>,
    @Headers('x-campay-signature') signature: string | undefined,
    @Body() body: unknown,
  ): Promise<{ status: string }> {
    const raw = request.rawBody?.toString('utf8');
    if (!raw) {
      throw validationError('Corps brut indisponible pour vérifier la signature');
    }
    return this.payments.confirmWebhook(body, raw, signature);
  }
}

@Controller('me/payments')
export class MyPaymentsController {
  constructor(private readonly payments: PaymentsService) {}

  @UseGuards(JwtAuthGuard)
  @Get()
  list(@CurrentUser() user: JwtClaims) {
    return this.payments.listMine(user.sub);
  }
}

/**
 * Compte de reversement : numéro mobile money **dédié**, distinct du WhatsApp.
 * La réponse est toujours masquée ; le numéro en clair ne sort pas du service.
 */
@Controller('payout-accounts')
export class PayoutAccountsController {
  constructor(private readonly payments: PaymentsService) {}

  @UseGuards(JwtAuthGuard)
  @Get('me')
  get(@CurrentUser() user: JwtClaims) {
    return this.payments.payoutAccountFor(user.sub);
  }

  @UseGuards(JwtAuthGuard)
  @Post()
  @HttpCode(200)
  upsert(@CurrentUser() user: JwtClaims, @Body() body: unknown) {
    return this.payments.upsertPayoutAccount(user.sub, body);
  }
}

@Controller('internal')
export class PaymentsInternalController {
  constructor(
    private readonly payments: PaymentsService,
    private readonly reconciliation: ReconciliationService,
  ) {}

  @UseGuards(ServiceTokenGuard)
  @Post('payments/:id/release')
  @HttpCode(200)
  release(@Param('id') id: string, @Body() body: unknown) {
    return this.payments.release(id, ReleasePaymentSchema.parse(body));
  }

  @UseGuards(ServiceTokenGuard)
  @Post('payments/:id/refund')
  @HttpCode(200)
  refund(@Param('id') id: string, @Body() body: unknown) {
    RefundPaymentSchema.parse(body ?? {});
    return this.payments.refund(id);
  }

  @UseGuards(ServiceTokenGuard)
  @Get('payments/:id')
  get(@Param('id') id: string) {
    return this.payments.getInternal(id);
  }

  @UseGuards(ServiceTokenGuard)
  @Get('ledger/balance')
  balance() {
    return this.payments.ledgerBalance();
  }

  /** File « à traiter » : les reversements qui demandent une action humaine. */
  @UseGuards(ServiceTokenGuard)
  @Get('payouts')
  payouts(@Query('status') status: unknown) {
    const parsed = PayoutStatusSchema.safeParse(status);
    return this.payments.listPayouts(parsed.success ? parsed.data : 'queued');
  }

  @UseGuards(ServiceTokenGuard)
  @Post('payouts/:id/retry')
  @HttpCode(200)
  retry(@Param('id') id: string) {
    return this.payments.retryPayout(id);
  }

  @UseGuards(ServiceTokenGuard)
  @Get('reconciliation/latest')
  latest() {
    return this.reconciliation.latest();
  }

  /** Déclenchement manuel du rapprochement (preuve sur l'environnement demo). */
  @UseGuards(ServiceTokenGuard)
  @Post('reconciliation/run')
  @HttpCode(200)
  run(@Body() body: { day?: string } | undefined) {
    const day = body?.day ?? new Date().toISOString().slice(0, 10);
    return this.reconciliation.run(day);
  }
}
