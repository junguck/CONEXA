import { Body, Controller, Get, HttpCode, Param, Patch, Post, UseGuards } from '@nestjs/common';
import {
  AdminDecisionSchema,
  MeSchema,
  OtpRequestSchema,
  OtpVerifySchema,
  RegisterSchema,
  ReportSchema,
  UpdateMeSchema,
  type JwtClaims,
} from '@conexa/contracts';
import { validationError } from '@conexa/errors';
import { CurrentUser, JwtAuthGuard, Public, Roles } from '@conexa/service-kit';
import type { z } from 'zod';

import { IdentityService } from './identity.service.js';
import { ServiceTokenGuard } from './service-token.guard.js';

@Controller()
export class IdentityController {
  constructor(private readonly identity: IdentityService) {}

  @Public()
  @Post('auth/otp/request')
  @HttpCode(204)
  async requestOtp(@Body() body: unknown): Promise<void> {
    const input = OtpRequestSchema.parse(body);
    await this.identity.requestOtp(input.whatsapp);
  }

  @Public()
  @Post('auth/otp/verify')
  @HttpCode(200)
  verifyOtp(@Body() body: unknown) {
    const input = OtpVerifySchema.parse(body);
    return this.identity.verifyOtp(input.whatsapp, input.code);
  }

  @Public()
  @Post('auth/refresh')
  @HttpCode(200)
  refresh(@Body() body: { refresh_token?: string }) {
    if (!body?.refresh_token) {
      throw validationError('refresh_token requis');
    }
    return this.identity.refresh(body.refresh_token);
  }

  @UseGuards(JwtAuthGuard)
  @Post('auth/logout')
  @HttpCode(204)
  async logout(@Body() body: { refresh_token?: string }): Promise<void> {
    if (body?.refresh_token) {
      await this.identity.logout(body.refresh_token);
    }
  }

  @UseGuards(JwtAuthGuard)
  @Post('me/register')
  async register(@CurrentUser() user: JwtClaims, @Body() body: unknown) {
    const input = RegisterSchema.parse(body);
    await this.identity.register(user.sub, input);
    return MeSchema.parse(await this.identity.me(user.sub));
  }

  @UseGuards(JwtAuthGuard)
  @Get('me')
  async me(@CurrentUser() user: JwtClaims) {
    return MeSchema.parse(await this.identity.me(user.sub));
  }

  @UseGuards(JwtAuthGuard)
  @Patch('me')
  async updateMe(@CurrentUser() user: JwtClaims, @Body() body: unknown) {
    const input: z.infer<typeof UpdateMeSchema> = UpdateMeSchema.parse(body);
    await this.identity.updateMe(user.sub, input);
    return MeSchema.parse(await this.identity.me(user.sub));
  }

  @UseGuards(JwtAuthGuard)
  @Get('me/reliability')
  reliability(@CurrentUser() user: JwtClaims) {
    return this.identity.reliability(user.sub);
  }

  @Public()
  @Get('filieres')
  filieres() {
    return this.identity.filieres();
  }

  @UseGuards(JwtAuthGuard)
  @Get('users/:id')
  user(@Param('id') id: string) {
    return this.identity.publicUser(id);
  }

  /**
   * Contact brut pour les autres services (Dating après deux « oui »). Jamais
   * routé par la Gateway : appel direct du service à service avec x-service-token.
   */
  @Public()
  @UseGuards(ServiceTokenGuard)
  @Get('internal/users/:id/contact')
  internalContact(@Param('id') id: string) {
    return this.identity.internalContact(id);
  }

  @UseGuards(JwtAuthGuard)
  @Post('reports')
  async report(@CurrentUser() user: JwtClaims, @Body() body: unknown) {
    const input = ReportSchema.parse(body);
    await this.identity.report(user.sub, input);
    return { id: null };
  }

  @UseGuards(JwtAuthGuard)
  @Roles('admin', 'moderator')
  @Get('admin/users')
  pending() {
    return this.identity.pendingUsers();
  }

  @UseGuards(JwtAuthGuard)
  @Roles('admin', 'moderator')
  @Post('admin/users/:id/approve')
  @HttpCode(204)
  async approve(
    @CurrentUser() user: JwtClaims,
    @Param('id') id: string,
    @Body() body: unknown,
  ): Promise<void> {
    const input = AdminDecisionSchema.parse(body ?? {});
    await this.identity.decide(user.sub, id, 'approve', input.reason);
  }

  @UseGuards(JwtAuthGuard)
  @Roles('admin', 'moderator')
  @Post('admin/users/:id/reject')
  @HttpCode(204)
  async reject(
    @CurrentUser() user: JwtClaims,
    @Param('id') id: string,
    @Body() body: unknown,
  ): Promise<void> {
    const input = AdminDecisionSchema.parse(body ?? {});
    await this.identity.decide(user.sub, id, 'reject', input.reason);
  }
}
