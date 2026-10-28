import { randomUUID } from 'node:crypto';

import { Inject, Injectable } from '@nestjs/common';

import {
  PAYMENTS_EVENTS,
  type CreatePaymentInput,
  type LedgerBalance,
  type LedgerLine,
  type MobileMoneyOperator,
  type Payment,
  type PaymentStatus,
  type Payout,
  type PayoutFailureReason,
  type PayoutStatus,
  type ProviderStatus,
  type ReleasePaymentInput,
  maskMsisdn,
  normalizeMsisdn,
} from '@conexa/contracts';
import { AppError, forbidden, invalidState, notFound, validationError } from '@conexa/errors';
import { createEvent, type EventPublisher } from '@conexa/events';

import { sql, type Transaction } from 'kysely';

import { env } from './config.js';
import { db, type Database } from './db.js';
import { PAYMENT_EVENT_BUS } from './events.js';
import {
  assertBalanced,
  assertSplit,
  escrowPosting,
  payoutPosting,
  refundPosting,
  releasePosting,
  splitCommission,
} from './ledger.js';
import { decidePayout, parsePayoutAccount, payoutFailureReason } from './payouts.rules.js';
import { assertTransition } from './payments.rules.js';
import { expiresAt, nextCheckAt } from './payments.schedule.js';
import { createPaymentProvider, type PaymentProvider } from './providers.js';
import {
  normalizeWebhook,
  payloadFingerprint,
  webhookEventKey,
  type NormalizedWebhook,
} from './webhooks.rules.js';

export interface PaymentRow {
  id: string;
  object_type: Payment['object_type'];
  object_id: string;
  payer_id: string;
  amount_fcfa: number;
  commission_fcfa: number;
  net_fcfa: number;
  provider: Payment['provider'];
  status: PaymentStatus;
  payment_url: string | null;
  external_reference: string | null;
  idempotency_key: string | null;
  payer_msisdn: string | null;
  next_check_at: Date | null;
  expires_at: Date | null;
  failure_reason: string | null;
  created_at: Date;
  released_at: Date | null;
  refunded_at: Date | null;
}

interface PayoutRow {
  id: string;
  payment_id: string;
  beneficiary_id: string;
  kind: 'provider' | 'refund';
  operator: MobileMoneyOperator;
  msisdn: string;
  amount_fcfa: number;
  status: PayoutStatus;
  attempts: number;
  failure_reason: string | null;
  provider_reference: string | null;
  created_at: Date;
  sent_at: Date | null;
}

const COLUMNS = [
  'id',
  'object_type',
  'object_id',
  'payer_id',
  'amount_fcfa',
  'commission_fcfa',
  'net_fcfa',
  'provider',
  'status',
  'payment_url',
  'external_reference',
  'idempotency_key',
  'payer_msisdn',
  'next_check_at',
  'expires_at',
  'failure_reason',
  'created_at',
  'released_at',
  'refunded_at',
] as const;

const PAYOUT_COLUMNS = [
  'id',
  'payment_id',
  'beneficiary_id',
  'kind',
  'operator',
  'msisdn',
  'amount_fcfa',
  'status',
  'attempts',
  'failure_reason',
  'provider_reference',
  'created_at',
  'sent_at',
] as const;

@Injectable()
export class PaymentsService {
  // Champs et non paramètres de constructeur : Nest les lirait comme des
  // dépendances à injecter.
  private readonly provider: PaymentProvider = createPaymentProvider();
  private readonly now = () => new Date();

  constructor(@Inject(PAYMENT_EVENT_BUS) private readonly events: EventPublisher) {}

  async create(payerId: string, input: CreatePaymentInput): Promise<Payment> {
    if (input.idempotency_key) {
      const existing = await db
        .selectFrom('payments')
        .select(COLUMNS)
        .where('payer_id', '=', payerId)
        .where('idempotency_key', '=', input.idempotency_key)
        .executeTakeFirst();
      if (existing) {
        return this.toApi(existing);
      }
    }

    const { commission_fcfa, net_fcfa } = splitCommission(
      input.amount_fcfa,
      env.DEFAULT_COMMISSION_PCT,
    );

    const id = randomUUID();
    const created = this.now();
    await db
      .insertInto('payments')
      .values({
        id,
        object_type: input.object_type,
        object_id: input.object_id,
        payer_id: payerId,
        amount_fcfa: input.amount_fcfa,
        commission_fcfa,
        net_fcfa,
        provider: input.provider,
        status: 'pending',
        description: input.description ?? null,
        idempotency_key: input.idempotency_key ?? null,
        payer_msisdn: normalizeMsisdn(input.phone_msisdn),
        next_check_at: nextCheckAt(created, created),
        expires_at: expiresAt(created, env.PAYMENT_PENDING_TTL_MINUTES * 60_000),
      })
      .execute();

    try {
      const collected = await this.provider.collect({
        paymentId: id,
        amountFcfa: input.amount_fcfa,
        phoneMsisdn: normalizeMsisdn(input.phone_msisdn),
        operator: operatorOf(input.provider),
        description: input.description ?? `${input.object_type}:${input.object_id}`,
        idempotencyKey: input.idempotency_key ?? id,
      });

      const updated = await db
        .updateTable('payments')
        .set({
          external_reference: collected.reference,
          payment_url: collected.paymentUrl,
          updated_at: this.now(),
        })
        .where('id', '=', id)
        .returning(COLUMNS)
        .executeTakeFirstOrThrow();

      return this.toApi(updated);
    } catch (error) {
      // Aucun argent n'a bougé : le paiement est abandonné proprement, et un
      // nouvel essai exige une nouvelle clé d'idempotence.
      await db
        .updateTable('payments')
        .set({ status: 'failed', failure_reason: 'provider_unavailable', updated_at: this.now() })
        .where('id', '=', id)
        .where('status', '=', 'pending')
        .execute();
      throw error;
    }
  }

  /**
   * Notification de l'agrégateur. Trois garde-fous, dans cet ordre :
   * 1. signature vérifiée sur le corps brut ;
   * 2. dédoublonnage (`webhook_events (provider, external_id)` unique) ;
   * 3. **relecture du statut par l'API** : un webhook seul ne fait jamais foi.
   */
  async confirmWebhook(
    body: unknown,
    rawBody: string,
    signature: string | undefined,
  ): Promise<{ status: PaymentStatus }> {
    this.provider.verifyWebhook({ rawBody, body, signature });
    const payload = normalizeWebhook(body);

    const payment = await this.loadByReference(payload);
    if (payment.amount_fcfa !== (payload.amount_fcfa ?? payment.amount_fcfa)) {
      throw invalidState('Montant du webhook différent du paiement');
    }

    const eventKey = webhookEventKey(this.provider.name, payload);
    const inserted = await db
      .insertInto('webhook_events')
      .values({
        provider: this.provider.name,
        external_id: eventKey,
        payload_hash: payloadFingerprint(rawBody),
        signature_valid: true,
      })
      .onConflict((conflict) => conflict.doNothing())
      .returning('id')
      .executeTakeFirst();

    if (!inserted) {
      // Rejeu : le premier passage a déjà décidé, on renvoie l'état courant.
      return { status: payment.status };
    }

    if (payload.status === 'pending') {
      // Campay signale une transaction encore en cours : rien à appliquer, la
      // relève tranchera. On en garde la trace pour le diagnostic.
      await this.markWebhook(inserted.id, 'ignored_pending');
      return { status: payment.status };
    }

    let providerStatus: ProviderStatus;
    try {
      providerStatus =
        payment.external_reference === null
          ? 'unknown'
          : await this.provider.getStatus(payment.external_reference);
    } catch (error) {
      await this.markWebhook(inserted.id, 'status_unavailable');
      throw error;
    }

    if (providerStatus === 'unknown' || providerStatus === 'pending') {
      // Le webhook annonce une issue que l'API ne confirme pas encore : on ne
      // touche à rien, la relève tranchera.
      await this.markWebhook(inserted.id, 'ignored_unconfirmed');
      return { status: payment.status };
    }

    const result = await this.applyProviderStatus(payment, providerStatus);
    await this.markWebhook(inserted.id, result.changed ? 'applied' : 'duplicate');
    return { status: result.status };
  }

  /**
   * Transition unique, partagée par le webhook et la relève : c'est le seul
   * endroit qui écrit une écriture d'encaissement.
   */
  async applyProviderStatus(
    payment: PaymentRow,
    status: ProviderStatus,
  ): Promise<{ status: PaymentStatus; changed: boolean }> {
    if (payment.status !== 'pending') {
      return { status: payment.status, changed: false };
    }

    if (status === 'successful') {
      const settled = await db.transaction().execute(async (trx) => {
        const updated = await trx
          .updateTable('payments')
          .set({
            status: 'escrow',
            commission_fcfa: payment.commission_fcfa,
            net_fcfa: payment.net_fcfa,
            updated_at: this.now(),
          })
          .where('id', '=', payment.id)
          .where('status', '=', 'pending')
          .returning(COLUMNS)
          .executeTakeFirst();
        if (!updated) {
          return null;
        }
        await this.post(
          trx,
          payment.id,
          'payment',
          'Encaissement sous séquestre',
          escrowPosting(payment.amount_fcfa, operatorOrUndefined(payment.provider)),
        );
        return updated;
      });

      if (!settled) {
        const current = await this.load(payment.id);
        return { status: current.status, changed: false };
      }
      await this.publish(PAYMENTS_EVENTS.escrowed, {
        payment_id: payment.id,
        object_type: payment.object_type,
        object_id: payment.object_id,
        payer_id: payment.payer_id,
        amount_fcfa: payment.amount_fcfa,
      });
      return { status: 'escrow', changed: true };
    }

    if (status === 'failed') {
      const failed = await db
        .updateTable('payments')
        .set({ status: 'failed', failure_reason: 'provider_failure', updated_at: this.now() })
        .where('id', '=', payment.id)
        .where('status', '=', 'pending')
        .returning('status')
        .executeTakeFirst();
      if (!failed) {
        return { status: (await this.load(payment.id)).status, changed: false };
      }
      await this.publish(PAYMENTS_EVENTS.failed, {
        payment_id: payment.id,
        object_type: payment.object_type,
        object_id: payment.object_id,
        reason: 'provider_failure',
      });
      return { status: 'failed', changed: true };
    }

    return { status: 'pending', changed: false };
  }

  /** Abandon propre : la fenêtre d'attente est dépassée, rien n'a bougé. */
  async abandon(payment: PaymentRow): Promise<boolean> {
    const expired = await db
      .updateTable('payments')
      .set({ status: 'failed', failure_reason: 'expired', updated_at: this.now() })
      .where('id', '=', payment.id)
      .where('status', '=', 'pending')
      .returning('status')
      .executeTakeFirst();
    if (!expired) {
      return false;
    }
    await this.publish(PAYMENTS_EVENTS.failed, {
      payment_id: payment.id,
      object_type: payment.object_type,
      object_id: payment.object_id,
      reason: 'expired',
    });
    return true;
  }

  /** Report d'une relève (statut encore `pending` ou API indisponible). */
  async reschedule(payment: PaymentRow, now: Date): Promise<void> {
    await db
      .updateTable('payments')
      .set({
        checks: sql<number>`checks + 1`,
        next_check_at: nextCheckAt(payment.created_at, now),
        updated_at: now,
      })
      .where('id', '=', payment.id)
      .execute();
  }

  /** Lecture pour la relève : les paiements à interroger maintenant. */
  async pendingToCheck(now: Date, limit = 50): Promise<PaymentRow[]> {
    return db
      .selectFrom('payments')
      .select(COLUMNS)
      .where('status', '=', 'pending')
      .where((eb) => eb.or([eb('next_check_at', 'is', null), eb('next_check_at', '<=', now)]))
      .orderBy('next_check_at')
      .limit(limit)
      .execute();
  }

  /**
   * Libération du séquestre. L'ordre compte : on décaissement, puis on écrit.
   * Un reversement impossible laisse le paiement sous séquestre et part dans la
   * file « à traiter » — jamais un `released` sans argent parti.
   */
  async release(paymentId: string, input: ReleasePaymentInput): Promise<Payment> {
    const payment = await this.load(paymentId);
    assertTransition(payment.status, 'released');
    assertSplit(payment.amount_fcfa, input.commission_fcfa, input.net_fcfa);

    const account = input.beneficiary_ref
      ? await this.payoutAccountRow(input.beneficiary_ref)
      : undefined;
    const balanceFcfa = account ? await this.provider.getBalance(account.operator) : 0;
    const decision = decidePayout({ account, amountFcfa: input.net_fcfa, balanceFcfa });

    const payout = await this.queuePayout({
      payment,
      kind: 'provider',
      beneficiaryId: input.beneficiary_ref ?? 'missing',
      operator: account?.operator ?? operatorOf(payment.provider),
      msisdn: account?.msisdn ?? '',
      amountFcfa: input.net_fcfa,
      failureReason: decision.action === 'queue' ? decision.reason : null,
    });

    if (decision.action === 'queue') {
      await this.publish(PAYMENTS_EVENTS.payoutFailed, {
        payout_id: payout.id,
        payment_id: payment.id,
        reason: decision.reason,
      });
      throw invalidState('Reversement en file d’attente : le paiement reste sous séquestre');
    }

    const sent = await this.disburse(payment, payout, {
      commission_fcfa: input.commission_fcfa,
      net_fcfa: input.net_fcfa,
    });
    if (sent.status !== 'sent') {
      throw new AppError(
        'INVALID_STATE',
        'Reversement refusé par l’agrégateur : paiement sous séquestre',
        {
          payout_id: sent.id,
          reason: sent.failure_reason,
        },
      );
    }
    return this.toApi(await this.load(payment.id));
  }

  /**
   * Remboursement = décaissement vers le payeur (pas de remboursement natif
   * confirmé, ADR 0008). Un échec ne perd rien : il part dans la même file.
   */
  async refund(paymentId: string): Promise<Payment> {
    const payment = await this.load(paymentId);
    assertTransition(payment.status, 'refund_pending');
    if (!payment.payer_msisdn) {
      throw validationError('Numéro du payeur absent : remboursement impossible');
    }

    await db
      .updateTable('payments')
      .set({ status: 'refund_pending', updated_at: this.now() })
      .where('id', '=', payment.id)
      .where('status', '=', 'escrow')
      .execute();

    const operator = operatorOf(payment.provider);
    const balanceFcfa = await this.provider.getBalance(operator);
    const decision = decidePayout({
      account: { operator },
      amountFcfa: payment.amount_fcfa,
      balanceFcfa,
    });

    const payout = await this.queuePayout({
      payment,
      kind: 'refund',
      beneficiaryId: `payer:${payment.payer_id}`,
      operator,
      msisdn: payment.payer_msisdn,
      amountFcfa: payment.amount_fcfa,
      failureReason: decision.action === 'queue' ? decision.reason : null,
    });

    if (decision.action === 'queue') {
      await this.publish(PAYMENTS_EVENTS.payoutFailed, {
        payout_id: payout.id,
        payment_id: payment.id,
        reason: decision.reason,
      });
      throw invalidState('Remboursement en file d’attente : opération non aboutie');
    }

    const sent = await this.disburse(payment, payout);
    if (sent.status !== 'sent') {
      throw new AppError('INVALID_STATE', 'Remboursement refusé par l’agrégateur', {
        payout_id: sent.id,
        reason: sent.failure_reason,
      });
    }
    return this.toApi(await this.load(payment.id));
  }

  /** Compte de reversement du bénéficiaire : numéro dédié, jamais le WhatsApp. */
  async upsertPayoutAccount(ownerId: string, input: unknown) {
    const parsed = parsePayoutAccount(input);
    const row = await db
      .insertInto('payout_accounts')
      .values({
        owner_id: ownerId,
        operator: parsed.operator,
        msisdn: normalizeMsisdn(parsed.msisdn),
        updated_at: this.now(),
      })
      .onConflict((conflict) =>
        conflict.column('owner_id').doUpdateSet({
          operator: parsed.operator,
          msisdn: normalizeMsisdn(parsed.msisdn),
          updated_at: this.now(),
        }),
      )
      .returning(['id', 'owner_id', 'operator', 'msisdn', 'created_at'])
      .executeTakeFirstOrThrow();

    return {
      id: row.id,
      owner_id: row.owner_id,
      operator: row.operator,
      msisdn_masked: maskMsisdn(row.msisdn),
      created_at: row.created_at.toISOString(),
    };
  }

  async payoutAccountFor(ownerId: string) {
    const row = await this.payoutAccountRow(ownerId);
    if (!row) {
      return null;
    }
    return {
      id: row.id,
      owner_id: row.owner_id,
      operator: row.operator,
      msisdn_masked: maskMsisdn(row.msisdn),
      created_at: row.created_at.toISOString(),
    };
  }

  /** File « à traiter » du back-office : le travail restant, pas une perte. */
  async listPayouts(status: PayoutStatus = 'queued'): Promise<Payout[]> {
    const rows = await db
      .selectFrom('payouts')
      .select(PAYOUT_COLUMNS)
      .where('status', '=', status)
      .orderBy('created_at', 'asc')
      .limit(100)
      .execute();
    return rows.map((row) => this.toPayout(row));
  }

  async retryPayout(payoutId: string): Promise<Payout | null> {
    let payout = await db
      .selectFrom('payouts')
      .select(PAYOUT_COLUMNS)
      .where('id', '=', payoutId)
      .executeTakeFirst();
    if (!payout || payout.status !== 'queued') {
      return null;
    }

    // Un compte de reversement enregistré entre-temps débloque la file.
    if (payout.kind === 'provider' && payout.msisdn === '') {
      const account = await this.payoutAccountRow(payout.beneficiary_id);
      if (account) {
        payout = await db
          .updateTable('payouts')
          .set({
            msisdn: account.msisdn,
            operator: account.operator,
            failure_reason: null,
            updated_at: this.now(),
          })
          .where('id', '=', payout.id)
          .returning(PAYOUT_COLUMNS)
          .executeTakeFirstOrThrow();
      }
    }

    const payment = await this.load(payout.payment_id);
    return this.toPayout(await this.disburse(payment, payout));
  }

  /** Lecture interne : Billing vérifie un paiement avant d'activer un abonnement. */
  async getInternal(paymentId: string): Promise<Payment> {
    return this.toApi(await this.load(paymentId));
  }

  async getForPayer(paymentId: string, payerId: string): Promise<Payment> {
    const payment = await this.load(paymentId);
    if (payment.payer_id !== payerId) {
      throw forbidden('Paiement d’un autre compte');
    }
    return this.toApi(payment);
  }

  async listMine(payerId: string): Promise<Payment[]> {
    const rows = await db
      .selectFrom('payments')
      .select(COLUMNS)
      .where('payer_id', '=', payerId)
      .orderBy('created_at', 'desc')
      .limit(50)
      .execute();
    return rows.map((row) => this.toApi(row));
  }

  /** Rapprochement : débits = crédits, et séquestre cohérent avec les paiements. */
  async ledgerBalance(): Promise<LedgerBalance> {
    const rows = await db
      .selectFrom('ledger_lines')
      .select(['account', 'direction', 'amount_fcfa'])
      .execute();

    const accounts = new Map<string, { debit: number; credit: number }>();
    let debit = 0;
    let credit = 0;
    for (const row of rows) {
      const entry = accounts.get(row.account) ?? { debit: 0, credit: 0 };
      if (row.direction === 'debit') {
        entry.debit += row.amount_fcfa;
        debit += row.amount_fcfa;
      } else {
        entry.credit += row.amount_fcfa;
        credit += row.amount_fcfa;
      }
      accounts.set(row.account, entry);
    }

    return {
      imbalance_fcfa: debit - credit,
      accounts: [...accounts.entries()].map(([account, value]) => ({
        account,
        debit_fcfa: value.debit,
        credit_fcfa: value.credit,
      })),
    };
  }

  /** Relecture du statut par l'API : la relève ne croit aucun webhook seul. */
  async readProviderStatus(reference: string): Promise<ProviderStatus> {
    return this.provider.getStatus(reference);
  }

  /** File à traiter, avec un délai entre deux tentatives (pas de boucle chaude). */
  async queuedPayoutsDue(now: Date, limit = 5): Promise<Payout[]> {
    const rows = await db
      .selectFrom('payouts')
      .select(PAYOUT_COLUMNS)
      .where('status', '=', 'queued')
      .where('attempts', '<', 5)
      .where('updated_at', '<=', new Date(now.getTime() - 5 * 60_000))
      .orderBy('updated_at', 'asc')
      .limit(limit)
      .execute();
    return rows.map((row) => this.toPayout(row));
  }

  private async disburse(
    payment: PaymentRow,
    payout: PayoutRow,
    split?: { commission_fcfa: number; net_fcfa: number },
  ): Promise<PayoutRow> {
    const claimed = await db
      .updateTable('payouts')
      .set({ status: 'processing', attempts: sql<number>`attempts + 1`, updated_at: this.now() })
      .where('id', '=', payout.id)
      .where('status', '=', 'queued')
      .returning(PAYOUT_COLUMNS)
      .executeTakeFirst();

    if (!claimed) {
      // Un autre passage (ou la file) a déjà pris ce reversement.
      return (
        (await db
          .selectFrom('payouts')
          .select(PAYOUT_COLUMNS)
          .where('id', '=', payout.id)
          .executeTakeFirst()) ?? payout
      );
    }

    if (!claimed.msisdn) {
      return this.requeue(claimed, 'beneficiary_account_missing');
    }

    let reference: string;
    try {
      const result = await this.provider.disburse({
        payoutId: claimed.id,
        amountFcfa: claimed.amount_fcfa,
        msisdn: claimed.msisdn,
        operator: claimed.operator,
        description: `payout:${claimed.kind}:${payment.object_type}`,
      });
      reference = result.reference;
    } catch (error) {
      return this.requeue(claimed, payoutFailureReason(error));
    }

    const sent = await this.settlePayout(payment, claimed, reference, split);
    return sent;
  }

  /** L'argent est parti : l'écriture et l'état du paiement bougent ensemble. */
  private async settlePayout(
    payment: PaymentRow,
    payout: PayoutRow,
    reference: string,
    split?: { commission_fcfa: number; net_fcfa: number },
  ): Promise<PayoutRow> {
    const now = this.now();
    const settled = await db.transaction().execute(async (trx) => {
      const updatedPayout = await trx
        .updateTable('payouts')
        .set({
          status: 'sent',
          provider_reference: reference,
          failure_reason: null,
          sent_at: now,
          updated_at: now,
        })
        .where('id', '=', payout.id)
        .where('status', '=', 'processing')
        .returning(PAYOUT_COLUMNS)
        .executeTakeFirst();
      if (!updatedPayout) {
        return null;
      }

      if (payout.kind === 'refund') {
        await this.post(
          trx,
          payment.id,
          'refund',
          'Remboursement du séquestre',
          refundPosting(payment.amount_fcfa, payout.operator),
        );
        await trx
          .updateTable('payments')
          .set({ status: 'refunded', refunded_at: now, updated_at: now })
          .where('id', '=', payment.id)
          .where('status', '=', 'refund_pending')
          .execute();
        return updatedPayout;
      }

      const netFcfa = split?.net_fcfa ?? payout.amount_fcfa;
      const commissionFcfa = split?.commission_fcfa ?? payment.commission_fcfa;
      assertSplit(payment.amount_fcfa, commissionFcfa, netFcfa);
      await this.post(
        trx,
        payment.id,
        'release',
        'Libération du séquestre',
        releasePosting(payment.amount_fcfa, netFcfa),
      );
      await this.post(
        trx,
        payment.id,
        'payout',
        'Décaissement au bénéficiaire',
        payoutPosting(netFcfa, payout.operator),
      );
      await trx
        .updateTable('payments')
        .set({
          status: 'released',
          commission_fcfa: commissionFcfa,
          net_fcfa: netFcfa,
          released_at: now,
          updated_at: now,
        })
        .where('id', '=', payment.id)
        .where('status', '=', 'escrow')
        .execute();
      return updatedPayout;
    });

    if (!settled) {
      return (
        (await db
          .selectFrom('payouts')
          .select(PAYOUT_COLUMNS)
          .where('id', '=', payout.id)
          .executeTakeFirst()) ?? payout
      );
    }

    await this.publish(PAYMENTS_EVENTS.payoutSent, {
      payout_id: settled.id,
      payment_id: payment.id,
      operator: settled.operator,
      amount_fcfa: settled.amount_fcfa,
    });
    if (settled.kind === 'refund') {
      await this.publish(PAYMENTS_EVENTS.refunded, {
        payment_id: payment.id,
        amount_fcfa: payment.amount_fcfa,
      });
    } else {
      await this.publish(PAYMENTS_EVENTS.released, {
        payment_id: payment.id,
        object_id: payment.object_id,
        net_fcfa: settled.amount_fcfa,
        commission_fcfa: payment.amount_fcfa - settled.amount_fcfa,
      });
    }
    return settled;
  }

  private async requeue(payout: PayoutRow, reason: PayoutFailureReason): Promise<PayoutRow> {
    const row = await db
      .updateTable('payouts')
      .set({ status: 'queued', failure_reason: reason, updated_at: this.now() })
      .where('id', '=', payout.id)
      .where('status', '=', 'processing')
      .returning(PAYOUT_COLUMNS)
      .executeTakeFirst();

    await this.publish(PAYMENTS_EVENTS.payoutFailed, {
      payout_id: payout.id,
      payment_id: payout.payment_id,
      reason,
    });
    return row ?? payout;
  }

  /** Un seul reversement vivant par paiement (index unique partiel en base). */
  private async queuePayout(input: {
    payment: PaymentRow;
    kind: 'provider' | 'refund';
    beneficiaryId: string;
    operator: MobileMoneyOperator;
    msisdn: string;
    amountFcfa: number;
    failureReason: PayoutFailureReason | null;
  }): Promise<PayoutRow> {
    await db
      .insertInto('payouts')
      .values({
        payment_id: input.payment.id,
        beneficiary_id: input.beneficiaryId,
        kind: input.kind,
        operator: input.operator,
        msisdn: input.msisdn,
        amount_fcfa: input.amountFcfa,
        status: 'queued',
        failure_reason: input.failureReason,
        updated_at: this.now(),
      })
      .onConflict((conflict) => conflict.doNothing())
      .execute();

    const row = await db
      .selectFrom('payouts')
      .select(PAYOUT_COLUMNS)
      .where('payment_id', '=', input.payment.id)
      .where('status', 'in', ['queued', 'processing', 'sent'])
      .orderBy('created_at', 'desc')
      .executeTakeFirst();
    if (!row) {
      throw new AppError('INTERNAL_ERROR', 'Reversement introuvable après création');
    }
    return row;
  }

  private async loadByReference(payload: NormalizedWebhook): Promise<PaymentRow> {
    const payment = await db
      .selectFrom('payments')
      .select(COLUMNS)
      .where((eb) =>
        eb.or([
          eb('external_reference', '=', payload.reference),
          ...(payload.external_reference ? [eb('id', '=', payload.external_reference)] : []),
        ]),
      )
      .executeTakeFirst();
    if (!payment) {
      throw notFound('Paiement');
    }
    return payment;
  }

  private async load(paymentId: string): Promise<PaymentRow> {
    const payment = await db
      .selectFrom('payments')
      .select(COLUMNS)
      .where('id', '=', paymentId)
      .executeTakeFirst();
    if (!payment) {
      throw notFound('Paiement');
    }
    return payment;
  }

  private async payoutAccountRow(ownerId: string) {
    return db
      .selectFrom('payout_accounts')
      .select(['id', 'owner_id', 'operator', 'msisdn', 'created_at'])
      .where('owner_id', '=', ownerId)
      .executeTakeFirst();
  }

  private async markWebhook(id: string, outcome: string): Promise<void> {
    await db
      .updateTable('webhook_events')
      .set({ outcome, processed_at: this.now() })
      .where('id', '=', id)
      .execute();
  }

  /** Écrit une écriture équilibrée dans la transaction du changement d'état. */
  private async post(
    trx: Transaction<Database>,
    referenceId: string,
    referenceType: string,
    memo: string,
    lines: LedgerLine[],
  ): Promise<void> {
    assertBalanced(lines);

    const entry = await trx
      .insertInto('journal_entries')
      .values({
        reference_type: referenceType,
        reference_id: referenceId,
        memo: `${referenceType}:${memo}`,
      })
      .returning('id')
      .executeTakeFirstOrThrow();

    await trx
      .insertInto('ledger_lines')
      .values(
        lines.map((line) => ({
          entry_id: entry.id,
          account: line.account,
          direction: line.direction,
          amount_fcfa: line.amount_fcfa,
          operator: line.operator ?? null,
        })),
      )
      .execute();
  }

  private toApi(row: PaymentRow): Payment {
    return {
      id: row.id,
      object_type: row.object_type,
      object_id: row.object_id,
      payer_id: row.payer_id,
      amount_fcfa: row.amount_fcfa,
      commission_fcfa: row.commission_fcfa,
      net_fcfa: row.net_fcfa,
      provider: row.provider,
      status: row.status,
      payment_url: row.payment_url,
      created_at: row.created_at.toISOString(),
      released_at: row.released_at?.toISOString() ?? null,
      refunded_at: row.refunded_at?.toISOString() ?? null,
    };
  }

  private toPayout(row: PayoutRow): Payout {
    return {
      id: row.id,
      payment_id: row.payment_id,
      beneficiary_id: row.beneficiary_id,
      operator: row.operator,
      amount_fcfa: row.amount_fcfa,
      status: row.status,
      attempts: row.attempts,
      failure_reason: (row.failure_reason as PayoutFailureReason | null) ?? null,
      provider_reference: row.provider_reference,
      created_at: row.created_at.toISOString(),
      sent_at: row.sent_at?.toISOString() ?? null,
    };
  }

  private async publish(type: string, payload: Record<string, unknown>): Promise<void> {
    // Le port de publication est strictement par lot : un événement = un lot d'un.
    await this.events.publish([createEvent({ type, producer: 'payments', payload })]);
  }
}

/** Opérateur d'un paiement ; `mock` ne sert qu'au développement. */
function operatorOf(provider: Payment['provider']): MobileMoneyOperator {
  return provider === 'orange_money' ? 'orange_money' : 'mtn_momo';
}

function operatorOrUndefined(provider: Payment['provider']): MobileMoneyOperator | undefined {
  return provider === 'mtn_momo' || provider === 'orange_money' ? provider : undefined;
}
