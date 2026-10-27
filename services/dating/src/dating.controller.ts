import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  CARD_CATALOG,
  CheckinSchema,
  DateFeedbackSchema,
  PatchPreferencesSchema,
  PutDatingProfileSchema,
  QUESTIONNAIRE_BLOCKS,
  QUESTIONNAIRE_VERSION,
  SendCardSchema,
  type JwtClaims,
} from '@conexa/contracts';
import { validationError } from '@conexa/errors';
import { CurrentUser, JwtAuthGuard } from '@conexa/service-kit';

import { DatesService } from './dates.service.js';
import { DatingService } from './dating.service.js';

@UseGuards(JwtAuthGuard)
@Controller()
export class DatingController {
  constructor(
    private readonly dating: DatingService,
    private readonly dates: DatesService,
  ) {}

  @Get('dating/eligibility')
  eligibility(@CurrentUser() user: JwtClaims) {
    return this.dating.eligibility(user.sub);
  }

  @Get('dating/questions')
  questions() {
    return { version: QUESTIONNAIRE_VERSION, blocks: QUESTIONNAIRE_BLOCKS };
  }

  @Get('dating/profile')
  profile(@CurrentUser() user: JwtClaims) {
    return this.dating.profile(user.sub);
  }

  @Put('dating/profile')
  putProfile(@CurrentUser() user: JwtClaims, @Body() body: unknown) {
    return this.dating.putProfile(user.sub, PutDatingProfileSchema.parse(body));
  }

  @Patch('dating/preferences')
  @HttpCode(204)
  async preferences(@CurrentUser() user: JwtClaims, @Body() body: unknown): Promise<void> {
    await this.dating.patchPreferences(user.sub, PatchPreferencesSchema.parse(body));
  }

  @Post('dating/pause')
  @HttpCode(204)
  async pause(@CurrentUser() user: JwtClaims): Promise<void> {
    await this.dating.setPaused(user.sub, true);
  }

  @Post('dating/resume')
  @HttpCode(204)
  async resume(@CurrentUser() user: JwtClaims): Promise<void> {
    await this.dating.setPaused(user.sub, false);
  }

  @Get('dating/picks/current')
  picks(@CurrentUser() user: JwtClaims) {
    return this.dating.currentPicks(user.sub);
  }

  @Post('dating/picks/:id/invite')
  invite(@CurrentUser() user: JwtClaims, @Param('id') pickId: string) {
    return this.dating.inviteFromPick(user.sub, pickId);
  }

  @Post('dating/picks/:id/pass')
  @HttpCode(204)
  async pass(@CurrentUser() user: JwtClaims, @Param('id') pickId: string): Promise<void> {
    await this.dating.passPick(user.sub, pickId);
  }

  @Get('dating/invites')
  invites(@CurrentUser() user: JwtClaims, @Query('box') box?: string) {
    return this.dating.listInvites(user.sub, box === 'sent' ? 'sent' : 'received');
  }

  @Post('dating/invites/:id/accept')
  async accept(@CurrentUser() user: JwtClaims, @Param('id') inviteId: string) {
    const { date_id } = await this.dating.acceptInvite(user.sub, inviteId);
    return this.dates.get(user.sub, date_id);
  }

  @Post('dating/invites/:id/decline')
  @HttpCode(204)
  async decline(@CurrentUser() user: JwtClaims, @Param('id') inviteId: string): Promise<void> {
    await this.dating.declineInvite(user.sub, inviteId);
  }

  @Post('dating/invites/:id/withdraw')
  @HttpCode(204)
  async withdraw(@CurrentUser() user: JwtClaims, @Param('id') inviteId: string): Promise<void> {
    await this.dating.withdrawInvite(user.sub, inviteId);
  }

  // --- dates -------------------------------------------------------------

  @Get('dates/card-catalog')
  cardCatalog() {
    return CARD_CATALOG;
  }

  @Get('dates')
  listDates(@CurrentUser() user: JwtClaims, @Query('status') status?: string) {
    return this.dates.list(user.sub, status);
  }

  @Get('dates/:id')
  getDate(@CurrentUser() user: JwtClaims, @Param('id') id: string) {
    return this.dates.get(user.sub, id);
  }

  @Get('dates/:id/cards')
  cards(@CurrentUser() user: JwtClaims, @Param('id') id: string) {
    return this.dates.cards(user.sub, id);
  }

  @Post('dates/:id/cards')
  sendCard(@CurrentUser() user: JwtClaims, @Param('id') id: string, @Body() body: unknown) {
    return this.dates.sendCard(user.sub, id, SendCardSchema.parse(body));
  }

  @Post('dates/:id/slot')
  async setSlot(
    @CurrentUser() user: JwtClaims,
    @Param('id') id: string,
    @Body() body: { slot_id?: string },
  ) {
    if (!body?.slot_id) {
      throw validationError('slot_id requis');
    }
    return this.dates.setSlot(user.sub, id, body.slot_id);
  }

  @Post('dates/:id/formula')
  async setFormula(
    @CurrentUser() user: JwtClaims,
    @Param('id') id: string,
    @Body() body: { formula_id?: string },
  ) {
    if (!body?.formula_id) {
      throw validationError('formula_id requis');
    }
    return this.dates.setFormula(user.sub, id, body.formula_id);
  }

  @Post('dates/:id/orders')
  orders(@CurrentUser() user: JwtClaims, @Param('id') id: string, @Body() body: unknown) {
    const input = body as {
      items?: Array<{ menu_item_id?: string; quantity?: number; unit_price_fcfa?: number }>;
      allergy_note?: string;
    };
    if (!Array.isArray(input?.items) || input.items.length === 0) {
      throw validationError('items requis');
    }
    const items = input.items.map((item) => {
      if (
        !item.menu_item_id ||
        typeof item.quantity !== 'number' ||
        typeof item.unit_price_fcfa !== 'number'
      ) {
        throw validationError('Chaque ligne exige menu_item_id, quantity et unit_price_fcfa');
      }
      return {
        menu_item_id: item.menu_item_id,
        quantity: item.quantity,
        unit_price_fcfa: item.unit_price_fcfa,
      };
    });
    return this.dates.addOrders(user.sub, id, {
      items,
      ...(input.allergy_note === undefined ? {} : { allergy_note: input.allergy_note }),
    });
  }

  @Post('dates/:id/pay')
  pay(@CurrentUser() user: JwtClaims, @Param('id') id: string) {
    return this.dates.pay(user.sub, id);
  }

  @Post('dates/:id/cancel')
  @HttpCode(204)
  async cancel(@CurrentUser() user: JwtClaims, @Param('id') id: string): Promise<void> {
    await this.dates.cancel(user.sub, id);
  }

  @Post('dates/:id/checkin')
  checkin(@CurrentUser() user: JwtClaims, @Param('id') id: string, @Body() body: unknown) {
    const input = CheckinSchema.parse(body);
    return this.dates.checkin(user.sub, id, input.code);
  }

  @Post('dates/:id/sos')
  @HttpCode(204)
  async sos(@CurrentUser() user: JwtClaims, @Param('id') id: string): Promise<void> {
    await this.dates.sos(user.sub, id);
  }

  @Post('dates/:id/feedback')
  @HttpCode(204)
  async feedback(
    @CurrentUser() user: JwtClaims,
    @Param('id') id: string,
    @Body() body: unknown,
  ): Promise<void> {
    const input = DateFeedbackSchema.parse(body);
    await this.dates.feedback(user.sub, id, input);
  }

  @Get('dates/:id/contact')
  contact(@CurrentUser() user: JwtClaims, @Param('id') id: string) {
    return this.dates.contact(user.sub, id);
  }

  @Get('me/credits')
  credits(@CurrentUser() user: JwtClaims) {
    return this.dating.credits(user.sub);
  }
}
