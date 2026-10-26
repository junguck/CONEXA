import { describe, expect, it } from 'vitest';
import { AppError } from '@conexa/errors';
import { SendMessageSchema } from '@conexa/contracts';

import { assertMessageAllowed, inspectMessage } from './chat-filter.js';

describe('filtre des conversations', () => {
  it('laisse passer une organisation de match normale', () => {
    for (const body of [
      'On joue à 16h sur le terrain A ?',
      'Il nous manque un gardien pour samedi.',
      'On prend le maillot blanc ou le bleu ?',
      'Prévois 2 litres d’eau, il fait chaud.',
    ]) {
      expect(inspectMessage(body)).toEqual({ allowed: true, reason: null });
    }
  });

  it('bloque une suite de chiffres avant le match', () => {
    for (const body of ['appelle moi 655443312', 'mon num 6 55 44 33 12', '06.55.44.33.12']) {
      const verdict = inspectMessage(body);
      expect(verdict.allowed).toBe(false);
      expect(verdict.reason).toBe('CHAT_DIGIT_BLOCKED');
    }
  });

  it('bloque WhatsApp, Telegram et les poignées sociales', () => {
    for (const body of [
      'écris-moi sur wa.me/237655443312',
      'mon instagram : @capitaine_lions',
      'viens sur Telegram',
      '+237 6 55 44 33 12',
    ]) {
      const verdict = inspectMessage(body);
      expect(verdict.allowed).toBe(false);
      expect(verdict.reason).toBe('CHAT_CONTACT_BLOCKED');
    }
  });

  it('refuse avec le code d’erreur du contrat', () => {
    try {
      assertMessageAllowed('donne moi ton 655443312');
      expect.unreachable();
    } catch (error) {
      expect(error).toBeInstanceOf(AppError);
      expect((error as AppError).code).toBe('CHAT_DIGIT_BLOCKED');
      expect((error as AppError).status).toBe(422);
    }
  });

  it('n’applique le filtre qu’aux textes : les cartes sont fermées', () => {
    expect(SendMessageSchema.safeParse({ kind: 'text', body: 'ok pour 16h' }).success).toBe(true);
    expect(SendMessageSchema.safeParse({ kind: 'text', body: '' }).success).toBe(false);
    expect(
      SendMessageSchema.safeParse({ kind: 'card', card_type: 'SLOT_PROPOSE', payload: {} }).success,
    ).toBe(true);
    expect(SendMessageSchema.safeParse({ kind: 'card', body: '655443312' }).success).toBe(false);
  });
});
