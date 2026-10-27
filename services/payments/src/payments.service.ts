import { randomUUID } from 'node:crypto';

import { Injectable } from '@nestjs/common';

import type {
  CreatePaymentInput,
  LedgerBalance,
  LedgerLine,
  Payment,
  PaymentStatus,
  PaymentWebhook,
  ReleasePaymentInput,
} from '@conexa/contracts';
import { AppError, forbidden, invalidState, notFound } from '@conexa/errors';

import type { Transaction } from 'kysely';

import { env } from './config.js';
import { db, type Database } from './db.js';
import {
  assertBalanced,
  assertSplit,
  escrowPosting,
  refundPosting,
  releasePosting,
} from './ledger.js';
import { assertTransition } from './payments.rules.js';
import { createPaymentProvider, type PaymentProvider } from './providers.js';

interface PaymentRow {
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
  created_at: Date;
  released_at: Date | null;
  refunded_at: Date | null;
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
  'created_at',
  'released_at',
  'refunded_at',
] as const;

@Injectable()
export class PaymentsService {
  // Champs et non paramètres de constructeur : Nest les lirait comme des
  // dépendances à injecter.
  private readonly provider: PaymentProvider = createPaymentProvider();
  private readonly now = () => new Date();

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

    const commission = Math.floor((input.amount_fcfa * env.DEFAULT_COMMISSION_PCT) / 100);
    assertSplit(input.amount_fcfa, commission, input.amount_fcfa - commission);

    const id = randomUUID();
    const created = await db
      .insertInto('payments')
      .values({
        id,
        object_type: input.object_type,
        object_id: input.object_id,
        payer_id: payerId,
        amount_fcfa: input.amount_fcfa,
        commission_fcfa: commission,
        net_fcfa: input.amount_fcfa - commission,
        provider: input.provider,
        status: 'pending',
        description: input.description ?? null,
        idempotency_key: input.idempotency_key ?? null,
      })
      .returning(COLUMNS)
      .executeTakeFirstOrThrow();

    const collected = await this.provider.collect({
      paymentId: id,
      amountFcfa: input.amount_fcfa,
      phoneMsisdn: input.phone_msisdn,
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

    void created;
    return this.toApi(updated);
  }

  /**
   * Confirmation par l'agrégateur : la signature couvre le corps brut. Le
   * traitement est idempotent, un webhook rejoué ne double pas le séquestre.
   */
  async confirmWebhook(
    payload: PaymentWebhook,
    rawBody: string,
  ): Promise<{ status: PaymentStatus }> {
    const payment = await db
      .selectFrom('payments')
      .select(COLUMNS)
      .where('external_reference', '=', payload.reference)
      .executeTakeFirst();

    if (!payment) {
      throw notFound('Paiement');
    }
    if (payment.amount_fcfa !== (payload.amount_fcfa ?? payment.amount_fcfa)) {
      throw invalidState('Montant du webhook différent du paiement');
    }
    if (payment.status !== 'pending') {
      return { status: payment.status };
    }
    void rawBody;

    if (payload.status === 'failed') {
      const failed = await db
        .updateTable('payments')
        .set({ status: 'failed', updated_at: this.now() })
        .where('id', '=', payment.id)
        .returning(COLUMNS)
        .executeTakeFirstOrThrow();
      return { status: failed.status };
    }

    const settled = await db.transaction().execute(async (trx) => {
      await this.post(
        trx,
        payment.id,
        'payment',
        'Encaissement sous séquestre',
        escrowPosting(payment.amount_fcfa),
      );
      return trx
        .updateTable('payments')
        .set({ status: 'escrow', updated_at: this.now() })
        .where('id', '=', payment.id)
        .returning(COLUMNS)
        .executeTakeFirstOrThrow();
    });

    return { status: settled.status };
  }

  async release(paymentId: string, input: ReleasePaymentInput): Promise<Payment> {
    const payment = await this.load(paymentId);
    assertTransition(payment.status, 'released');
    assertSplit(payment.amount_fcfa, input.commission_fcfa, input.net_fcfa);

    await this.provider.payout(
      payment.external_reference ?? payment.id,
      input.net_fcfa,
      input.beneficiary_ref,
    );

    const released = await db.transaction().execute(async (trx) => {
      await this.post(
        trx,
        payment.id,
        'release',
        'Libération du séquestre',
        releasePosting(payment.amount_fcfa, input.net_fcfa),
      );
      return trx
        .updateTable('payments')
        .set({
          status: 'released',
          commission_fcfa: input.commission_fcfa,
          net_fcfa: input.net_fcfa,
          released_at: this.now(),
          updated_at: this.now(),
        })
        .where('id', '=', payment.id)
        .returning(COLUMNS)
        .executeTakeFirstOrThrow();
    });

    return this.toApi(released);
  }

  async refund(paymentId: string): Promise<Payment> {
    const payment = await this.load(paymentId);
    assertTransition(payment.status, 'refund_pending');

    await this.provider.refund(payment.external_reference ?? payment.id, payment.amount_fcfa);
    const refunded = await db.transaction().execute(async (trx) => {
      await this.post(
        trx,
        payment.id,
        'refund',
        'Remboursement du séquestre',
        refundPosting(payment.amount_fcfa),
      );
      return trx
        .updateTable('payments')
        .set({ status: 'refunded', refunded_at: this.now(), updated_at: this.now() })
        .where('id', '=', payment.id)
        .returning(COLUMNS)
        .executeTakeFirstOrThrow();
    });

    return this.toApi(refunded);
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

  /** Vérifie le webhook avec le secret partagé de l'agrégateur. */
  verifySignature(rawBody: string, signature: string | undefined): void {
    if (!this.provider.verify(rawBody, signature)) {
      throw new AppError('FORBIDDEN', 'Signature de webhook invalide');
    }
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
}
