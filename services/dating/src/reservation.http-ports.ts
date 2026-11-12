import { AppError } from '@conexa/errors';

import type { HoldOutcome, PartnersPort, PaymentsPort } from './reservation.ports.js';

type Fetch = typeof fetch;

async function call<T>(
  fetchImpl: Fetch,
  baseUrl: string,
  token: string,
  method: 'GET' | 'POST',
  path: string,
  body?: unknown,
): Promise<T> {
  const response = await fetchImpl(`${baseUrl.replace(/\/$/, '')}${path}`, {
    method,
    headers: {
      'x-service-token': token,
      ...(body === undefined ? {} : { 'content-type': 'application/json' }),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  if (!response.ok) {
    // Pas de corps dans le message : il pourrait contenir une donnée personnelle.
    throw new AppError('INTERNAL_ERROR', `appel interne ${path} refusé (${response.status})`);
  }
  return (await response.json()) as T;
}

/** Partners : `/internal/partners/*` (T-0055), jeton de service. */
export class HttpPartnersPort implements PartnersPort {
  constructor(
    private readonly baseUrl: string,
    private readonly token: string,
    private readonly fetchImpl: Fetch = fetch,
  ) {}

  async hold(slotId: string, holdRef: string): Promise<HoldOutcome> {
    const result = await call<
      | { status: 'held'; expires_at: string; starts_at: string }
      | { status: 'rejected'; reason: string }
    >(
      this.fetchImpl,
      this.baseUrl,
      this.token,
      'POST',
      `/internal/partners/slots/${encodeURIComponent(slotId)}/hold`,
      {
        hold_ref: holdRef,
      },
    );
    return result;
  }

  confirm(holdRef: string) {
    return call<{ status: string }>(
      this.fetchImpl,
      this.baseUrl,
      this.token,
      'POST',
      `/internal/partners/holds/${encodeURIComponent(holdRef)}/confirm`,
    );
  }

  release(holdRef: string) {
    return call<{ status: string }>(
      this.fetchImpl,
      this.baseUrl,
      this.token,
      'POST',
      `/internal/partners/holds/${encodeURIComponent(holdRef)}/release`,
    );
  }
}

/** Payments : `/internal/payments/:id/refund` (T-0021), jeton de service. */
export class HttpPaymentsPort implements PaymentsPort {
  constructor(
    private readonly baseUrl: string,
    private readonly token: string,
    private readonly fetchImpl: Fetch = fetch,
  ) {}

  async refund(paymentId: string): Promise<void> {
    await call(
      this.fetchImpl,
      this.baseUrl,
      this.token,
      'POST',
      `/internal/payments/${encodeURIComponent(paymentId)}/refund`,
      {},
    );
  }
}
