import { describe, expect, it } from 'vitest';

import { payloadFor } from './cards.js';
import { assertKeysMatchQuestionnaire } from './profile.js';
import {
  ageAt,
  assertInviteQuota,
  canCancelDate,
  canRevealContact,
  canTransition,
  eligibilityOf,
  INVITES_PER_WEEK,
  isAdult,
  resolvePayer,
  weekStart,
} from './rules.js';
import { QUESTIONNAIRE_BLOCKS } from '@conexa/contracts';

const NOW = new Date('2026-11-04T12:00:00Z'); // mercredi

describe('éligibilité', () => {
  const birthDate = new Date('2004-05-12T00:00:00Z');

  it('calcule l’âge en tenant compte de l’anniversaire', () => {
    expect(ageAt(birthDate, NOW)).toBe(22);
    expect(ageAt(new Date('2008-11-05T00:00:00Z'), NOW)).toBe(17);
  });

  it('refuse un mineur même avec un questionnaire complet', () => {
    expect(
      eligibilityOf({
        birthDate: new Date('2010-01-01T00:00:00Z'),
        questionnaireVersion: 1,
        reliability: 100,
        now: NOW,
      }),
    ).toEqual({ eligible: false, reasons: ['AGE_RESTRICTED'] });
    expect(isAdult(new Date('2010-01-01T00:00:00Z'), NOW)).toBe(false);
  });

  it('exige le questionnaire et une fiabilité suffisante', () => {
    expect(
      eligibilityOf({ birthDate, questionnaireVersion: null, reliability: 100, now: NOW }),
    ).toEqual({ eligible: false, reasons: ['QUESTIONNAIRE_MISSING'] });
    expect(
      eligibilityOf({ birthDate, questionnaireVersion: 1, reliability: 59, now: NOW }),
    ).toEqual({ eligible: false, reasons: ['RELIABILITY_TOO_LOW'] });
    expect(
      eligibilityOf({ birthDate, questionnaireVersion: 1, reliability: 80, now: NOW }),
    ).toEqual({ eligible: true, reasons: [] });
  });
});

describe('semaine et quotas', () => {
  it('démarre le lundi en UTC', () => {
    expect(weekStart(NOW)).toBe('2026-11-02');
    expect(weekStart(new Date('2026-11-02T00:00:00Z'))).toBe('2026-11-02');
    expect(weekStart(new Date('2026-11-08T23:59:00Z'))).toBe('2026-11-02');
  });

  it('bloque la quatrième invitation de la semaine', () => {
    expect(INVITES_PER_WEEK).toBe(3);
    expect(() => assertInviteQuota(2)).not.toThrow();
    expect(() => assertInviteQuota(3)).toThrowError(
      expect.objectContaining({ code: 'WEEKLY_QUOTA_EXCEEDED' }),
    );
  });
});

describe('payeur', () => {
  it('désigne l’invitant', () => {
    expect(resolvePayer({ from_user_id: 'a', to_user_id: 'b' })).toBe('a');
  });

  it('refuse les invitations incohérentes', () => {
    expect(() => resolvePayer({ from_user_id: 'a', to_user_id: 'a' })).toThrowError(
      /même personne/,
    );
    expect(() => resolvePayer({ from_user_id: '', to_user_id: 'b' })).toThrowError(
      /payeur indéterminable/,
    );
  });
});

describe('annulation', () => {
  const slot = new Date('2026-11-05T19:00:00Z');

  it('autorise jusqu’à trois heures avant', () => {
    expect(canCancelDate(slot, new Date('2026-11-05T16:00:00Z'))).toBe(true);
    expect(canCancelDate(slot, new Date('2026-11-05T16:01:00Z'))).toBe(false);
    expect(canCancelDate(null, NOW)).toBe(true);
  });
});

describe('révélation du contact', () => {
  it('exige deux « oui » et un date honoré', () => {
    const yes = { wants_contact: true };
    const no = { wants_contact: false };
    expect(canRevealContact({ status: 'checked_in', myFeedback: yes, partnerFeedback: yes })).toBe(
      true,
    );
    expect(canRevealContact({ status: 'checked_in', myFeedback: yes, partnerFeedback: no })).toBe(
      false,
    );
    expect(canRevealContact({ status: 'confirmed', myFeedback: yes, partnerFeedback: yes })).toBe(
      false,
    );
    expect(canRevealContact({ status: 'completed', myFeedback: yes, partnerFeedback: null })).toBe(
      false,
    );
  });
});

describe('machine à états du date', () => {
  it('autorise le parcours nominal et refuse les sauts', () => {
    expect(canTransition('negotiating', 'awaiting_payment')).toBe(true);
    expect(canTransition('awaiting_payment', 'confirmed')).toBe(true);
    expect(canTransition('confirmed', 'checked_in')).toBe(true);
    expect(canTransition('checked_in', 'completed')).toBe(true);
    expect(canTransition('negotiating', 'confirmed')).toBe(false);
    expect(canTransition('completed', 'cancelled')).toBe(false);
  });
});

describe('cartes', () => {
  const slot = '6f1c2a3e-0f2b-4c55-9f4f-1f3a2b4c5d6e';

  it('n’accepte que la charge utile attendue', () => {
    expect(payloadFor('SLOT_PROPOSE', { slot_id: slot })).toEqual({ slot_id: slot });
    expect(payloadFor('THANKS', {})).toEqual({});
    expect(() => payloadFor('THANKS', { slot_id: slot })).toThrowError(/aucune charge utile/);
    expect(() => payloadFor('SLOT_PROPOSE', {})).toThrowError(/attend exactement/);
    expect(() => payloadFor('SLOT_ACCEPT', { slot_id: 'texte libre' })).toThrowError(/invalide/);
  });
});

describe('questionnaire', () => {
  const answers = Object.fromEntries(
    QUESTIONNAIRE_BLOCKS.flatMap((block) =>
      block.questions.map((question) => [
        question.key,
        question.kind === 'scale' ? 3 : (question.options?.[0] as string),
      ]),
    ),
  );

  it('accepte un questionnaire complet', () => {
    expect(() => assertKeysMatchQuestionnaire(answers, QUESTIONNAIRE_BLOCKS)).not.toThrow();
  });

  it('refuse une clé inconnue ou une réponse hors barème', () => {
    expect(() =>
      assertKeysMatchQuestionnaire({ ...answers, libre: 'bonjour' }, QUESTIONNAIRE_BLOCKS),
    ).toThrowError(/Question inconnue/);
    expect(() =>
      assertKeysMatchQuestionnaire({ ...answers, personality_speaking: 9 }, QUESTIONNAIRE_BLOCKS),
    ).toThrowError(/note de 1 à 5/);
  });
});
