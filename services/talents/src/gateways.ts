import { randomUUID } from 'node:crypto';

export const PAYMENTS_GATEWAY = Symbol('TALENTS_PAYMENTS');
export const ENTITLEMENTS_GATEWAY = Symbol('TALENTS_ENTITLEMENTS');
export const TALENTS_CLOCK = Symbol('TALENTS_CLOCK');

export interface PaymentIntent {
  paymentId: string;
  status: 'escrow';
  amountFcfa: number;
}

export interface EscrowRequest {
  objectType: 'mission' | 'ticket' | 'boost';
  objectId: string;
  amountFcfa: number;
  provider: 'mtn_momo' | 'orange_money';
  phoneMsisdn: string;
  idempotencyKey?: string;
}

/** Aucun montant n'est encaissé par Talents : Payments exécute le séquestre. */
export interface PaymentsGateway {
  createEscrow(request: EscrowRequest): Promise<PaymentIntent>;
  release(paymentId: string, netFcfa: number): Promise<void>;
  refund(paymentId: string): Promise<void>;
}

/**
 * Droits lus dans Billing : jamais un taux en dur dans le service.
 * Le double de v1 renvoie 8 % (offre gratuite) et permet aux tests de changer le taux.
 */
export interface EntitlementsGateway {
  commissionPct(userId: string): Promise<number>;
}

export class FixedEntitlementsGateway implements EntitlementsGateway {
  constructor(private readonly pct = 8) {}

  async commissionPct(_userId: string): Promise<number> {
    return this.pct;
  }
}

/** Double de développement : renvoie un identifiant, ne déplace pas d'argent. */
export class FakePaymentsGateway implements PaymentsGateway {
  readonly releases: Array<{ paymentId: string; netFcfa: number }> = [];
  readonly refunds: string[] = [];

  async createEscrow(request: EscrowRequest): Promise<PaymentIntent> {
    return {
      paymentId: `pay_${randomUUID()}`,
      status: 'escrow',
      amountFcfa: request.amountFcfa,
    };
  }

  async release(paymentId: string, netFcfa: number): Promise<void> {
    this.releases.push({ paymentId, netFcfa });
  }

  async refund(paymentId: string): Promise<void> {
    this.refunds.push(paymentId);
  }
}
