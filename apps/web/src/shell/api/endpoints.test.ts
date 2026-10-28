import type { Plan } from '@conexa/contracts';
import { describe, expect, it, vi } from 'vitest';

import { createApiClient } from './client';
import { createEndpoints } from './endpoints';

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function setup(body: unknown = {}) {
  const fetchImpl = vi.fn(async () => jsonResponse(200, body));
  const client = createApiClient({
    baseUrl: 'http://localhost:3000',
    fetchImpl: fetchImpl as unknown as typeof fetch,
  });
  return { api: createEndpoints(client), fetchImpl };
}

function lastCall(fetchImpl: { mock: { calls: unknown[][] } }): [string, RequestInit] {
  return fetchImpl.mock.calls.at(-1) as unknown as [string, RequestInit];
}

describe('endpoints typés sur la Gateway', () => {
  it('appelle /me sur l’identité à la racine', async () => {
    const { api, fetchImpl } = setup({ id: 'u1' });

    await api.identity.me();

    const [url, init] = lastCall(fetchImpl);
    expect(url).toBe('http://localhost:3000/me');
    expect(init.method).toBe('GET');
  });

  it('préfixe les routes football comme le manifeste du Gateway', async () => {
    const { api, fetchImpl } = setup({ data: [], next_cursor: null });

    await api.football.teams({ limit: 20, q: 'lions', level: 'bronze' });

    const [url] = lastCall(fetchImpl);
    expect(url).toBe('http://localhost:3000/football/teams?limit=20&q=lions&level=bronze');
  });

  it('encode l’identifiant et exige une clé d’idempotence sur le paiement d’un date', async () => {
    const { api, fetchImpl } = setup({ id: 'p1' });

    await api.dating.pay('date 1', { provider: 'mtn_momo', phone_msisdn: '+2376...' }, 'key-1');

    const [url, init] = lastCall(fetchImpl);
    expect(url).toBe('http://localhost:3000/dates/date%201/pay');
    expect((init.headers as Record<string, string>)['Idempotency-Key']).toBe('key-1');
  });

  it('lit les plans et leurs prix depuis le serveur', async () => {
    const plan: Plan = {
      code: 'partner_premium',
      name: 'Premium',
      audience: 'partner',
      price_fcfa: 2500,
      period: 'monthly',
      entitlements: {
        plan_code: 'partner_premium',
        commission_pct: 5,
        max_active_listings: 20,
        picks_per_week: 3,
        boost_discount_pct: 0,
        event_commission_pct: 8,
      },
      is_default: false,
    };
    const { api, fetchImpl } = setup([plan]);

    const plans = await api.billing.plans();

    expect(plans[0]?.price_fcfa).toBe(2500);
    expect(lastCall(fetchImpl)[0]).toBe('http://localhost:3000/billing/plans');
  });

  it('suit les routes de messagerie et de notifications du service', async () => {
    const { api, fetchImpl } = setup({ updated: 2 });

    await api.messaging.markNotificationsRead();
    expect(lastCall(fetchImpl)[0]).toBe('http://localhost:3000/notifications/read');

    await api.messaging.messages('t1', '2026-11-01T10:00:00Z');
    expect(lastCall(fetchImpl)[0]).toBe(
      'http://localhost:3000/messaging/threads/t1/messages?before=2026-11-01T10%3A00%3A00Z',
    );
  });
});
