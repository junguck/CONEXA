import { describe, expect, it } from 'vitest';

import { matchRoute, upstreamPathFor, type ServiceManifest } from './manifest.js';
import { FixedWindowLimiter } from './rate-limit.js';

const manifests: ServiceManifest[] = [
  {
    service: 'identity',
    base_path: '',
    upstream: 'http://localhost:3001',
    internal: false,
    routes: [
      { method: 'POST', path: '/auth/otp/request', auth: false },
      { method: 'GET', path: '/me', auth: true },
      { method: 'GET', path: '/users/:id', auth: true },
    ],
  },
  {
    service: 'football',
    base_path: '/football',
    upstream: 'http://localhost:3002',
    internal: false,
    routes: [{ method: 'GET', path: '/teams/:id', auth: true }],
  },
];

describe('routage par manifeste', () => {
  it('trouve une route publique', () => {
    expect(matchRoute(manifests, 'POST', '/auth/otp/request')?.manifest.service).toBe('identity');
  });

  it('trouve une route avec paramètre', () => {
    expect(
      matchRoute(manifests, 'GET', '/users/6f1c2a3e-0f2b-4c55-9f4f-1f3a2b4c5d6e')?.route.auth,
    ).toBe(true);
  });

  it('respecte le préfixe du service', () => {
    expect(matchRoute(manifests, 'GET', '/football/teams/abc')?.manifest.service).toBe('football');
    expect(matchRoute(manifests, 'GET', '/teams/abc')).toBeNull();
  });

  it('retire le préfixe public avant d’appeler le service', () => {
    expect(upstreamPathFor('/football/teams/abc', '/football')).toBe('/teams/abc');
    expect(upstreamPathFor('/football/teams', '/football/')).toBe('/teams');
    expect(upstreamPathFor('/football', '/football')).toBe('/');
    expect(upstreamPathFor('/me', '')).toBe('/me');
  });

  it('ne route ni mauvaise méthode ni route inconnue', () => {
    expect(matchRoute(manifests, 'GET', '/auth/otp/request')).toBeNull();
    expect(matchRoute(manifests, 'GET', '/inconnu')).toBeNull();
  });
});

describe('limiteur de débit', () => {
  it('autorise jusqu’à la limite puis renvoie un délai', () => {
    let now = 0;
    const limiter = new FixedWindowLimiter(3, 60_000, () => now);

    expect(limiter.check('user').allowed).toBe(true);
    expect(limiter.check('user').allowed).toBe(true);
    expect(limiter.check('user').allowed).toBe(true);

    now = 15_000;
    const blocked = limiter.check('user');
    expect(blocked.allowed).toBe(false);
    expect(blocked.retryAfterSeconds).toBe(45);

    now = 60_000;
    expect(limiter.check('user').allowed).toBe(true);
  });

  it('compte séparément chaque utilisateur', () => {
    const limiter = new FixedWindowLimiter(1, 60_000, () => 0);
    expect(limiter.check('a').allowed).toBe(true);
    expect(limiter.check('b').allowed).toBe(true);
    expect(limiter.check('a').allowed).toBe(false);
  });
});
