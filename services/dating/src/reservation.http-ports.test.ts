import { describe, expect, it } from 'vitest';

import { HttpPartnersPort, HttpPaymentsPort } from './reservation.http-ports.js';

function fakeFetch(status: number, body: unknown) {
  const calls: Array<{ url: string; init: RequestInit }> = [];
  const impl = (async (url: string, init: RequestInit) => {
    calls.push({ url, init });
    return new Response(JSON.stringify(body), { status });
  }) as unknown as typeof fetch;
  return { impl, calls };
}

describe('adaptateurs HTTP de la saga', () => {
  it('Partners : retient avec le jeton de service et l’identifiant opaque', async () => {
    const { impl, calls } = fakeFetch(200, {
      status: 'held',
      expires_at: '2026-11-09T10:15:00.000Z',
    });
    const port = new HttpPartnersPort('http://partners:3014/', 'secret-token-0123456789', impl);
    const outcome = await port.hold('slot-1', 'date-1:1');
    expect(outcome).toEqual({ status: 'held', expires_at: '2026-11-09T10:15:00.000Z' });
    expect(calls[0]!.url).toBe('http://partners:3014/internal/partners/slots/slot-1/hold');
    expect((calls[0]!.init.headers as Record<string, string>)['x-service-token']).toBe(
      'secret-token-0123456789',
    );
    expect(JSON.parse(calls[0]!.init.body as string)).toEqual({ hold_ref: 'date-1:1' });
  });

  it('Partners : confirme et libère par hold_ref encodé', async () => {
    const { impl, calls } = fakeFetch(200, { status: 'confirmed' });
    const port = new HttpPartnersPort('http://p', 'secret-token-0123456789', impl);
    await port.confirm('a:1');
    await port.release('a:1');
    expect(calls.map((call) => call.url)).toEqual([
      'http://p/internal/partners/holds/a%3A1/confirm',
      'http://p/internal/partners/holds/a%3A1/release',
    ]);
  });

  it('Payments : demande le remboursement du paiement', async () => {
    const { impl, calls } = fakeFetch(200, {});
    await new HttpPaymentsPort('http://pay', 'secret-token-0123456789', impl).refund('pay-1');
    expect(calls[0]!.url).toBe('http://pay/internal/payments/pay-1/refund');
    expect(calls[0]!.init.method).toBe('POST');
  });

  it('une réponse en erreur lève, sans recopier le corps (pas de donnée personnelle)', async () => {
    const { impl } = fakeFetch(500, { detail: 'numero 237670000000' });
    const port = new HttpPaymentsPort('http://pay', 'secret-token-0123456789', impl);
    await expect(port.refund('pay-1')).rejects.toThrow(/500/);
    await expect(port.refund('pay-1')).rejects.not.toThrow(/237670000000/);
  });
});
