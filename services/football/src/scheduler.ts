import {
  Injectable,
  Logger,
  type OnApplicationBootstrap,
  type OnModuleDestroy,
} from '@nestjs/common';
import type { FootballJob } from '@conexa/contracts';

import { env } from './config.js';
import { FootballJobsService } from './jobs.service.js';

const JOBS: FootballJob[] = [
  'finalize_stale_reports',
  'close_contest_windows',
  'close_mvp_votes',
  'relay_outbox',
];

/**
 * Planificateur interne : même tâche que les routes `/internal/jobs/:name`,
 * pour rester testable sans attendre l'horloge réelle (FOOTBALL_CLOCK).
 */
@Injectable()
export class FootballScheduler implements OnApplicationBootstrap, OnModuleDestroy {
  private readonly logger = new Logger(FootballScheduler.name);
  private timer: ReturnType<typeof setTimeout> | undefined;
  private running = false;

  constructor(private readonly jobs: FootballJobsService) {}

  onApplicationBootstrap(): void {
    if (!env.FOOTBALL_CRON_ENABLED) {
      this.logger.log('planificateur football désactivé (FOOTBALL_CRON_ENABLED=false)');
      return;
    }
    this.timer = setTimeout(() => void this.tick(), env.FOOTBALL_CRON_INITIAL_DELAY_MS);
  }

  onModuleDestroy(): void {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = undefined;
    }
  }

  private async tick(): Promise<void> {
    if (this.running) {
      return;
    }
    this.running = true;
    try {
      for (const job of JOBS) {
        await this.jobs.run(job);
      }
    } catch (error) {
      this.logger.error(
        `exécution planifiée interrompue : ${error instanceof Error ? error.message : 'inconnue'}`,
      );
    } finally {
      this.running = false;
      this.timer = setTimeout(() => void this.tick(), env.FOOTBALL_CRON_INTERVAL_MS);
    }
  }
}
