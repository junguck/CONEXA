import { Body, Controller, Get, HttpCode, Param, Post, Query, UseGuards } from '@nestjs/common';
import {
  CreateNotificationSchema,
  CreateThreadSchema,
  SendMessageSchema,
  type JwtClaims,
} from '@conexa/contracts';
import { CurrentUser, JwtAuthGuard, createServiceTokenGuard } from '@conexa/service-kit';

import { env } from './config.js';
import { MessagingService } from './messaging.service.js';

const ServiceTokenGuard = createServiceTokenGuard(env.SERVICE_TOKEN);

@Controller('messaging/threads')
export class ThreadsController {
  constructor(private readonly messaging: MessagingService) {}

  @UseGuards(JwtAuthGuard)
  @Get()
  list(@CurrentUser() user: JwtClaims) {
    return this.messaging.listThreads(user.sub);
  }

  @UseGuards(JwtAuthGuard)
  @Get(':id/messages')
  messages(
    @CurrentUser() user: JwtClaims,
    @Param('id') id: string,
    @Query('before') before?: string,
  ) {
    return this.messaging.listMessages(user.sub, id, before);
  }

  @UseGuards(JwtAuthGuard)
  @Post(':id/messages')
  send(@CurrentUser() user: JwtClaims, @Param('id') id: string, @Body() body: unknown) {
    return this.messaging.sendMessage(user.sub, id, SendMessageSchema.parse(body));
  }

  @UseGuards(JwtAuthGuard)
  @Post(':id/read')
  @HttpCode(204)
  async read(@CurrentUser() user: JwtClaims, @Param('id') id: string): Promise<void> {
    await this.messaging.markRead(user.sub, id);
  }
}

@Controller('notifications')
export class NotificationsController {
  constructor(private readonly messaging: MessagingService) {}

  @UseGuards(JwtAuthGuard)
  @Get()
  list(@CurrentUser() user: JwtClaims) {
    return this.messaging.listNotifications(user.sub);
  }

  @UseGuards(JwtAuthGuard)
  @Post('read')
  @HttpCode(200)
  read(@CurrentUser() user: JwtClaims) {
    return this.messaging.markNotificationsRead(user.sub);
  }
}

@Controller('internal')
export class MessagingInternalController {
  constructor(private readonly messaging: MessagingService) {}

  @UseGuards(ServiceTokenGuard)
  @Post('threads')
  @HttpCode(200)
  createThread(@Body() body: unknown) {
    return this.messaging.createThread(CreateThreadSchema.parse(body));
  }

  @UseGuards(ServiceTokenGuard)
  @Post('notifications')
  @HttpCode(201)
  notify(@Body() body: unknown) {
    return this.messaging.notify(CreateNotificationSchema.parse(body));
  }
}
