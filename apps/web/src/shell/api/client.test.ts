import { describe, expect, it, vi } from 'vitest';

import { ApiError, createApiClient } from './client';

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('createApiClient', () => {
  it('ajoute le jeton, l’Idempotency-Key et le curseur', async () => {
    const fetchImpl = vi.fn(async () => jsonResponse(200, { data: [], next_cursor: null }));
    const client = createApiClient({
      baseUrl: 'https://api.test/api/v1',
      getToken: () => 'jeton',
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });

    await client.page('posts', { query: { limit: 20, cursor: 'abc', empty: undefined } });

    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('https://api.test/api/v1/posts?limit=20&cursor=abc');
    expect((init.headers as Record<string, string>)['Authorization']).toBe('Bearer jeton');
    expect(init.credentials).toBe('same-origin');
  });

  it('envoie l’Idempotency-Key sur les montants', async () => {
    const fetchImpl = vi.fn(async () => jsonResponse(201, { id: 'p1' }));
    const client = createApiClient({
      baseUrl: 'https://api.test/',
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });

    await client.post('dates/d1/pay', { amount_fcfa: 8000 }, { idempotencyKey: 'key-1' });

    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('https://api.test/dates/d1/pay');
    expect((init.headers as Record<string, string>)['Idempotency-Key']).toBe('key-1');
  });

  it('normalise une erreur métier avec son code, son statut et son request_id', async () => {
    const fetchImpl = vi.fn(async () =>
      jsonResponse(409, {
        error: {
          code: 'CANCEL_WINDOW_CLOSED',
          message: 'Annulation impossible.',
          details: { scheduled_at: '2026-11-03T15:30:00Z' },
          request_id: 'req_1',
        },
      }),
    );
    const client = createApiClient({
      baseUrl: 'https://api.test',
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });

    const error = await client.post('dates/d1/cancel', {}).catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(ApiError);
    const apiError = error as ApiError;
    expect(apiError.code).toBe('CANCEL_WINDOW_CLOSED');
    expect(apiError.status).toBe(409);
    expect(apiError.requestId).toBe('req_1');
    expect(apiError.details).toEqual({ scheduled_at: '2026-11-03T15:30:00Z' });
    expect(apiError.message).toMatch(/3 h/);
  });

  it('gère un 204 sans corps', async () => {
    const fetchImpl = vi.fn(async () => new Response(null, { status: 204 }));
    const client = createApiClient({
      baseUrl: 'https://api.test',
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });

    await expect(client.request('me/devices/d1', { method: 'DELETE' })).resolves.toBeUndefined();
  });

  it('traduit une panne réseau en NETWORK_ERROR', async () => {
    const fetchImpl = vi.fn(async () => {
      throw new TypeError('failed to fetch');
    });
    const client = createApiClient({
      baseUrl: 'https://api.test',
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });

    await expect(client.get('me')).rejects.toMatchObject({ code: 'NETWORK_ERROR' });
  });

  it('signale une réponse non JSON sur un succès', async () => {
    const fetchImpl = vi.fn(
      async () =>
        new Response('pas du json', { status: 200, headers: { 'Content-Type': 'text/plain' } }),
    );
    const client = createApiClient({
      baseUrl: 'https://api.test',
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });

    await expect(client.get('me')).rejects.toMatchObject({ code: 'INVALID_RESPONSE' });
  });
});
