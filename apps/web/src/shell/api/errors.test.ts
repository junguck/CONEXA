import { describe, expect, it } from 'vitest';

import { BUSINESS_ERROR_CODES, messageForCode } from './errors';

describe('catalogue d’erreurs', () => {
  it('fournit un message non vide pour chaque code de API.md', () => {
    for (const code of BUSINESS_ERROR_CODES) {
      const message = messageForCode(code);
      expect(message, code).not.toBe(code);
      expect(message.length, code).toBeGreaterThan(10);
    }
  });

  it('ne renvoie jamais le code brut comme message', () => {
    expect(messageForCode('CODE_INCONNU')).not.toBe('CODE_INCONNU');
  });

  it('préfère le message du serveur pour un code inconnu', () => {
    expect(messageForCode('NOUVEAU_CODE', 'Message du serveur.')).toBe('Message du serveur.');
  });

  it('couvre les erreurs client', () => {
    expect(messageForCode('NETWORK_ERROR')).toMatch(/réseau/i);
    expect(messageForCode('INVALID_RESPONSE')).toMatch(/serveur/i);
  });
});
