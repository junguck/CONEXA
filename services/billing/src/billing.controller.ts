import { Body, Controller, Get, HttpCode, Param, Post, Query, UseGuards } from '@nestjs/common';
import {
  ActivateSubscriptionSchema,
  PlanAudienceSchema,
  SubscribeSchema,
  type JwtClaims,
} from '@conexa/contracts';
import { CurrentUser, JwtAuthGuard, Public, createServiceTokenGuard } from '@conexa/service-kit';

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
    return this.billing.subscribe(user.sub, input.plan_code, primaryRole(user));
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
  cancel(@CurrentUser() user: JwtClaims, @Param('id') id: string) {
    return this.billing.cancel(user.sub, id);
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
}
