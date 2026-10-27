import { Module } from '@nestjs/common';
import { InMemoryEventBus } from '@conexa/events';
import { AuthModule, HealthModule, createJwtVerifier } from '@conexa/service-kit';

import { env } from './config.js';
import { pingDatabase } from './db.js';
import { FootballController } from './football.controller.js';
import { MatchReportService } from './match-report.service.js';
import { MatchesService } from './matches.service.js';
import { RankingsService } from './rankings.service.js';
import { FOOTBALL_CLOCK, FOOTBALL_EVENTS } from './shared.js';
import { TeamsService } from './teams.service.js';

@Module({
  imports: [
    AuthModule.forRoot(
      createJwtVerifier({ publicKey: env.JWT_PUBLIC_KEY, issuer: env.JWT_ISSUER }),
    ),
    HealthModule.forRoot(pingDatabase),
  ],
  controllers: [FootballController],
  providers: [
    { provide: FOOTBALL_CLOCK, useValue: () => new Date() },
    { provide: FOOTBALL_EVENTS, useValue: new InMemoryEventBus() },
    TeamsService,
    MatchesService,
    MatchReportService,
    RankingsService,
  ],
})
export class AppModule {}
