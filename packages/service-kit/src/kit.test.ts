import 'reflect-metadata';

import { exportSPKI, generateKeyPair, SignJWT } from 'jose';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';

import { createJwtVerifier } from './auth.js';
import { BaseEnvSchema, parseEnv } from './config.js';
import { maskMatricule, maskPhone, REDACTED_PATHS } from './logger.js';

const USER_ID = '6f1c2a3e-0f2b-4c55-9f4f-1f3a2b4c5d6e';

describe('configuration', () => {
  it('applique des valeurs par défaut sûres', () => {
    const env = parseEnv(BaseEnvSchema, {});
    expect(env.NODE_ENV).toBe('development');
    expect(env.PORT).toBe(3000);
  });

  it('traite un PORT vide comme absent (docker compose passe une chaîne vide)', () => {
    expect(parseEnv(BaseEnvSchema, { PORT: '' }).PORT).toBe(3000);
  });

  it('refuse une configuration invalide en nommant la variable', () => {
    expect(() => parseEnv(BaseEnvSchema, { PORT: 'abc' })).toThrow(/PORT/);
    expect(() => parseEnv(BaseEnvSchema, { DATABASE_URL: '' })).toThrow(/DATABASE_URL/);
  });

  it('accepte un schéma enrichi par un service', () => {
    const schema = BaseEnvSchema.extend({ JWT_PUBLIC_KEY: z.string().min(10) });
    expect(parseEnv(schema, { JWT_PUBLIC_KEY: '-----BEGIN PUBLIC KEY-----' }).PORT).toBe(3000);
  });
});

describe('masquage', () => {
  it('masque le numéro WhatsApp sans perdre les deux derniers chiffres', () => {
    expect(maskPhone('+237655443312')).toBe('+237 6** *** **12');
  });

  it('masque un matricule', () => {
    expect(maskMatricule('ETU2026123')).toBe('ET******23');
  });

  it('liste les chemins sensibles à masquer dans pino', () => {
    expect(REDACTED_PATHS).toContain('*.whatsapp');
    expect(REDACTED_PATHS).toContain('req.headers.authorization');
  });
});

describe('vérification JWT RS256', () => {
  it('accepte un jeton signé par Identity et refuse un jeton expiré', async () => {
    const { publicKey, privateKey } = await generateKeyPair('RS256');
    const publicPem = await exportSPKI(publicKey);
    const verifier = createJwtVerifier({ publicKey: publicPem });

    const now = Math.floor(Date.now() / 1000);
    const valid = await new SignJWT({
      sub: USER_ID,
      roles: ['student'],
      status: 'active',
      iat: now,
      exp: now + 300,
    })
      .setProtectedHeader({ alg: 'RS256' })
      .sign(privateKey);

    await expect(verifier.verify(valid)).resolves.toMatchObject({
      sub: USER_ID,
      roles: ['student'],
    });

    const expired = await new SignJWT({
      sub: USER_ID,
      roles: ['student'],
      status: 'active',
      iat: now - 7200,
      exp: now - 3600,
    })
      .setProtectedHeader({ alg: 'RS256' })
      .sign(privateKey);

    await expect(verifier.verify(expired)).rejects.toMatchObject({ code: 'UNAUTHENTICATED' });
  });
});
