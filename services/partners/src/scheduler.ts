import {
  Injectable,
  Logger,
  type OnApplicationBootstrap,
  type OnModuleDestroy,
} from '@nestjs/common';

import { env } from './config.js';
import { SlotHoldsService } from './holds.service.js';
import { PartnersOutboxService } from './outbox.service.js';

/** Balaie les retenues échues puis relaie l'outbox, à intervalle fixe. */
@Injectable()
export class PartnersScheduler implements OnApplicationBootstrap, OnModuleDestroy {
  private readonly logger = new Logger(PartnersScheduler.name);
  private timer: ReturnType<typeof setTimeout> | undefined;
  private running = false;

  constructor(
    private readonly holds: SlotHoldsService,
    private readonly outbox: PartnersOutboxService,
  ) {}

  onApplicationBootstrap(): void {
    if (!env.PARTNERS_CRON_ENABLED) {
      this.logger.log('planificateur partners désactivé (PARTNERS_CRON_ENABLED=false)');
      return;
    }
    this.timer = setTimeout(() => void this.tick(), env.PARTNERS_CRON_INTERVAL_MS);
  }

  onModuleDestroy(): void {
    if (this.timer) clearTimeout(this.timer);
    this.timer = undefined;
  }

  private async tick(): Promise<void> {
    if (this.running) return;
    this.running = true;
    try {
      const swept = await this.holds.sweepExpired();
      const relayed = await this.outbox.relay();
      if (swept.changed > 0 || relayed.examined > 0) {
        this.logger.log(
          `partners : retenues échues=${swept.changed} outbox publiés=${relayed.changed} échecs=${relayed.failed}`,
        );
      }
    } catch (error) {
      this.logger.error(
        `tâche partners interrompue : ${error instanceof Error ? error.message : 'inconnue'}`,
      );
    } finally {
      this.running = false;
      this.timer = setTimeout(() => void this.tick(), env.PARTNERS_CRON_INTERVAL_MS);
    }
  }
}
