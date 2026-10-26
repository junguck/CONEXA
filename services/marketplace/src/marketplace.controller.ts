import {
  Body,
  Controller,
  Delete,
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
  CancelOrderSchema,
  CreateListingSchema,
  CreateOrderSchema,
  DeliverOrderSchema,
  DisputeOrderSchema,
  ListingSearchSchema,
  OrderReviewSchema,
  PayOrderSchema,
  PutAvailabilitySchema,
  RevisionSchema,
  UpdateListingSchema,
  type JwtClaims,
} from '@conexa/contracts';
import { CurrentUser, JwtAuthGuard } from '@conexa/service-kit';
import { z } from 'zod';

import { ListingsService } from './listings.service.js';
import { OrdersService } from './orders.service.js';

const PackagesBodySchema = z.object({
  packages: z.array(
    z.object({
      tier: z.enum(['basic', 'standard', 'premium']),
      name: z.string().trim().min(2).max(60),
      description: z.string().trim().max(400).optional(),
      price_fcfa: z.number().int().min(500).max(5_000_000),
      delivery_days: z.number().int().min(1).max(60),
      revisions: z.number().int().min(0).max(10),
    }),
  ),
});

@UseGuards(JwtAuthGuard)
@Controller()
export class MarketplaceController {
  constructor(
    private readonly listings: ListingsService,
    private readonly orders: OrdersService,
  ) {}

  // --- offres ------------------------------------------------------------

  @Get('services/categories')
  categories() {
    return this.listings.categories();
  }

  @Get('services')
  search(@Query() query: Record<string, string>) {
    return this.listings.search(ListingSearchSchema.parse(query));
  }

  @Post('services')
  create(@CurrentUser() user: JwtClaims, @Body() body: unknown) {
    return this.listings.create(user.sub, CreateListingSchema.parse(body));
  }

  @Get('services/:id')
  get(@Param('id') id: string) {
    return this.listings.get(id);
  }

  @Patch('services/:id')
  update(@CurrentUser() user: JwtClaims, @Param('id') id: string, @Body() body: unknown) {
    return this.listings.update(user.sub, id, UpdateListingSchema.parse(body));
  }

  @Put('services/:id/packages')
  putPackages(@CurrentUser() user: JwtClaims, @Param('id') id: string, @Body() body: unknown) {
    const input = PackagesBodySchema.parse(body);
    return this.listings.putPackages(user.sub, id, input.packages);
  }

  @Put('services/:id/availability')
  @HttpCode(204)
  async putAvailability(
    @CurrentUser() user: JwtClaims,
    @Param('id') id: string,
    @Body() body: unknown,
  ): Promise<void> {
    const input = PutAvailabilitySchema.parse(body);
    await this.listings.putAvailability(user.sub, id, input.slots);
  }

  @Get('services/:id/availability')
  availability(@Param('id') id: string, @Query('from') from?: string, @Query('to') to?: string) {
    return this.listings.availability(id, from, to);
  }

  @Post('services/:id/submit')
  submit(@CurrentUser() user: JwtClaims, @Param('id') id: string) {
    return this.listings.submit(user.sub, id);
  }

  @Post('services/:id/pause')
  @HttpCode(204)
  async pause(@CurrentUser() user: JwtClaims, @Param('id') id: string): Promise<void> {
    await this.listings.pause(user.sub, id);
  }

  @Post('services/:id/resume')
  @HttpCode(204)
  async resume(@CurrentUser() user: JwtClaims, @Param('id') id: string): Promise<void> {
    await this.listings.resume(user.sub, id);
  }

  @Delete('services/:id')
  @HttpCode(204)
  async archive(@CurrentUser() user: JwtClaims, @Param('id') id: string): Promise<void> {
    await this.listings.archive(user.sub, id);
  }

  @Post('services/:id/favorite')
  @HttpCode(204)
  async favorite(@CurrentUser() user: JwtClaims, @Param('id') id: string): Promise<void> {
    await this.listings.favorite(user.sub, id);
  }

  @Delete('services/:id/favorite')
  @HttpCode(204)
  async unfavorite(@CurrentUser() user: JwtClaims, @Param('id') id: string): Promise<void> {
    await this.listings.unfavorite(user.sub, id);
  }

  @Get('me/favorites')
  favorites(@CurrentUser() user: JwtClaims) {
    return this.listings.favorites(user.sub);
  }

  @Get('services/:id/reviews')
  reviews(@Param('id') id: string) {
    return this.listings.reviewsFor(id);
  }

  @Get('me/seller-dashboard')
  dashboard(@CurrentUser() user: JwtClaims) {
    return this.listings.sellerDashboard(user.sub);
  }

  // --- commandes ---------------------------------------------------------

  @Post('service-orders')
  createOrder(@CurrentUser() user: JwtClaims, @Body() body: unknown) {
    return this.orders.create(user.sub, CreateOrderSchema.parse(body));
  }

  @Get('service-orders')
  listOrders(
    @CurrentUser() user: JwtClaims,
    @Query('role') role?: string,
    @Query('status') status?: string,
  ) {
    return this.orders.list(user.sub, role === 'provider' ? 'provider' : 'client', status);
  }

  @Get('service-orders/:id')
  getOrder(@CurrentUser() user: JwtClaims, @Param('id') id: string) {
    return this.orders.get(user.sub, id);
  }

  @Get('service-orders/:id/events')
  orderEvents(@CurrentUser() user: JwtClaims, @Param('id') id: string) {
    return this.orders.events(user.sub, id);
  }

  @Post('service-orders/:id/accept')
  accept(@CurrentUser() user: JwtClaims, @Param('id') id: string) {
    return this.orders.accept(user.sub, id);
  }

  @Post('service-orders/:id/pay')
  pay(@CurrentUser() user: JwtClaims, @Param('id') id: string, @Body() body: unknown) {
    return this.orders.pay(user.sub, id, PayOrderSchema.parse(body));
  }

  @Post('service-orders/:id/start')
  start(@CurrentUser() user: JwtClaims, @Param('id') id: string) {
    return this.orders.start(user.sub, id);
  }

  @Post('service-orders/:id/deliver')
  deliver(@CurrentUser() user: JwtClaims, @Param('id') id: string, @Body() body: unknown) {
    return this.orders.deliver(user.sub, id, DeliverOrderSchema.parse(body ?? {}));
  }

  @Post('service-orders/:id/request-revision')
  requestRevision(@CurrentUser() user: JwtClaims, @Param('id') id: string, @Body() body: unknown) {
    const input = RevisionSchema.parse(body);
    return this.orders.requestRevision(user.sub, id, input.reason);
  }

  @Post('service-orders/:id/complete')
  complete(@CurrentUser() user: JwtClaims, @Param('id') id: string) {
    return this.orders.complete(user.sub, id);
  }

  @Post('service-orders/:id/cancel')
  @HttpCode(204)
  async cancel(
    @CurrentUser() user: JwtClaims,
    @Param('id') id: string,
    @Body() body: unknown,
  ): Promise<void> {
    const input = CancelOrderSchema.parse(body ?? {});
    await this.orders.cancel(user.sub, id, input.reason);
  }

  @Post('service-orders/:id/dispute')
  @HttpCode(204)
  async dispute(
    @CurrentUser() user: JwtClaims,
    @Param('id') id: string,
    @Body() body: unknown,
  ): Promise<void> {
    await this.orders.dispute(user.sub, id, DisputeOrderSchema.parse(body));
  }

  @Post('service-orders/:id/review')
  @HttpCode(204)
  async review(
    @CurrentUser() user: JwtClaims,
    @Param('id') id: string,
    @Body() body: unknown,
  ): Promise<void> {
    const input = OrderReviewSchema.parse(body);
    await this.orders.review(user.sub, id, input);
  }
}
