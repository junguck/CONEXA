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
  ApplySchema,
  CheckinAttendanceSchema,
  CreateEventSchema,
  CreateMissionSchema,
  CreatePostSchema,
  CreateReviewSchema,
  DeliverSchema,
  DisputeSchema,
  FundMissionSchema,
  MeetupSchema,
  PostSearchSchema,
  PutSkillsSchema,
  TicketSchema,
  UpdatePostSchema,
  type JwtClaims,
} from '@conexa/contracts';
import { CurrentUser, JwtAuthGuard } from '@conexa/service-kit';

import { EventsService } from './events.service.js';
import { MissionsService } from './missions.service.js';
import { PostsService } from './posts.service.js';

@UseGuards(JwtAuthGuard)
@Controller()
export class TalentsController {
  constructor(
    private readonly posts: PostsService,
    private readonly missions: MissionsService,
    private readonly events: EventsService,
  ) {}

  // --- compétences -------------------------------------------------------

  @Get('skills')
  skills(@Query('q') q?: string) {
    return this.posts.skills(q);
  }

  @Get('me/skills')
  mySkills(@CurrentUser() user: JwtClaims) {
    return this.posts.userSkills(user.sub);
  }

  @Put('me/skills')
  @HttpCode(204)
  async putSkills(@CurrentUser() user: JwtClaims, @Body() body: unknown): Promise<void> {
    await this.posts.putSkills(user.sub, PutSkillsSchema.parse(body));
  }

  // --- publications ------------------------------------------------------

  @Post('posts')
  createPost(@CurrentUser() user: JwtClaims, @Body() body: unknown) {
    return this.posts.createPost(user.sub, CreatePostSchema.parse(body));
  }

  @Get('posts')
  listPosts(@CurrentUser() user: JwtClaims, @Query() query: Record<string, string>) {
    return this.posts.listPosts(user.sub, PostSearchSchema.parse(query));
  }

  @Get('posts/:id')
  getPost(@Param('id') id: string) {
    return this.posts.getPost(id);
  }

  @Patch('posts/:id')
  updatePost(@CurrentUser() user: JwtClaims, @Param('id') id: string, @Body() body: unknown) {
    return this.posts.updatePost(user.sub, id, UpdatePostSchema.parse(body));
  }

  @Post('posts/:id/close')
  @HttpCode(204)
  async closePost(@CurrentUser() user: JwtClaims, @Param('id') id: string): Promise<void> {
    await this.posts.setStatus(user.sub, id, 'closed');
  }

  @Delete('posts/:id')
  @HttpCode(204)
  async deletePost(@CurrentUser() user: JwtClaims, @Param('id') id: string): Promise<void> {
    await this.posts.setStatus(user.sub, id, 'deleted');
  }

  @Get('posts/:id/suggested-users')
  suggestedUsers(@CurrentUser() user: JwtClaims, @Param('id') id: string) {
    return this.posts.suggestedUsers(user.sub, id);
  }

  @Post('posts/:id/apply')
  async apply(@CurrentUser() user: JwtClaims, @Param('id') id: string, @Body() body: unknown) {
    const input = ApplySchema.parse(body ?? {});
    return this.posts.apply(user.sub, id, input.message);
  }

  @Get('posts/:id/applications')
  applications(@CurrentUser() user: JwtClaims, @Param('id') id: string) {
    return this.posts.applications(user.sub, id);
  }

  @Post('applications/:id/accept')
  @HttpCode(204)
  async acceptApplication(@CurrentUser() user: JwtClaims, @Param('id') id: string): Promise<void> {
    await this.posts.resolveApplication(user.sub, id, true);
  }

  @Post('applications/:id/decline')
  @HttpCode(204)
  async declineApplication(@CurrentUser() user: JwtClaims, @Param('id') id: string): Promise<void> {
    await this.posts.resolveApplication(user.sub, id, false);
  }

  @Post('applications/:id/withdraw')
  @HttpCode(204)
  async withdrawApplication(
    @CurrentUser() user: JwtClaims,
    @Param('id') id: string,
  ): Promise<void> {
    await this.posts.withdrawApplication(user.sub, id);
  }

  // --- missions ----------------------------------------------------------

  @Post('missions')
  proposeMission(@CurrentUser() user: JwtClaims, @Body() body: unknown) {
    return this.missions.propose(user.sub, CreateMissionSchema.parse(body));
  }

  @Get('missions')
  listMissions(
    @CurrentUser() user: JwtClaims,
    @Query('role') role?: string,
    @Query('status') status?: string,
  ) {
    return this.missions.list(user.sub, role === 'provider' ? 'provider' : 'client', status);
  }

  @Post('missions/:id/accept')
  acceptMission(@CurrentUser() user: JwtClaims, @Param('id') id: string) {
    return this.missions.accept(user.sub, id);
  }

  @Post('missions/:id/fund')
  fundMission(@CurrentUser() user: JwtClaims, @Param('id') id: string, @Body() body: unknown) {
    return this.missions.fund(user.sub, id, FundMissionSchema.parse(body));
  }

  @Post('missions/:id/deliver')
  deliverMission(@CurrentUser() user: JwtClaims, @Param('id') id: string, @Body() body: unknown) {
    return this.missions.deliver(user.sub, id, DeliverSchema.parse(body ?? {}));
  }

  @Post('missions/:id/approve')
  approveMission(@CurrentUser() user: JwtClaims, @Param('id') id: string) {
    return this.missions.approve(user.sub, id);
  }

  @Post('missions/:id/dispute')
  @HttpCode(204)
  async disputeMission(
    @CurrentUser() user: JwtClaims,
    @Param('id') id: string,
    @Body() body: unknown,
  ): Promise<void> {
    const input = DisputeSchema.parse(body);
    await this.missions.dispute(user.sub, id, input.reason);
  }

  @Post('missions/:id/cancel')
  @HttpCode(204)
  async cancelMission(@CurrentUser() user: JwtClaims, @Param('id') id: string): Promise<void> {
    await this.missions.cancel(user.sub, id);
  }

  // --- avis --------------------------------------------------------------

  @Post('reviews')
  createReview(@CurrentUser() user: JwtClaims, @Body() body: unknown) {
    return this.missions.createReview(user.sub, CreateReviewSchema.parse(body));
  }

  @Get('users/:id/reviews')
  reviews(@Param('id') id: string) {
    return this.missions.reviewsFor(id);
  }

  // --- événements --------------------------------------------------------

  @Get('events')
  listEvents(@Query('from') from?: string, @Query('status') status?: string) {
    return this.events.list(from, status);
  }

  @Post('events')
  createEvent(@CurrentUser() user: JwtClaims, @Body() body: unknown) {
    return this.events.create(user.sub, CreateEventSchema.parse(body));
  }

  @Get('events/:id')
  getEvent(@Param('id') id: string) {
    return this.events.get(id);
  }

  @Post('events/:id/register')
  register(@CurrentUser() user: JwtClaims, @Param('id') id: string) {
    return this.events.register(user.sub, id);
  }

  @Post('events/:id/tickets')
  ticket(@CurrentUser() user: JwtClaims, @Param('id') id: string, @Body() body: unknown) {
    return this.events.ticket(user.sub, id, TicketSchema.parse(body));
  }

  @Post('events/:id/checkin')
  @HttpCode(204)
  async checkin(
    @CurrentUser() user: JwtClaims,
    @Param('id') id: string,
    @Body() body: unknown,
  ): Promise<void> {
    const input = CheckinAttendanceSchema.parse(body);
    await this.events.checkin(user.sub, id, input.user_id);
  }

  // --- meetups -----------------------------------------------------------

  @Post('meetups')
  proposeMeetup(@CurrentUser() user: JwtClaims, @Body() body: unknown) {
    return this.missions.proposeMeetup(user.sub, MeetupSchema.parse(body));
  }

  @Get('meetups')
  listMeetups(@CurrentUser() user: JwtClaims) {
    return this.missions.listMeetups(user.sub);
  }

  @Post('meetups/:id/accept')
  @HttpCode(204)
  async acceptMeetup(@CurrentUser() user: JwtClaims, @Param('id') id: string): Promise<void> {
    await this.missions.resolveMeetup(user.sub, id, true);
  }

  @Post('meetups/:id/decline')
  @HttpCode(204)
  async declineMeetup(@CurrentUser() user: JwtClaims, @Param('id') id: string): Promise<void> {
    await this.missions.resolveMeetup(user.sub, id, false);
  }
}
