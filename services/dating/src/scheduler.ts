import {
  Injectable,
  Logger,
  type OnApplicationBootstrap,
  type OnModuleDestroy,
} from '@nestjs/common';

import { env } from './config.js';
import { DatingOutboxService } from './outbox.service.js';
import { ReservationSagaService } from './reservation.service.js';

/**
 * Planificateur interne du domaine dating : même tâche que la route
 * `/internal/outbox/relay`, pour rester testable sans attendre l'horloge
 * réelle (DATING_CLOCK) ni exiger un cron externe.
 */
@Injectable()
export class DatingScheduler implements OnApplicationBootstrap, OnModuleDestroy {
  private readonly logger = new Logger(DatingScheduler.name);
  private timer: ReturnType<typeof setTimeout> | undefined;
  private running = false;

  constructor(
    private readonly outbox: DatingOutboxService,
    private readonly saga: ReservationSagaService,
  ) {}

  onApplicationBootstrap(): void {
    if (!env.DATING_CRON_ENABLED) {
      this.logger.log('planificateur dating désactivé (DATING_CRON_ENABLED=false)');
      return;
    }
    this.timer = setTimeout(() => void this.tick(), env.DATING_CRON_INITIAL_DELAY_MS);
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
      const outcome = await this.outbox.relay();
      if (outcome.examined > 0) {
        this.logger.log(
          `relais outbox dating : examined=${outcome.examined} published=${outcome.changed} failed=${outcome.failed}`,
        );
      }
      // Reprise des actions de réservation dues : un crash entre deux appels
      // Partners/Payments ne perd jamais une retenue ni un remboursement.
      const sagas = await this.saga.runDue();
      if (sagas.claimed > 0) {
        this.logger.log(
          `actions de saga dating : claimed=${sagas.claimed} done=${sagas.done} failed=${sagas.failed}`,
        );
      }
    } catch (error) {
      this.logger.error(
        `relais planifié interrompu : ${error instanceof Error ? error.message : 'inconnue'}`,
      );
    } finally {
      this.running = false;
      this.timer = setTimeout(() => void this.tick(), env.DATING_CRON_INTERVAL_MS);
    }
  }
}
