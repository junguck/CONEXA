import { Injectable, Logger, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common';

import type { ProviderStatus } from '@conexa/contracts';

import { env } from './config.js';
import { decidePoll, expiresAt } from './payments.schedule.js';
import { PaymentsService } from './payments.service.js';

/**
 * Relève de secours (`docs/STACK.md` §3.3.4). La boucle ne contient aucune
 * règle métier : elle lit, interroge le fournisseur, puis délègue la décision à
 * `decidePoll` et la transition à PaymentsService — les mêmes que le webhook.
 *
 * Un paiement `pending` est interrogé toutes les 30 s pendant 15 min, puis
 * toutes les 5 min, et abandonné proprement à l'expiration de sa fenêtre.
 */
@Injectable()
export class PaymentPoller implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PaymentPoller.name);
  private timer: NodeJS.Timeout | undefined;
  private running = false;

  constructor(private readonly payments: PaymentsService) {}

  onModuleInit(): void {
    if (!env.PAYMENTS_JOBS_ENABLED) {
      return;
    }
    this.timer = setInterval(() => void this.tick(), env.PAYMENTS_TICK_MS);
    this.timer.unref();
  }

  onModuleDestroy(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = undefined;
    }
  }

  /** Un seul passage à la fois : deux boucles ne se marchent pas dessus. */
  async tick(): Promise<void> {
    if (this.running) {
      return;
    }
    this.running = true;
    try {
      await this.pollPending();
      await this.retryPayouts();
    } finally {
      this.running = false;
    }
  }

  private async pollPending(): Promise<void> {
    const now = new Date();
    const pending = await this.payments.pendingToCheck(now);

    for (const payment of pending) {
      if (!payment.external_reference) {
        // Rien à interroger : on repousse plutôt que de tourner à vide.
        await this.payments.reschedule(payment, now);
        continue;
      }

      let status: ProviderStatus;
      try {
        status = await this.payments.readProviderStatus(payment.external_reference);
      } catch (error) {
        this.logger.warn(
          `relève impossible (${payment.id}) : ${
            error instanceof Error ? error.message : 'erreur inconnue'
          }`,
        );
        await this.payments.reschedule(payment, now);
        continue;
      }

      const deadline =
        payment.expires_at ??
        expiresAt(payment.created_at, env.PAYMENT_PENDING_TTL_MINUTES * 60_000);
      const decision = decidePoll({ status, now, expiresAt: deadline });

      switch (decision.action) {
        case 'settle':
        case 'fail':
          await this.payments.applyProviderStatus(payment, status);
          break;
        case 'abandon':
          await this.payments.abandon(payment);
          break;
        default:
          await this.payments.reschedule(payment, now);
          break;
      }
    }
  }

  private async retryPayouts(): Promise<void> {
    const now = new Date();
    const queued = await this.payments.queuedPayoutsDue(now);
    for (const payout of queued) {
      try {
        await this.payments.retryPayout(payout.id);
      } catch (error) {
        // Le motif est enregistré sur le reversement ; on garde la trace sans
        // numéro ni montant dans le journal.
        this.logger.warn(
          `reversement non abouti (${payout.id}) : ${
            error instanceof Error ? error.message : 'erreur inconnue'
          }`,
        );
      }
    }
  }
}
