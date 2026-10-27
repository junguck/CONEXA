import { createHmac, timingSafeEqual } from 'node:crypto';

import type { MobileMoneyOperator, ProviderStatus } from '@conexa/contracts';
import { AppError, forbidden } from '@conexa/errors';

import type {
  CollectRequest,
  CollectResult,
  DisburseRequest,
  DisburseResult,
  PaymentProvider,
  WebhookVerificationInput,
} from './providers.js';

/**
 * Adaptateur Campay réel. Chaque chemin, champ et en-tête vient de la
 * documentation officielle (collection Postman) et du SDK Python publié par
 * Campay — voir `docs/vendor/campay.md`, qui cite les sources et leur date.
 *
 * Rien n'est deviné ici : si un champ n'est pas documenté, il n'est pas envoyé.
 */

export interface CampayConfig {
  /** Hôte : `https://demo.campay.net` (demo) ou `https://www.campay.net` (prod). */
  baseUrl: string;
  /** Identifiant d'application (« API username »), jamais journalisé. */
  appToken: string;
  /** Mot de passe d'application, jamais journalisé. */
  appSecret: string;
  /** Clé de webhook de l'application : vérifie le JWT HS256 du callback. */
  webhookKey: string;
}

type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

/** Durée de vie retenue pour un jeton : la documentation ne la fixe pas. */
const TOKEN_TTL_MS = 5 * 60_000;

const STATUS_BY_PROVIDER: Record<string, ProviderStatus> = {
  PENDING: 'pending',
  SUCCESSFUL: 'successful',
  FAILED: 'failed',
};

export class CampayProvider implements PaymentProvider {
  readonly name = 'campay' as const;
  private readonly host: string;
  private readonly fetchImpl: FetchLike;
  private cachedToken: { value: string; expiresAt: number } | null = null;
  private pendingToken: Promise<string> | null = null;

  constructor(
    private readonly config: CampayConfig,
    fetchImpl?: FetchLike,
  ) {
    // La console affiche parfois l'URL avec `/api` : on normalise une fois.
    this.host = config.baseUrl.replace(/\/+$/, '').replace(/\/api$/, '');
    this.fetchImpl = fetchImpl ?? ((input, init) => fetch(input, init));
  }

  private url(path: string): string {
    return `${this.host}/api/${path.replace(/^\/+/, '')}`;
  }

  /** Jeton d'application, mis en cache et dédupliqué en cas d'appels concurrents. */
  private async token(): Promise<string> {
    if (this.cachedToken && this.cachedToken.expiresAt > Date.now()) {
      return this.cachedToken.value;
    }
    if (this.pendingToken) {
      return this.pendingToken;
    }
    this.pendingToken = this.requestToken();
    try {
      return await this.pendingToken;
    } finally {
      this.pendingToken = null;
    }
  }

  private async requestToken(): Promise<string> {
    const response = await this.fetchImpl(this.url('token/'), {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        username: this.config.appToken,
        password: this.config.appSecret,
      }),
    });
    const body = await this.json(response);
    const token = typeof body?.['token'] === 'string' ? body['token'] : undefined;
    if (!response.ok || !token) {
      throw new AppError('INTERNAL_ERROR', 'Campay : authentification refusée', {
        provider_status: response.status,
      });
    }
    this.cachedToken = { value: token, expiresAt: Date.now() + TOKEN_TTL_MS };
    return token;
  }

  /** Collecte asynchrone : la référence sert ensuite à relire le statut. */
  async collect(request: CollectRequest): Promise<CollectResult> {
    const body = await this.post('collect/', {
      amount: String(request.amountFcfa),
      currency: 'XAF',
      from: request.phoneMsisdn,
      description: request.description,
      external_reference: request.idempotencyKey,
    });
    const reference = body?.['reference'];
    if (typeof reference !== 'string' || reference.length < 8) {
      throw new AppError('INTERNAL_ERROR', 'Campay : référence absente de la réponse de collecte');
    }
    // La collecte ne rend pas de lien de paiement : l'utilisateur valide sur son
    // téléphone avec le code USSD fourni par le fournisseur.
    return { reference, paymentUrl: null };
  }

  async getStatus(reference: string): Promise<ProviderStatus> {
    const response = await this.get(`transaction/${encodeURIComponent(reference)}/`);
    if (response.status === 404) {
      return 'unknown';
    }
    const body = await this.json(response);
    if (!response.ok || !body) {
      return 'unknown';
    }
    const raw = typeof body['status'] === 'string' ? body['status'].toUpperCase() : '';
    return STATUS_BY_PROVIDER[raw] ?? 'unknown';
  }

  /** Solde **par opérateur** : c'est ce que le rapprochement compare. */
  async getBalance(operator: MobileMoneyOperator): Promise<number> {
    const response = await this.get('balance/');
    const body = await this.json(response);
    const field = operator === 'mtn_momo' ? 'mtn_balance' : 'orange_balance';
    const value = body?.[field];
    if (!response.ok || !body || value === undefined) {
      throw new AppError('INTERNAL_ERROR', 'Campay : solde par opérateur illisible', {
        provider_status: response.status,
      });
    }
    const amount = Number(value);
    if (!Number.isFinite(amount) || amount < 0) {
      throw new AppError('INTERNAL_ERROR', 'Campay : solde non numérique');
    }
    // Le fournisseur rend « 0.00 » : le grand livre ne connaît que des entiers.
    return Math.round(amount);
  }

  async disburse(request: DisburseRequest): Promise<DisburseResult> {
    const response = await this.authorized('withdraw/', 'POST', {
      amount: String(request.amountFcfa),
      currency: 'XAF',
      to: request.msisdn,
      description: request.description,
      // Notre identifiant de reversement : clé d'idempotence chez Campay.
      external_reference: request.payoutId,
    });
    const body = await this.json(response);
    const reference = body?.['reference'];
    if (!response.ok || typeof reference !== 'string') {
      throw new AppError('INTERNAL_ERROR', 'Campay : décaissement refusé', {
        provider_status: response.status,
        ...(typeof body?.['code'] === 'string' ? { code: body['code'] } : {}),
      });
    }
    return { reference };
  }

  /**
   * Le callback est signé par un **JWT HS256** avec la clé de webhook de
   * l'application. On vérifie la signature avant de lire quoi que ce soit ; le
   * statut est ensuite relu par l'API de toute façon.
   */
  verifyWebhook(input: WebhookVerificationInput): void {
    const candidate = input.signature ?? readSignature(input.body);
    if (!candidate) {
      throw forbidden('Webhook Campay sans signature');
    }
    const parts = candidate.split('.');
    if (parts.length !== 3) {
      throw forbidden('Webhook Campay : signature mal formée');
    }
    const [encodedHeader, encodedPayload, encodedSignature] = parts as [string, string, string];
    const header = decodeJson(encodedHeader);
    if (header?.['alg'] !== 'HS256') {
      throw forbidden('Webhook Campay : algorithme de signature refusé');
    }

    const expected = createHmac('sha256', this.config.webhookKey)
      .update(`${encodedHeader}.${encodedPayload}`)
      .digest();
    const given = Buffer.from(encodedSignature, 'base64url');
    if (given.length !== expected.length || !timingSafeEqual(given, expected)) {
      throw forbidden('Webhook Campay : signature invalide');
    }

    const claims = decodeJson(encodedPayload);
    const exp = claims?.['exp'];
    if (typeof exp === 'number' && exp * 1000 < Date.now()) {
      throw forbidden('Webhook Campay : signature expirée');
    }
  }

  private async post(
    path: string,
    payload: Record<string, string>,
  ): Promise<Record<string, unknown> | null> {
    return this.json(await this.authorized(path, 'POST', payload));
  }

  private async get(path: string): Promise<Response> {
    return this.authorized(path, 'GET');
  }

  private async authorized(
    path: string,
    method: 'GET' | 'POST',
    payload?: Record<string, string>,
  ): Promise<Response> {
    const token = await this.token();
    return this.fetchImpl(this.url(path), {
      method,
      headers: {
        authorization: `Token ${token}`,
        'content-type': 'application/json',
      },
      ...(payload === undefined ? {} : { body: JSON.stringify(payload) }),
    });
  }

  private async json(response: Response): Promise<Record<string, unknown> | null> {
    try {
      const parsed: unknown = await response.json();
      return typeof parsed === 'object' && parsed !== null
        ? (parsed as Record<string, unknown>)
        : null;
    } catch {
      return null;
    }
  }
}

function readSignature(body: unknown): string | undefined {
  if (typeof body !== 'object' || body === null || !('signature' in body)) {
    return undefined;
  }
  const signature = (body as { signature?: unknown }).signature;
  return typeof signature === 'string' ? signature : undefined;
}

function decodeJson(segment: string): Record<string, unknown> | null {
  try {
    const parsed: unknown = JSON.parse(Buffer.from(segment, 'base64url').toString('utf8'));
    return typeof parsed === 'object' && parsed !== null
      ? (parsed as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}
