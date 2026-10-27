import { createHmac } from 'node:crypto';

import type { MobileMoneyOperator, ProviderStatus } from '@conexa/contracts';
import { AppError } from '@conexa/errors';

import { env } from './config.js';

/**
 * Agrégateur mobile money derrière une interface : le service ne connaît ni
 * Campay ni ses particularités. `MockPaymentProvider` couvre le développement et
 * les tests (aucun réseau) ; `CampayPaymentProvider` n'accepte de tourner que si
 * les clés existent **et** que l'API est confirmée — sinon il échoue fermé,
 * jamais de faux succès et jamais une URL inventée (docs/vendor/campay.md).
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

export interface PaymentProvider {
  readonly name: 'mock' | 'campay';
  collect(request: CollectRequest): Promise<CollectResult>;
  /** Relecture du statut : un webhook seul ne fait jamais foi. */
  getStatus(reference: string): Promise<ProviderStatus>;
  /** Solde **par opérateur** : la vérification précède tout décaissement. */
  getBalance(operator: MobileMoneyOperator): Promise<number>;
  disburse(request: DisburseRequest): Promise<DisburseResult>;
  /** Signature attendue sur le webhook, pour les tests et le mode local. */
  signWebhook(payload: string): string;
  verifyWebhook(payload: string, signature: string | undefined): void;
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

  signWebhook(payload: string): string {
    return createHmac('sha256', env.PAYMENTS_WEBHOOK_SECRET).update(payload).digest('hex');
  }

  verifyWebhook(payload: string, signature: string | undefined): void {
    if (signature === undefined || signature !== this.signWebhook(payload)) {
      throw new AppError('FORBIDDEN', 'Signature de webhook invalide');
    }
  }
}

/**
 * Points de `docs/vendor/campay.md` §Ouvert qui bloquent l'adaptateur. Tant
 * qu'ils ne sont pas levés, aucune requête n'est construite : on n'invente ni
 * URL, ni en-tête, ni forme de réponse.
 */
export const CAMPAY_BLOCKERS = [
  'url_et_chemins_api',
  'webhook_et_signature',
  'forme_des_reponses',
] as const;

interface CampayConfig {
  baseUrl: string | undefined;
  appToken: string | undefined;
  appSecret: string | undefined;
}

export class CampayPaymentProvider implements PaymentProvider {
  readonly name = 'campay' as const;

  constructor(private readonly config: CampayConfig) {}

  /** Échoue fermé : un adaptateur bloqué ne doit jamais simuler un succès. */
  private blocked(operation: string, extra: string[] = []): never {
    const missing = [
      ...CAMPAY_BLOCKERS,
      ...(this.config.baseUrl ? [] : ['CAMPAY_BASE_URL']),
      ...(this.config.appToken ? [] : ['CAMPAY_APP_TOKEN']),
      ...(this.config.appSecret ? [] : ['CAMPAY_APP_SECRET']),
      ...extra,
    ];
    throw new AppError(
      'INTERNAL_ERROR',
      `Campay : ${operation} indisponible, API non confirmée (docs/vendor/campay.md)`,
      { missing },
    );
  }

  collect(): Promise<CollectResult> {
    return this.blocked('collecte');
  }

  getStatus(): Promise<ProviderStatus> {
    return this.blocked('lecture de statut');
  }

  getBalance(): Promise<number> {
    return this.blocked('lecture du solde');
  }

  disburse(): Promise<DisburseResult> {
    return this.blocked('décaissement', ['decaissement_active_dans_application']);
  }

  signWebhook(): string {
    return this.blocked('signature de webhook');
  }

  verifyWebhook(): void {
    this.blocked('vérification de signature');
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
    // Les clés existent mais l'API n'est pas confirmée : l'adaptateur démarre
    // et refuse chaque opération avec un motif nommé (T-0021).
    return new CampayPaymentProvider({ baseUrl, appToken, appSecret });
  }
  return new MockPaymentProvider();
}
