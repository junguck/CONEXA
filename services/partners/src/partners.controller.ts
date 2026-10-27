import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import {
  CreateFormulaSchema,
  PartnerStatusUpdateSchema,
  CreateMenuItemSchema,
  CreateOfferSchema,
  CreateOrganisationSchema,
  CreateSlotSchema,
  CreateVenueSchema,
  type JwtClaims,
} from '@conexa/contracts';
import { CurrentUser, JwtAuthGuard, Roles } from '@conexa/service-kit';

import { PartnersService } from './partners.service.js';

/** Écriture réservée au personnel partenaire ; l'administration peut tout. */
const PARTNER_WRITE = ['partner_staff', 'admin'] as const;

@Controller('partners/organisations')
export class OrganisationsController {
  constructor(private readonly partners: PartnersService) {}

  @UseGuards(JwtAuthGuard)
  @Roles(...PARTNER_WRITE)
  @Post()
  create(@CurrentUser() user: JwtClaims, @Body() body: unknown) {
    return this.partners.createOrganisation(user.sub, CreateOrganisationSchema.parse(body));
  }

  @UseGuards(JwtAuthGuard)
  @Get()
  mine(@CurrentUser() user: JwtClaims) {
    return this.partners.myOrganisations(user.sub);
  }

  @UseGuards(JwtAuthGuard)
  @Get(':id')
  one(@Param('id') id: string) {
    return this.partners.organisation(id);
  }

  /** Seule l'administration valide un partenaire : un staff ne s'auto-active pas. */
  @UseGuards(JwtAuthGuard)
  @Roles('admin')
  @Post(':id/status')
  setStatus(@Param('id') id: string, @Body() body: unknown) {
    return this.partners.setOrganisationStatus(id, PartnerStatusUpdateSchema.parse(body).status);
  }

  @UseGuards(JwtAuthGuard)
  @Roles(...PARTNER_WRITE)
  @Post(':id/venues')
  addVenue(@CurrentUser() user: JwtClaims, @Param('id') id: string, @Body() body: unknown) {
    return this.partners.createVenue(user.sub, id, CreateVenueSchema.parse(body));
  }

  @UseGuards(JwtAuthGuard)
  @Roles(...PARTNER_WRITE)
  @Post(':id/offers')
  addOffer(@CurrentUser() user: JwtClaims, @Param('id') id: string, @Body() body: unknown) {
    return this.partners.createOffer(user.sub, id, CreateOfferSchema.parse(body));
  }
}

@Controller('partners/venues')
export class VenuesController {
  constructor(private readonly partners: PartnersService) {}

  @UseGuards(JwtAuthGuard)
  @Get()
  search(@Query('city') city?: string, @Query('kind') kind?: string) {
    return this.partners.searchVenues({ city, kind });
  }

  @UseGuards(JwtAuthGuard)
  @Get(':id')
  detail(@Param('id') id: string) {
    return this.partners.venueDetail(id);
  }

  @UseGuards(JwtAuthGuard)
  @Get(':id/slots')
  slots(@Param('id') id: string, @Query('date') date?: string) {
    return this.partners.upcomingSlots(id, date);
  }

  @UseGuards(JwtAuthGuard)
  @Roles('admin')
  @Post(':id/status')
  setStatus(@Param('id') id: string, @Body() body: unknown) {
    return this.partners.setVenueStatus(id, PartnerStatusUpdateSchema.parse(body).status);
  }

  @UseGuards(JwtAuthGuard)
  @Roles(...PARTNER_WRITE)
  @Post(':id/menu-items')
  addMenuItem(@CurrentUser() user: JwtClaims, @Param('id') id: string, @Body() body: unknown) {
    return this.partners.addMenuItem(user.sub, id, CreateMenuItemSchema.parse(body));
  }

  @UseGuards(JwtAuthGuard)
  @Roles(...PARTNER_WRITE)
  @Post(':id/formulas')
  addFormula(@CurrentUser() user: JwtClaims, @Param('id') id: string, @Body() body: unknown) {
    return this.partners.addFormula(user.sub, id, CreateFormulaSchema.parse(body));
  }

  @UseGuards(JwtAuthGuard)
  @Roles(...PARTNER_WRITE)
  @Post(':id/slots')
  addSlot(@CurrentUser() user: JwtClaims, @Param('id') id: string, @Body() body: unknown) {
    return this.partners.addSlot(user.sub, id, CreateSlotSchema.parse(body));
  }
}

@Controller('partners/offers')
export class OffersController {
  constructor(private readonly partners: PartnersService) {}

  @UseGuards(JwtAuthGuard)
  @Get()
  list(@Query('city') city?: string) {
    return this.partners.searchOffers(city);
  }

  @UseGuards(JwtAuthGuard)
  @Post(':id/redeem')
  redeem(@CurrentUser() user: JwtClaims, @Param('id') id: string) {
    return this.partners.redeem(user.sub, id);
  }
}
