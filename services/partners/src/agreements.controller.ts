import { Body, Controller, Get, HttpCode, Param, Post, UseGuards } from '@nestjs/common';
import { ProposeAgreementSchema, type JwtClaims } from '@conexa/contracts';
import { CurrentUser, JwtAuthGuard, Roles } from '@conexa/service-kit';

import { AgreementsService } from './agreements.service.js';

@Controller('partners')
export class AgreementsController {
  constructor(private readonly agreements: AgreementsService) {}

  @UseGuards(JwtAuthGuard)
  @Roles('partner_staff', 'admin')
  @Get('organisations/:id/agreements')
  list(@CurrentUser() user: JwtClaims, @Param('id') id: string) {
    return this.agreements.list(user, id);
  }

  /** Seule l'administration propose un contrat (taux négocié). */
  @UseGuards(JwtAuthGuard)
  @Roles('admin')
  @Post('organisations/:id/agreements')
  propose(@Param('id') id: string, @Body() body: unknown) {
    return this.agreements.propose(id, ProposeAgreementSchema.parse(body));
  }

  /** Seul le propriétaire de l'organisation signe. */
  @UseGuards(JwtAuthGuard)
  @Roles('partner_staff')
  @Post('agreements/:id/sign')
  @HttpCode(200)
  sign(@CurrentUser() user: JwtClaims, @Param('id') id: string) {
    return this.agreements.sign(user, id);
  }
}
