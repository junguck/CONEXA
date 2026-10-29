import {
  Injectable,
  Logger,
  type OnApplicationBootstrap,
  type OnModuleDestroy,
} from '@nestjs/common';

import { BillingService } from './billing.service.js';
import { env } from './config.js';

/**
 * Planificateur interne : même tâche que la route `/internal/billing/jobs`,
 * pour rester testable sans attendre l'horloge réelle (BILLING_CLOCK).
 */
@Injectable()
export class BillingScheduler implements OnApplicationBootstrap, OnModuleDestroy {
  private readonly logger = new Logger(BillingScheduler.name);
  private timer: ReturnType<typeof setTimeout> | undefined;
  private running = false;

  constructor(private readonly billing: BillingService) {}

  onApplicationBootstrap(): void {
    if (!env.BILLING_CRON_ENABLED) {
      this.logger.log('planificateur billing désactivé (BILLING_CRON_ENABLED=false)');
      return;
    }
    this.timer = setTimeout(() => void this.tick(), env.BILLING_CRON_INITIAL_DELAY_MS);
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
      const outcome = await this.billing.runDailySweep();
      if (outcome.examined > 0) {
        this.logger.log(
          `balayage billing : examined=${outcome.examined} changed=${outcome.changed}`,
        );
      }
    } catch (error) {
      this.logger.error(
        `balayage planifié interrompu : ${error instanceof Error ? error.message : 'inconnue'}`,
      );
    } finally {
      this.running = false;
      this.timer = setTimeout(() => void this.tick(), env.BILLING_CRON_INTERVAL_MS);
    }
  }
}
