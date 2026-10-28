import { Inject, Injectable, Logger, type OnModuleInit } from '@nestjs/common';

import {
  MOBILE_MONEY_OPERATORS,
  PAYMENTS_EVENTS,
  type MobileMoneyOperator,
  type Reconciliation,
} from '@conexa/contracts';
import { createEvent, type EventPublisher } from '@conexa/events';

import { env } from './config.js';
import { db } from './db.js';
import { PAYMENT_EVENT_BUS } from './events.js';
import { createPaymentProvider, type PaymentProvider } from './providers.js';
import {
  cashBalanceByOperator,
  needsAlert,
  reconciliationStatus,
  variance,
} from './reconciliation.rules.js';

/**
 * Rapprochement quotidien : le compte `CASH` du grand livre contre le solde de
 * l'agrégateur, **par opérateur**. Un écart n'est jamais corrigé ici : il est
 * enregistré, journalisé comme métrique et publié comme alerte.
 */
@Injectable()
export class ReconciliationService implements OnModuleInit {
  private readonly provider: PaymentProvider = createPaymentProvider();
  private readonly logger = new Logger(ReconciliationService.name);
  private lastRunDay: string | null = null;

  constructor(@Inject(PAYMENT_EVENT_BUS) private readonly events: EventPublisher) {}

  onModuleInit(): void {
    if (!env.PAYMENTS_JOBS_ENABLED) {
      return;
    }
    // Un premier passage peu après le démarrage, puis un contrôle horaire qui
    // ne fait rien si le jour est déjà rapproché.
    const timer = setInterval(() => void this.runIfNeeded(), 60 * 60_000);
    timer.unref();
    void this.runIfNeeded();
  }

  private async runIfNeeded(): Promise<void> {
    const day = new Date().toISOString().slice(0, 10);
    if (this.lastRunDay === day) {
      return;
    }
    try {
      await this.run(day);
      this.lastRunDay = day;
    } catch (error) {
      // Une panne du fournisseur ne doit jamais produire un faux « ok ».
      this.logger.warn(
        `rapprochement non effectué : ${error instanceof Error ? error.message : 'erreur inconnue'}`,
      );
    }
  }

  /** Idempotent : une seule ligne par jour et par opérateur. */
  async run(day: string): Promise<Reconciliation[]> {
    const results: Reconciliation[] = [];
    const cashLines = await db
      .selectFrom('ledger_lines')
      .select(['operator', 'direction', 'amount_fcfa'])
      .where('account', '=', 'CASH')
      .execute();
    const balances = cashBalanceByOperator(cashLines);

    for (const operator of MOBILE_MONEY_OPERATORS) {
      const ledgerCashFcfa = balances.get(operator) ?? 0;
      const providerBalanceFcfa = await this.operatorBalance(operator);
      results.push(await this.record(day, operator, ledgerCashFcfa, providerBalanceFcfa));
    }
    return results;
  }

  async latest(limit = 10): Promise<Reconciliation[]> {
    const rows = await db
      .selectFrom('reconciliations')
      .selectAll()
      .orderBy('day', 'desc')
      .orderBy('operator')
      .limit(limit)
      .execute();
    return rows.map((row) => ({
      id: row.id,
      day: row.day,
      operator: row.operator,
      ledger_cash_fcfa: row.ledger_cash_fcfa,
      provider_balance_fcfa: row.provider_balance_fcfa,
      variance_fcfa: row.variance_fcfa,
      status: row.status,
      created_at: row.created_at.toISOString(),
    }));
  }

  private async operatorBalance(operator: MobileMoneyOperator): Promise<number> {
    return this.provider.getBalance(operator);
  }

  private async record(
    day: string,
    operator: MobileMoneyOperator,
    ledgerCashFcfa: number,
    providerBalanceFcfa: number,
  ): Promise<Reconciliation> {
    const varianceFcfa = variance(providerBalanceFcfa, ledgerCashFcfa);
    const status = reconciliationStatus(varianceFcfa);

    const row = await db
      .insertInto('reconciliations')
      .values({
        day,
        operator,
        ledger_cash_fcfa: ledgerCashFcfa,
        provider_balance_fcfa: providerBalanceFcfa,
        variance_fcfa: varianceFcfa,
        status,
      })
      .onConflict((conflict) =>
        conflict.columns(['day', 'operator']).doUpdateSet({
          ledger_cash_fcfa: ledgerCashFcfa,
          provider_balance_fcfa: providerBalanceFcfa,
          variance_fcfa: varianceFcfa,
          status,
        }),
      )
      .returning('id')
      .executeTakeFirstOrThrow();

    this.logger.log({
      metric: 'payments.reconciliation.variance_fcfa',
      operator,
      variance_fcfa: varianceFcfa,
      status,
    });
    if (needsAlert(varianceFcfa)) {
      this.logger.error({
        metric: 'payments.reconciliation.mismatched',
        operator,
        variance_fcfa: varianceFcfa,
      });
      await this.events.publish([
        createEvent({
          type: PAYMENTS_EVENTS.reconciliationMismatched,
          producer: 'payments',
          payload: {
            day,
            operator,
            ledger_cash_fcfa: ledgerCashFcfa,
            provider_balance_fcfa: providerBalanceFcfa,
            variance_fcfa: varianceFcfa,
          },
        }),
      ]);
    }

    return {
      id: row.id,
      day,
      operator,
      ledger_cash_fcfa: ledgerCashFcfa,
      provider_balance_fcfa: providerBalanceFcfa,
      variance_fcfa: varianceFcfa,
      status,
      created_at: new Date().toISOString(),
    };
  }
}
