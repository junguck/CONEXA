import { Body, Controller, Get, HttpCode, Param, Post, Query, UseGuards } from '@nestjs/common';
import {
  AttachCompetitionMatchSchema,
  CreateCompetitionSchema,
  FootballJobSchema,
  GenerateBracketSchema,
  GenerateGroupsSchema,
  RegisterCompetitionTeamSchema,
  ResolveDisputeSchema,
  type JwtClaims,
} from '@conexa/contracts';
import { CurrentUser, JwtAuthGuard, Roles } from '@conexa/service-kit';

import { CompetitionsService } from './competitions.service.js';
import { DisputesService } from './disputes.service.js';
import { FootballJobsService } from './jobs.service.js';

/** Back-office football : litiges (F2.8) et compétitions (F2.9). */
@UseGuards(JwtAuthGuard)
@Roles('admin')
@Controller('admin')
export class FootballAdminController {
  constructor(
    private readonly disputes: DisputesService,
    private readonly competitions: CompetitionsService,
  ) {}

  @Get('matches/disputed')
  disputed() {
    return this.disputes.list();
  }

  @Get('matches/:id/dispute')
  dispute(@Param('id') id: string) {
    return this.disputes.detail(id);
  }

  /** Tranche un litige : `validated` (score imposé) ou `void` (match annulé). */
  @Post('matches/:id/resolve')
  resolve(@CurrentUser() user: JwtClaims, @Param('id') id: string, @Body() body: unknown) {
    return this.disputes.resolve(user.sub, id, ResolveDisputeSchema.parse(body));
  }

  @Post('competitions')
  createCompetition(@CurrentUser() user: JwtClaims, @Body() body: unknown) {
    return this.competitions.create(user.sub, CreateCompetitionSchema.parse(body));
  }

  @Post('competitions/:id/teams')
  registerTeam(@Param('id') id: string, @Body() body: unknown) {
    return this.competitions.registerTeam(id, RegisterCompetitionTeamSchema.parse(body).team_id);
  }

  @Post('competitions/:id/groups')
  generateGroups(@Param('id') id: string, @Body() body: unknown) {
    return this.competitions.generateGroups(id, GenerateGroupsSchema.parse(body));
  }

  @Post('competitions/:id/bracket')
  generateBracket(@Param('id') id: string, @Body() body: unknown) {
    return this.competitions.generateBracket(id, GenerateBracketSchema.parse(body));
  }

  @Post('competitions/:id/slots/:slotId/match')
  attachMatch(@Param('id') id: string, @Param('slotId') slotId: string, @Body() body: unknown) {
    return this.competitions.attachMatch(
      id,
      slotId,
      AttachCompetitionMatchSchema.parse(body).match_id,
    );
  }

  @Post('competitions/:id/advance')
  advance(@Param('id') id: string, @Body() body: unknown) {
    return this.competitions.advance(id, AttachCompetitionMatchSchema.parse(body).match_id);
  }
}

/** Travaux de clôture déclenchés par l'exploitation (rôle service). */
@UseGuards(JwtAuthGuard)
@Roles('service')
@Controller('internal/jobs')
export class FootballJobsController {
  constructor(private readonly jobs: FootballJobsService) {}

  @Post(':name')
  @HttpCode(200)
  run(@Param('name') name: string, @Query() _query: Record<string, string>) {
    return this.jobs.run(FootballJobSchema.parse(name));
  }
}
