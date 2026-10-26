import { createHmac } from 'node:crypto';

import { AppError } from '@conexa/errors';

import { env } from './config.js';

/**
 * Agrégateur mobile money derrière une interface : le service ne connaît ni
 * Campay ni ses particularités. `MockProvider` couvre le développement et les
 * tests ; `CampayProvider` n'accepte de tourner que si les clés existent, et
 * échoue explicitement sinon — jamais de faux succès en production.
 */
export interface CollectRequest {
  paymentId: string;
  amountFcfa: number;
  phoneMsisdn: string;
  description: string;
  idempotencyKey: string;
}

export interface CollectResult {
  reference: string;
  paymentUrl: string | null;
}

export interface PaymentProvider {
  readonly name: 'mock' | 'campay';
  collect(request: CollectRequest): Promise<CollectResult>;
  /** Libération vers le bénéficiaire (payout mobile money). */
  payout(reference: string, amountFcfa: number, beneficiaryRef: string | undefined): Promise<void>;
  refund(reference: string, amountFcfa: number): Promise<void>;
  /** Signature attendue sur le webhook. */
  sign(payload: string): string;
  verify(payload: string, signature: string | undefined): boolean;
}

export class MockPaymentProvider implements PaymentProvider {
  readonly name = 'mock' as const;

  async collect(request: CollectRequest): Promise<CollectResult> {
    // Référence déterministe : un webhook de test peut viser le paiement sans
    // deviner de suffixe. Aucun argent ne bouge.
    return {
      reference: request.paymentId,
      paymentUrl: `http://localhost:3000/payments/mock/pay/${request.paymentId}`,
    };
  }

  async payout(): Promise<void> {
    // Double : rien ne sort réellement.
  }

  async refund(): Promise<void> {
    // Double : rien ne sort réellement.
  }

  sign(payload: string): string {
    return createHmac('sha256', env.PAYMENTS_WEBHOOK_SECRET).update(payload).digest('hex');
  }

  verify(payload: string, signature: string | undefined): boolean {
    return signature !== undefined && signature === this.sign(payload);
  }
}

interface CampayConfig {
  baseUrl: string;
  appToken: string;
  appSecret: string;
}

/** Adaptateur Campay : même interface, appels HTTP réels, clés obligatoires. */
export class CampayPaymentProvider implements PaymentProvider {
  readonly name = 'campay' as const;

  constructor(private readonly config: CampayConfig) {}

  private async token(): Promise<string> {
    const response = await fetch(`${this.config.baseUrl}/token/`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        username: this.config.appToken,
        password: this.config.appSecret,
      }),
    });
    if (!response.ok) {
      throw new AppError('INTERNAL_ERROR', 'Campay : authentification refusée');
    }
    const body = (await response.json()) as { token?: string };
    if (!body.token) {
      throw new AppError('INTERNAL_ERROR', 'Campay : jeton absent de la réponse');
    }
    return body.token;
  }

  async collect(request: CollectRequest): Promise<CollectResult> {
    const token = await this.token();
    const response = await fetch(`${this.config.baseUrl}/collect/`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Token ${token}` },
      body: JSON.stringify({
        amount: String(request.amountFcfa),
        currency: 'XAF',
        from: request.phoneMsisdn,
        description: request.description,
        external_reference: request.idempotencyKey,
      }),
    });
    if (!response.ok) {
      throw new AppError('INTERNAL_ERROR', 'Campay : collecte refusée');
    }
    const body = (await response.json()) as { reference?: string; payment_url?: string };
    if (!body.reference) {
      throw new AppError('INTERNAL_ERROR', 'Campay : référence absente de la réponse');
    }
    return { reference: body.reference, paymentUrl: body.payment_url ?? null };
  }

  async payout(reference: string, amountFcfa: number, beneficiaryRef?: string): Promise<void> {
    if (!beneficiaryRef) {
      throw new AppError('VALIDATION_ERROR', 'Campay : bénéficiaire requis pour un reversement');
    }
    const token = await this.token();
    const response = await fetch(`${this.config.baseUrl}/withdraw/`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Token ${token}` },
      body: JSON.stringify({
        amount: String(amountFcfa),
        currency: 'XAF',
        to: beneficiaryRef,
        description: reference,
      }),
    });
    if (!response.ok) {
      throw new AppError('INTERNAL_ERROR', 'Campay : reversement refusé');
    }
  }

  async refund(reference: string, amountFcfa: number): Promise<void> {
    const token = await this.token();
    const response = await fetch(`${this.config.baseUrl}/refund/`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Token ${token}` },
      body: JSON.stringify({ reference, amount: String(amountFcfa) }),
    });
    if (!response.ok) {
      throw new AppError('INTERNAL_ERROR', 'Campay : remboursement refusé');
    }
  }

  sign(payload: string): string {
    return createHmac('sha256', env.PAYMENTS_WEBHOOK_SECRET).update(payload).digest('hex');
  }

  verify(payload: string, signature: string | undefined): boolean {
    return signature !== undefined && signature === this.sign(payload);
  }
}

/** Choisit l'adaptateur une seule fois au démarrage. */
export function createPaymentProvider(): PaymentProvider {
  if (env.PAYMENT_PROVIDER === 'campay') {
    const baseUrl = env.CAMPAY_BASE_URL;
    const appToken = env.CAMPAY_APP_TOKEN;
    const appSecret = env.CAMPAY_APP_SECRET;
    if (!baseUrl || !appToken || !appSecret) {
      throw new AppError(
        'INTERNAL_ERROR',
        'PAYMENT_PROVIDER=campay exige CAMPAY_BASE_URL, CAMPAY_APP_TOKEN et CAMPAY_APP_SECRET',
      );
    }
    return new CampayPaymentProvider({ baseUrl, appToken, appSecret });
  }
  return new MockPaymentProvider();
}
