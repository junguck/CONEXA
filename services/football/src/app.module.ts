import { Module } from '@nestjs/common';
import { InMemoryEventBus } from '@conexa/events';
import { AuthModule, HealthModule, createJwtVerifier } from '@conexa/service-kit';

import { FootballAdminController, FootballJobsController } from './admin.controller.js';
import { CompetitionsService } from './competitions.service.js';
import { env } from './config.js';
import { pingDatabase } from './db.js';
import { DisputesService } from './disputes.service.js';
import { FootballController } from './football.controller.js';
import { FootballJobsService } from './jobs.service.js';
import { MatchReportService } from './match-report.service.js';
import { MatchResultService } from './match-result.service.js';
import { MatchesService } from './matches.service.js';
import { OutboxService } from './outbox.service.js';
import { RankingsService } from './rankings.service.js';
import { FootballScheduler } from './scheduler.js';
import { FOOTBALL_CLOCK, FOOTBALL_EVENTS } from './shared.js';
import { TeamsService } from './teams.service.js';

@Module({
  imports: [
    AuthModule.forRoot(
      createJwtVerifier({ publicKey: env.JWT_PUBLIC_KEY, issuer: env.JWT_ISSUER }),
    ),
    HealthModule.forRoot(pingDatabase),
  ],
  controllers: [FootballController, FootballAdminController, FootballJobsController],
  providers: [
    { provide: FOOTBALL_CLOCK, useValue: () => new Date() },
    { provide: FOOTBALL_EVENTS, useValue: new InMemoryEventBus() },
    TeamsService,
    MatchesService,
    MatchResultService,
    OutboxService,
    MatchReportService,
    RankingsService,
    DisputesService,
    CompetitionsService,
    FootballJobsService,
    FootballScheduler,
  ],
})
export class AppModule {}
