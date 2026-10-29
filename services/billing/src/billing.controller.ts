import { Body, Controller, Get, HttpCode, Param, Post, Query, UseGuards } from '@nestjs/common';
import {
  ActivateSubscriptionSchema,
  PlanAudienceSchema,
  SubscribeSchema,
  type JwtClaims,
} from '@conexa/contracts';
import { AppError } from '@conexa/errors';
import { CurrentUser, JwtAuthGuard, Public, createServiceTokenGuard } from '@conexa/service-kit';
import { z } from 'zod';

import { BillingService } from './billing.service.js';
import { env } from './config.js';

const ServiceTokenGuard = createServiceTokenGuard(env.SERVICE_TOKEN);

/** Rôle porté par le jeton : sert à choisir le plan gratuit de repli. */
function primaryRole(user: JwtClaims): string {
  return user.roles[0] ?? 'student';
}

@Controller('billing')
export class BillingController {
  constructor(private readonly billing: BillingService) {}

  @Public()
  @Get('plans')
  plans() {
    return this.billing.listPlans();
  }

  @UseGuards(JwtAuthGuard)
  @Get('me')
  me(@CurrentUser() user: JwtClaims) {
    return this.billing.me(user.sub, primaryRole(user));
  }

  @UseGuards(JwtAuthGuard)
  @Post('subscriptions')
  subscribe(@CurrentUser() user: JwtClaims, @Body() body: unknown) {
    const input = SubscribeSchema.parse(body);
    return this.billing.subscribe(user.sub, input.plan_code, primaryRole(user), input.promo_code);
  }

  @UseGuards(JwtAuthGuard)
  @Get('invoices')
  invoices(@CurrentUser() user: JwtClaims) {
    return this.billing.listInvoices(user.sub);
  }

  @UseGuards(JwtAuthGuard)
  @Post('subscriptions/:id/activate')
  @HttpCode(200)
  activate(@CurrentUser() user: JwtClaims, @Param('id') id: string, @Body() body: unknown) {
    const input = ActivateSubscriptionSchema.parse(body);
    return this.billing.activate(user.sub, id, input.payment_id);
  }

  @UseGuards(JwtAuthGuard)
  @Post('subscriptions/:id/cancel')
  @HttpCode(200)
  cancel(@CurrentUser() user: JwtClaims, @Param('id') id: string, @Body() body: unknown) {
    // `at_period_end` : la résiliation devient effective à la fin de la
    // période en cours (§7.5), le balayage quotidien cloturera.
    const parsed = z.object({ at_period_end: z.boolean().optional() }).safeParse(body);
    if (!parsed.success) {
      throw new AppError('VALIDATION_ERROR', 'at_period_end doit être un booléen');
    }
    return this.billing.cancel(user.sub, id, parsed.data);
  }
}
@Controller('internal/entitlements')
export class BillingInternalController {
  constructor(private readonly billing: BillingService) {}

  @UseGuards(ServiceTokenGuard)
  @Get(':userId')
  entitlements(@Param('userId') userId: string, @Query('audience') audience: unknown) {
    const parsed = PlanAudienceSchema.safeParse(audience);
    return this.billing.entitlementsFor(userId, parsed.success ? parsed.data : undefined);
  }

  /**
   * Forme demandée par `ARCHITECTURE.md` §7.1 : un sujet typé. `user` est le
   * seul type réellement stocké aujourd'hui ; les autres sont refusés, pas
   * inventés.
   */
  @UseGuards(ServiceTokenGuard)
  @Get(':kind/:id')
  entitlementsForSubject(
    @Param('kind') kind: string,
    @Param('id') id: string,
    @Query('audience') audience: unknown,
  ) {
    if (kind !== 'user') {
      throw new AppError('VALIDATION_ERROR', 'Type de sujet non géré par Billing', { kind });
    }
    const parsed = PlanAudienceSchema.safeParse(audience);
    return this.billing.entitlementsFor(id, parsed.success ? parsed.data : undefined);
  }
}

/** Déclencheurs exploit billing : appels par un compte de service. */
@UseGuards(ServiceTokenGuard)
@Controller('internal/billing/jobs')
export class BillingJobsController {
  constructor(private readonly billing: BillingService) {}

  /** Balayage quotidien : grâce, expiration, résiliations différées. */
  @Post('daily-sweep')
  @HttpCode(200)
  dailySweep() {
    return this.billing.runDailySweep();
  }
}
