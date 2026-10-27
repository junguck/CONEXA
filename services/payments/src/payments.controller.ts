import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  Param,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  CreatePaymentSchema,
  PaymentWebhookSchema,
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

  /** Webhook de l'agrégateur : public mais signé (HMAC du corps brut). */
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
    this.payments.verifySignature(raw, signature);
    return this.payments.confirmWebhook(PaymentWebhookSchema.parse(body), raw);
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

@Controller('internal')
export class PaymentsInternalController {
  constructor(private readonly payments: PaymentsService) {}

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
}
