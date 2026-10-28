import { createHmac } from 'node:crypto';

import type { MobileMoneyOperator, ProviderStatus } from '@conexa/contracts';
import { AppError, forbidden } from '@conexa/errors';

import { CampayProvider } from './campay.provider.js';
import { env } from './config.js';

/**
 * Agrégateur mobile money derrière une interface : le service ne connaît ni
 * Campay ni ses particularités. `MockPaymentProvider` couvre le développement et
 * les tests (aucun réseau) ; `CampayProvider` parle l'API documentée et refuse
 * de démarrer sans ses quatre secrets.
 */

export interface CollectRequest {
  paymentId: string;
  amountFcfa: number;
  /** Numéro du payeur, normalisé `2376XXXXXXXX`. */
  phoneMsisdn: string;
  operator: MobileMoneyOperator;
  description: string;
  /** Notre clé d'idempotence : elle part en `external_reference`. */
  idempotencyKey: string;
}

export interface CollectResult {
  reference: string;
  paymentUrl: string | null;
}

export interface DisburseRequest {
  payoutId: string;
  amountFcfa: number;
  /** Numéro du bénéficiaire, normalisé `2376XXXXXXXX`, jamais journalisé. */
  msisdn: string;
  operator: MobileMoneyOperator;
  description: string;
}

export interface DisburseResult {
  reference: string;
}

export interface WebhookVerificationInput {
  /** Corps brut : nécessaire quand le fournisseur signe les octets reçus. */
  rawBody: string;
  /** Corps analysé : Campay y place un JWT de signature. */
  body: unknown;
  /** En-tête de signature, quand le fournisseur en utilise un. */
  signature: string | undefined;
}

export interface PaymentProvider {
  readonly name: 'mock' | 'campay';
  collect(request: CollectRequest): Promise<CollectResult>;
  /** Relecture du statut : un webhook seul ne fait jamais foi. */
  getStatus(reference: string): Promise<ProviderStatus>;
  /** Solde **par opérateur** : la vérification précède tout décaissement. */
  getBalance(operator: MobileMoneyOperator): Promise<number>;
  disburse(request: DisburseRequest): Promise<DisburseResult>;
  verifyWebhook(input: WebhookVerificationInput): void;
}

export interface MockProviderOptions {
  /** Statut rendu pour toute référence (par défaut : encaissement réussi). */
  status?: ProviderStatus;
  balanceFcfa?: number;
}

interface MockCall {
  operation: 'collect' | 'getStatus' | 'getBalance' | 'disburse';
  request: Record<string, unknown>;
}

export class MockPaymentProvider implements PaymentProvider {
  readonly name = 'mock' as const;
  readonly calls: MockCall[] = [];

  constructor(private readonly options: MockProviderOptions = {}) {}

  async collect(request: CollectRequest): Promise<CollectResult> {
    this.calls.push({
      operation: 'collect',
      request: { paymentId: request.paymentId, amountFcfa: request.amountFcfa },
    });
    // Référence déterministe : un webhook de test peut viser le paiement sans
    // deviner de suffixe. Aucun argent ne bouge.
    return {
      reference: request.paymentId,
      paymentUrl: `http://localhost:3000/payments/mock/pay/${request.paymentId}`,
    };
  }

  async getStatus(reference: string): Promise<ProviderStatus> {
    this.calls.push({ operation: 'getStatus', request: { reference } });
    return this.options.status ?? 'successful';
  }

  async getBalance(operator: MobileMoneyOperator): Promise<number> {
    this.calls.push({ operation: 'getBalance', request: { operator } });
    return this.options.balanceFcfa ?? 10_000_000;
  }

  async disburse(request: DisburseRequest): Promise<DisburseResult> {
    // Le numéro n'est jamais conservé dans l'appel enregistré.
    this.calls.push({
      operation: 'disburse',
      request: {
        payoutId: request.payoutId,
        amountFcfa: request.amountFcfa,
        operator: request.operator,
      },
    });
    return { reference: `mock-disburse-${request.payoutId}` };
  }

  /** Signature locale : HMAC du corps brut, jamais utilisée en production. */
  signWebhook(payload: string): string {
    return createHmac('sha256', env.PAYMENTS_WEBHOOK_SECRET).update(payload).digest('hex');
  }

  verifyWebhook(input: WebhookVerificationInput): void {
    if (input.signature === undefined || input.signature !== this.signWebhook(input.rawBody)) {
      throw forbidden('Signature de webhook invalide');
    }
  }
}

export { CampayProvider } from './campay.provider.js';

/** Choisit l'adaptateur une seule fois au démarrage. */
export function createPaymentProvider(): PaymentProvider {
  if (env.PAYMENT_PROVIDER === 'campay') {
    const baseUrl = env.CAMPAY_BASE_URL;
    const webhookKey = env.CAMPAY_WEBHOOK_KEY;
    const permanentToken = env.CAMPAY_PERMANENT_TOKEN ?? env.CAMPAY_JETON_DE_SERVICE;
    if (!baseUrl || !webhookKey) {
      throw new AppError(
        'INTERNAL_ERROR',
        'PAYMENT_PROVIDER=campay exige CAMPAY_BASE_URL et CAMPAY_WEBHOOK_KEY',
      );
    }
    if (!permanentToken && !(env.CAMPAY_APP_TOKEN && env.CAMPAY_APP_SECRET)) {
      throw new AppError(
        'INTERNAL_ERROR',
        'PAYMENT_PROVIDER=campay exige CAMPAY_PERMANENT_TOKEN ou (CAMPAY_APP_TOKEN + CAMPAY_APP_SECRET)',
      );
    }
    return new CampayProvider({
      baseUrl,
      webhookKey,
      ...(permanentToken ? { permanentToken } : {}),
      ...(env.CAMPAY_APP_TOKEN ? { appToken: env.CAMPAY_APP_TOKEN } : {}),
      ...(env.CAMPAY_APP_SECRET ? { appSecret: env.CAMPAY_APP_SECRET } : {}),
    });
  }
  return new MockPaymentProvider();
}
