import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  DispatchPushSchema,
  RegisterSubscriptionSchema,
  type JwtClaims,
} from '@conexa/contracts';
import { CurrentUser, JwtAuthGuard, createServiceTokenGuard } from '@conexa/service-kit';

import { env } from './config.js';
import { NotificationsService } from './notifications.service.js';

const ServiceTokenGuard = createServiceTokenGuard(env.SERVICE_TOKEN);

@Controller('push')
export class PushController {
  constructor(private readonly notifications: NotificationsService) {}

  /** Clé publique VAPID ; le service worker s'en sert pour s'abonner. */
  @UseGuards(JwtAuthGuard)
  @Get('key')
  key() {
    return this.notifications.vapidPublicKey();
  }

  @UseGuards(JwtAuthGuard)
  @Post('subscriptions')
  register(@CurrentUser() user: JwtClaims, @Body() body: unknown) {
    return this.notifications.register(user.sub, RegisterSubscriptionSchema.parse(body));
  }

  @UseGuards(JwtAuthGuard)
  @Get('subscriptions')
  list(@CurrentUser() user: JwtClaims) {
    return this.notifications.list(user.sub);
  }

  @UseGuards(JwtAuthGuard)
  @Delete('subscriptions/:id')
  @HttpCode(204)
  async remove(@CurrentUser() user: JwtClaims, @Param('id') id: string): Promise<void> {
    await this.notifications.remove(user.sub, id);
  }

  /** Journal d'envoi du propriétaire : sert au diagnostic côté app. */
  @UseGuards(JwtAuthGuard)
  @Get('deliveries')
  deliveries(@CurrentUser() user: JwtClaims) {
    return this.notifications.deliveries(user.sub);
  }
}

@Controller('internal/push')
export class PushInternalController {
  constructor(private readonly notifications: NotificationsService) {}

  /** Les domaines poussent une notification ; l'utilisateur vient du domaine. */
  @UseGuards(ServiceTokenGuard)
  @Post()
  @HttpCode(202)
  dispatch(@Body() body: unknown) {
    return this.notifications.dispatch(DispatchPushSchema.parse(body));
  }
}
