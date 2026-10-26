import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  CreateChallengeSchema,
  CreateTeamSchema,
  MatchReportSchema,
  MatchSearchSchema,
  PlayerRankingQuerySchema,
  SetLineupSchema,
  SetMemberPositionSchema,
  TeamRankingQuerySchema,
  TeamSearchSchema,
  TransferCaptainSchema,
  UpdateTeamSchema,
  ContestMatchSchema,
  MvpVoteSchema,
  CancelMatchSchema,
  CounterChallengeSchema,
  InviteTeamMemberSchema,
  type JwtClaims,
} from '@conexa/contracts';
import { CurrentUser, JwtAuthGuard } from '@conexa/service-kit';

import { db } from './db.js';
import { MatchReportService } from './match-report.service.js';
import { MatchesService } from './matches.service.js';
import { RankingsService } from './rankings.service.js';
import { TeamsService } from './teams.service.js';

@UseGuards(JwtAuthGuard)
@Controller()
export class FootballController {
  constructor(
    private readonly teams: TeamsService,
    private readonly matches: MatchesService,
    private readonly reports: MatchReportService,
    private readonly rankings: RankingsService,
  ) {}

  // --- équipes -----------------------------------------------------------

  @Post('teams')
  createTeam(@CurrentUser() user: JwtClaims, @Body() body: unknown) {
    return this.teams.create(user.sub, CreateTeamSchema.parse(body));
  }

  @Get('teams')
  listTeams(@Query() query: Record<string, string>) {
    return this.teams.list(TeamSearchSchema.parse(query));
  }

  @Get('teams/:id')
  getTeam(@Param('id') id: string) {
    return this.teams.get(id);
  }

  @Patch('teams/:id')
  updateTeam(@CurrentUser() user: JwtClaims, @Param('id') id: string, @Body() body: unknown) {
    return this.teams.update(user.sub, id, UpdateTeamSchema.parse(body));
  }

  @Delete('teams/:id')
  @HttpCode(204)
  async dissolve(@CurrentUser() user: JwtClaims, @Param('id') id: string): Promise<void> {
    await this.teams.dissolve(user.sub, id);
  }

  @Get('me/team')
  myTeam(@CurrentUser() user: JwtClaims) {
    return this.teams.myTeam(user.sub);
  }

  @Get('teams/:id/members')
  members(@Param('id') id: string) {
    return this.teams.members(id);
  }

  @Post('teams/:id/invites')
  @HttpCode(204)
  async invite(
    @CurrentUser() user: JwtClaims,
    @Param('id') id: string,
    @Body() body: unknown,
  ): Promise<void> {
    const input = InviteTeamMemberSchema.parse(body);
    await this.teams.inviteMember(user.sub, id, input.user_id);
  }

  @Post('teams/:id/join-requests')
  @HttpCode(204)
  async requestJoin(@CurrentUser() user: JwtClaims, @Param('id') id: string): Promise<void> {
    await this.teams.requestJoin(user.sub, id);
  }

  @Get('teams/:id/join-requests')
  joinRequests(@CurrentUser() user: JwtClaims, @Param('id') id: string) {
    return this.teams.pendingRequests(user.sub, id);
  }

  @Get('me/team-invites')
  myInvites(@CurrentUser() user: JwtClaims) {
    return this.teams.myInvites(user.sub);
  }

  @Post('team-invites/:id/accept')
  @HttpCode(204)
  async acceptInvite(@CurrentUser() user: JwtClaims, @Param('id') id: string): Promise<void> {
    await this.teams.resolveInvite(user.sub, id, true);
  }

  @Post('team-invites/:id/decline')
  @HttpCode(204)
  async declineInvite(@CurrentUser() user: JwtClaims, @Param('id') id: string): Promise<void> {
    await this.teams.resolveInvite(user.sub, id, false);
  }

  @Post('teams/:id/members/:userId/remove')
  @HttpCode(204)
  async removeMember(
    @CurrentUser() user: JwtClaims,
    @Param('id') id: string,
    @Param('userId') memberId: string,
  ): Promise<void> {
    await this.teams.removeMember(user.sub, id, memberId);
  }

  @Post('teams/:id/leave')
  @HttpCode(204)
  async leave(@CurrentUser() user: JwtClaims, @Param('id') id: string): Promise<void> {
    await this.teams.leave(user.sub, id);
  }

  @Post('teams/:id/transfer-captain')
  @HttpCode(204)
  async transferCaptain(
    @CurrentUser() user: JwtClaims,
    @Param('id') id: string,
    @Body() body: unknown,
  ): Promise<void> {
    const input = TransferCaptainSchema.parse(body);
    await this.teams.transferCaptain(user.sub, id, input.user_id);
  }

  @Patch('teams/:id/members/:userId')
  @HttpCode(204)
  async setPosition(
    @CurrentUser() user: JwtClaims,
    @Param('id') id: string,
    @Param('userId') memberId: string,
    @Body() body: unknown,
  ): Promise<void> {
    const input = SetMemberPositionSchema.parse(body);
    await this.teams.setPosition(user.sub, id, memberId, input.position);
  }

  @Get('teams/:id/matches')
  teamMatches(@Param('id') id: string, @Query() query: Record<string, string>) {
    return this.matches.listMatches(MatchSearchSchema.parse({ ...query, team_id: id }));
  }

  @Get('teams/:id/elo-history')
  eloHistory(@Param('id') id: string) {
    return this.rankings.eloHistory(id);
  }

  @Get('teams/:id/stats')
  teamStats(@Param('id') id: string) {
    return this.rankings.teamStats(id);
  }

  // --- terrains et défis -------------------------------------------------

  @Get('fields')
  fields() {
    return this.rankings.fields();
  }

  @Post('challenges')
  createChallenge(@CurrentUser() user: JwtClaims, @Body() body: unknown) {
    return this.matches.createChallenge(user.sub, CreateChallengeSchema.parse(body));
  }

  @Get('challenges')
  listChallenges(
    @CurrentUser() user: JwtClaims,
    @Query('box') box: 'sent' | 'received' = 'received',
    @Query('status') status?: string,
  ) {
    return this.matches.listChallenges(user.sub, box === 'sent' ? 'sent' : 'received', status);
  }

  @Post('challenges/:id/accept')
  acceptChallenge(@CurrentUser() user: JwtClaims, @Param('id') id: string) {
    return this.matches.acceptChallenge(user.sub, id);
  }

  @Post('challenges/:id/decline')
  @HttpCode(204)
  async declineChallenge(@CurrentUser() user: JwtClaims, @Param('id') id: string): Promise<void> {
    await this.matches.declineChallenge(user.sub, id);
  }

  @Post('challenges/:id/counter')
  counterChallenge(@CurrentUser() user: JwtClaims, @Param('id') id: string, @Body() body: unknown) {
    return this.matches.counterChallenge(user.sub, id, CounterChallengeSchema.parse(body));
  }

  @Post('challenges/:id/cancel')
  @HttpCode(204)
  async cancelChallenge(@CurrentUser() user: JwtClaims, @Param('id') id: string): Promise<void> {
    await this.matches.cancelChallenge(user.sub, id);
  }

  // --- matchs ------------------------------------------------------------

  @Get('matches')
  listMatches(@Query() query: Record<string, string>) {
    return this.matches.listMatches(MatchSearchSchema.parse(query));
  }

  @Get('matches/:id')
  matchDetail(@Param('id') id: string) {
    return this.matches.matchDetail(id);
  }

  @Post('matches/:id/lineup')
  @HttpCode(204)
  async setLineup(
    @CurrentUser() user: JwtClaims,
    @Param('id') id: string,
    @Body() body: unknown,
  ): Promise<void> {
    const input = SetLineupSchema.parse(body);
    await this.reports.setLineup(user.sub, id, input.player_ids);
  }

  @Post('matches/:id/report')
  report(@CurrentUser() user: JwtClaims, @Param('id') id: string, @Body() body: unknown) {
    return this.reports.report(user.sub, id, MatchReportSchema.parse(body));
  }

  @Get('matches/:id/report')
  async myReport(@CurrentUser() user: JwtClaims, @Param('id') id: string) {
    const row = await db
      .selectFrom('match_reports')
      .selectAll()
      .where('match_id', '=', id)
      .where('submitted_by', '=', user.sub)
      .executeTakeFirst();
    if (!row) {
      return null;
    }
    return {
      score_a: row.score_a,
      score_b: row.score_b,
      events: row.events,
      submitted_at: row.submitted_at.toISOString(),
    };
  }

  @Post('matches/:id/contest')
  @HttpCode(204)
  async contest(
    @CurrentUser() user: JwtClaims,
    @Param('id') id: string,
    @Body() body: unknown,
  ): Promise<void> {
    await this.reports.contest(user.sub, id, ContestMatchSchema.parse(body));
  }

  @Post('matches/:id/mvp-vote')
  @HttpCode(204)
  async voteMvp(
    @CurrentUser() user: JwtClaims,
    @Param('id') id: string,
    @Body() body: unknown,
  ): Promise<void> {
    const input = MvpVoteSchema.parse(body);
    await this.reports.voteMvp(user.sub, id, input.player_id);
  }

  @Post('matches/:id/cancel')
  @HttpCode(204)
  async cancelMatch(
    @CurrentUser() user: JwtClaims,
    @Param('id') id: string,
    @Body() body: unknown,
  ): Promise<void> {
    const input = CancelMatchSchema.parse(body);
    await this.reports.cancel(user.sub, id, input.reason);
  }

  @Post('matches/:id/forfeit')
  @HttpCode(204)
  async forfeit(@CurrentUser() user: JwtClaims, @Param('id') id: string): Promise<void> {
    await this.reports.forfeit(user.sub, id);
  }

  // --- classements et statistiques --------------------------------------

  @Get('rankings/teams')
  rankingsTeams(@Query() query: Record<string, string>) {
    return this.rankings.rankingsTeams(TeamRankingQuerySchema.parse(query));
  }

  @Get('rankings/players')
  rankingsPlayers(@Query() query: Record<string, string>) {
    return this.rankings.rankingsPlayers(PlayerRankingQuerySchema.parse(query));
  }

  @Get('players/:id/stats')
  playerStats(@Param('id') id: string) {
    return this.rankings.playerStats(id);
  }

  @Get('players/:id/badges')
  async playerBadges(@Param('id') id: string) {
    const rows = await this.rankings.playerBadges(id);
    return rows;
  }

  @Get('me/match-history')
  matchHistory(@CurrentUser() user: JwtClaims, @Query() query: Record<string, string>) {
    return this.rankings.matchHistory(user.sub, MatchSearchSchema.parse(query));
  }
}
