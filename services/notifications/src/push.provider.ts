import { randomUUID } from 'node:crypto';

import type { PushMessage } from '@conexa/contracts';
import { AppError } from '@conexa/errors';
import { createLogger } from '@conexa/service-kit';

import { env } from './config.js';
import { buildVapidToken, encryptPushPayload, type VapidKeys } from './web-push.js';

export interface SubscriptionTarget {
  endpoint: string;
  p256dh: string;
  auth: string;
}

export type PushErrorCode =
  | 'SUBSCRIPTION_GONE'
  | 'VAPID_REJECTED'
  | 'PAYLOAD_TOO_LARGE'
  | 'RATE_LIMITED'
  | 'PROVIDER_ERROR';

export interface PushOutcome {
  status: 'sent' | 'failed';
  errorCode: PushErrorCode | null;
}

/**
 * Envoi push derrière une interface. `console` ne sort pas du processus et
 * journalise un endpoint tronqué ; `web_push` parle aux services de push du
 * navigateur et exige les clés VAPID.
 */
export interface PushSender {
  readonly channel: 'console' | 'web_push';
  send(target: SubscriptionTarget, message: PushMessage): Promise<PushOutcome>;
}

const logger = createLogger('notifications-push');

export class ConsolePushSender implements PushSender {
  readonly channel = 'console' as const;

  async send(target: SubscriptionTarget, message: PushMessage): Promise<PushOutcome> {
    logger.info(
      { endpoint: maskEndpoint(target.endpoint), type: message.type },
      `push de développement : ${message.title}`,
    );
    return { status: 'sent', errorCode: null };
  }
}

/** Un endpoint contient un secret : jamais de journal en clair. */
export function maskEndpoint(endpoint: string): string {
  try {
    const url = new URL(endpoint);
    return `${url.origin}/…/${url.pathname.slice(-8)}`;
  } catch {
    return '(endpoint invalide)';
  }
}

export type FetchLike = (input: string, init: RequestInit) => Promise<Response>;

export class WebPushSender implements PushSender {
  readonly channel = 'web_push' as const;

  constructor(
    private readonly keys: VapidKeys,
    private readonly fetchImpl: FetchLike = fetch,
  ) {}

  async send(target: SubscriptionTarget, message: PushMessage): Promise<PushOutcome> {
    const payload = Buffer.from(JSON.stringify(message), 'utf8');
    const encrypted = encryptPushPayload(payload, { p256dh: target.p256dh, auth: target.auth });
    const token = buildVapidToken(target.endpoint, this.keys);

    const response = await this.fetchImpl(target.endpoint, {
      method: 'POST',
      headers: {
        authorization: token.authorization,
        'content-encoding': 'aes128gcm',
        'content-type': 'application/octet-stream',
        ttl: '900',
        urgency: 'normal',
      },
      body: new Uint8Array(encrypted.body),
    });

    if (response.ok) {
      return { status: 'sent', errorCode: null };
    }
    return { status: 'failed', errorCode: classifyStatus(response.status) };
  }
}

/** Choisit le canal une seule fois au démarrage, clés VAPID obligatoires. */
export function createPushSender(): PushSender {
  if (env.PUSH_PROVIDER === 'console') {
    return new ConsolePushSender();
  }
  if (!env.VAPID_PUBLIC_KEY || !env.VAPID_PRIVATE_KEY) {
    throw new AppError(
      'INTERNAL_ERROR',
      'PUSH_PROVIDER=web_push exige VAPID_PUBLIC_KEY et VAPID_PRIVATE_KEY',
    );
  }
  return new WebPushSender({
    publicKey: env.VAPID_PUBLIC_KEY,
    privateKey: env.VAPID_PRIVATE_KEY,
    subject: env.VAPID_SUBJECT,
  });
}

/** Identifiant de livraison : généré ici pour que le journal reste lisible. */
export function deliveryId(): string {
  return randomUUID();
}

export function classifyStatus(status: number): PushErrorCode {
  if (status === 404 || status === 410) return 'SUBSCRIPTION_GONE';
  if (status === 401 || status === 403) return 'VAPID_REJECTED';
  if (status === 413) return 'PAYLOAD_TOO_LARGE';
  if (status === 429) return 'RATE_LIMITED';
  return 'PROVIDER_ERROR';
}
