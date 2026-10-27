import { createHmac } from 'node:crypto';

import { describe, expect, it, vi } from 'vitest';

import { CampayProvider } from './campay.provider.js';

const config = {
  // La console donne parfois l'URL avec `/api` : l'adaptateur doit la normaliser.
  baseUrl: 'https://demo.campay.net/api',
  appToken: 'app-token-test',
  appSecret: 'app-secret-test',
  webhookKey: 'webhook-key-test',
};

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

function providerWith(handler: (url: string, init?: RequestInit) => Response) {
  const fetchStub = vi.fn(async (url: string, init?: RequestInit) =>
    url.endsWith('/api/token/') ? jsonResponse({ token: 'jwt-app-token' }) : handler(url, init),
  );
  return { provider: new CampayProvider(config, fetchStub), fetchStub };
}

describe('Campay : authentification', () => {
  it('échange les identifiants d’application contre un jeton, puis le réutilise', async () => {
    const { provider, fetchStub } = providerWith(() => jsonResponse({ reference: 'ref-1' }));

    await provider.getStatus('ref-1');
    await provider.getStatus('ref-1');

    const tokenCalls = fetchStub.mock.calls.filter(([url]) => url.endsWith('/api/token/'));
    expect(tokenCalls).toHaveLength(1);
    const [, init] = tokenCalls[0] as [string, RequestInit];
    expect(JSON.parse(String(init.body))).toEqual({
      username: config.appToken,
      password: config.appSecret,
    });
  });

  it('refuse de continuer si le jeton manque', async () => {
    const provider = new CampayProvider(config, async (url) =>
      url.endsWith('/api/token/') ? jsonResponse({ message: 'nope' }, 401) : jsonResponse({}),
    );
    await expect(provider.getBalance('mtn_momo')).rejects.toThrow(/authentification refusée/);
  });
});

describe('Campay : collecte et statut', () => {
  it('envoie la collecte au format documenté et rend la référence', async () => {
    const { provider, fetchStub } = providerWith(() =>
      jsonResponse({ reference: 'campay-ref', ussd_code: '*126#', operator: 'mtn' }),
    );

    const result = await provider.collect({
      paymentId: 'payment-id',
      amountFcfa: 1500,
      phoneMsisdn: '237650000001',
      operator: 'mtn_momo',
      description: 'Date au restaurant',
      idempotencyKey: 'idem-123',
    });

    expect(result).toEqual({ reference: 'campay-ref', paymentUrl: null });
    const [, init] = fetchStub.mock.calls.find(([url]) => url.endsWith('/api/collect/'))!;
    expect(JSON.parse(String(init?.body))).toEqual({
      amount: '1500',
      currency: 'XAF',
      from: '237650000001',
      description: 'Date au restaurant',
      external_reference: 'idem-123',
    });
  });

  it('traduit PENDING, SUCCESSFUL et FAILED ; un 404 reste inconnu', async () => {
    const statuses: Array<[string, string]> = [
      ['PENDING', 'pending'],
      ['SUCCESSFUL', 'successful'],
      ['FAILED', 'failed'],
    ];
    for (const [given, expected] of statuses) {
      const { provider } = providerWith(() => jsonResponse({ status: given }));
      expect(await provider.getStatus('ref')).toBe(expected);
    }

    const { provider } = providerWith(() => jsonResponse({ message: 'not found' }, 404));
    expect(await provider.getStatus('ref')).toBe('unknown');
  });
});

describe('Campay : solde et décaissement', () => {
  it('lit le solde de l’opérateur demandé, en FCFA entiers', async () => {
    const { provider } = providerWith(() =>
      jsonResponse({
        total_balance: 7250.5,
        mtn_balance: 1250.5,
        orange_balance: 6000.0,
        currency: 'XAF',
      }),
    );
    expect(await provider.getBalance('mtn_momo')).toBe(1251);
    expect(await provider.getBalance('orange_money')).toBe(6000);
  });

  it('refuse un solde illisible plutôt que d’inventer un zéro', async () => {
    const { provider } = providerWith(() => jsonResponse({ total_balance: 10 }, 200));
    await expect(provider.getBalance('orange_money')).rejects.toThrow(
      /solde par opérateur illisible/,
    );
  });

  it('décaisse avec external_reference = identifiant de reversement', async () => {
    const { provider, fetchStub } = providerWith(() =>
      jsonResponse({ reference: 'campay-withdraw', status: 'PENDING' }),
    );

    const result = await provider.disburse({
      payoutId: 'payout-1',
      amountFcfa: 7360,
      msisdn: '237690000002',
      operator: 'orange_money',
      description: 'payout:provider:order',
    });

    expect(result).toEqual({ reference: 'campay-withdraw' });
    const [, init] = fetchStub.mock.calls.find(([url]) => url.endsWith('/api/withdraw/'))!;
    expect(JSON.parse(String(init?.body))).toEqual({
      amount: '7360',
      currency: 'XAF',
      to: '237690000002',
      description: 'payout:provider:order',
      external_reference: 'payout-1',
    });
  });

  it('conserve le code ER301 pour la file à traiter', async () => {
    const { provider } = providerWith(() => jsonResponse({ code: 'ER301' }, 400));
    await expect(
      provider.disburse({
        payoutId: 'payout-2',
        amountFcfa: 100,
        msisdn: '237650000001',
        operator: 'mtn_momo',
        description: 'x',
      }),
    ).rejects.toMatchObject({ details: { code: 'ER301' } });
  });
});

describe('Campay : signature du webhook', () => {
  function sign(payload: Record<string, unknown>, key = config.webhookKey, alg = 'HS256'): string {
    const header = Buffer.from(JSON.stringify({ alg, typ: 'JWT' })).toString('base64url');
    const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
    const signature = createHmac('sha256', key).update(`${header}.${body}`).digest('base64url');
    return `${header}.${body}.${signature}`;
  }

  const body = { status: 'SUCCESSFUL', reference: 'campay-ref', amount: '100.00' };

  it('accepte un JWT HS256 signé avec la clé de webhook', () => {
    const { provider } = providerWith(() => jsonResponse({}));
    expect(() =>
      provider.verifyWebhook({
        rawBody: '',
        body: { ...body, signature: sign(body) },
        signature: undefined,
      }),
    ).not.toThrow();
  });

  it('refuse une signature absente, altérée ou d’un autre algorithme', () => {
    const { provider } = providerWith(() => jsonResponse({}));
    expect(() => provider.verifyWebhook({ rawBody: '', body, signature: undefined })).toThrow(
      /sans signature/,
    );
    expect(() =>
      provider.verifyWebhook({
        rawBody: '',
        body: { ...body, signature: sign(body, 'mauvaise-cle') },
        signature: undefined,
      }),
    ).toThrow(/signature invalide/);
    expect(() =>
      provider.verifyWebhook({
        rawBody: '',
        body: { ...body, signature: sign(body, config.webhookKey, 'none') },
        signature: undefined,
      }),
    ).toThrow(/algorithme/);
  });
});
