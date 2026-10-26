import { AppError } from '@conexa/errors';
import { describe, expect, it } from 'vitest';

import { aggregateEvents, badgesForMatch, reconcile } from './report.js';
import {
  assertCanJoin,
  assertSquadHasRoom,
  canCancelMatch,
  contestWindowOpen,
  cooldownUntil,
  JOIN_COOLDOWN_DAYS,
} from './rules.js';

const PLAYER = '6f1c2a3e-0f2b-4c55-9f4f-1f3a2b4c5d6e';
const TEAMMATE = '1f3a2b4c-5d6e-4f7a-8b9c-0d1e2f3a4b5c';

const goal = (minute: number, player = PLAYER) => ({
  type: 'goal' as const,
  minute,
  player_id: player,
});

describe('déclarations de match', () => {
  it('valide deux déclarations identiques même dans un ordre différent', () => {
    expect(
      reconcile(
        { score_a: 2, score_b: 1, events: [goal(12), goal(55, TEAMMATE)] },
        { score_a: 2, score_b: 1, events: [goal(55, TEAMMATE), goal(12)] },
      ),
    ).toBe('validated');
  });

  it('passe en litige sur un score ou un fait divergent', () => {
    expect(
      reconcile(
        { score_a: 2, score_b: 1, events: [goal(12)] },
        { score_a: 2, score_b: 2, events: [goal(12)] },
      ),
    ).toBe('disputed');
    expect(
      reconcile(
        { score_a: 1, score_b: 0, events: [goal(12)] },
        { score_a: 1, score_b: 0, events: [goal(13)] },
      ),
    ).toBe('disputed');
  });

  it('agrège buts, passes et cartons par joueur', () => {
    const stats = aggregateEvents([
      goal(10),
      { type: 'goal', minute: 20, player_id: TEAMMATE, related_player_id: PLAYER },
      { type: 'assist', minute: 30, player_id: TEAMMATE },
      { type: 'yellow_card', minute: 40, player_id: PLAYER },
      { type: 'own_goal', minute: 44, player_id: PLAYER },
    ]);

    expect(stats.goals.get(PLAYER)).toBe(1);
    expect(stats.goals.get(TEAMMATE)).toBe(1);
    expect(stats.assists.get(PLAYER)).toBe(1);
    expect(stats.assists.get(TEAMMATE)).toBe(1);
    expect(stats.cards.get(PLAYER)).toEqual({ yellow: 1, red: 0 });
  });

  it('attribue les badges attendus', () => {
    expect(badgesForMatch({ goals: 0, assists: 0, firstMatch: true })).toEqual(['first_match']);
    expect(badgesForMatch({ goals: 3, assists: 0, firstMatch: false })).toEqual(['hat_trick']);
    expect(badgesForMatch({ goals: 3, assists: 3, firstMatch: true })).toEqual([
      'first_match',
      'hat_trick',
      'playmaker',
    ]);
  });
});

describe('règles d’effectif', () => {
  const now = new Date('2026-11-03T10:00:00Z');

  it('refuse une deuxième équipe active', () => {
    expect(() => assertCanJoin({ activeTeamId: 'team-1', now })).toThrowError(
      expect.objectContaining({ code: 'TEAM_ALREADY_MEMBER' }),
    );
  });

  it('refuse un retour avant la fin du gel de 7 jours', () => {
    const leftAt = new Date('2026-11-01T10:00:00Z');
    const until = cooldownUntil(leftAt);
    expect(JOIN_COOLDOWN_DAYS).toBe(7);
    expect(() => assertCanJoin({ cooldownUntil: until, now })).toThrowError(AppError);
    expect(() => assertCanJoin({ cooldownUntil: until, now })).toThrowError(/7 jours/);
    expect(() =>
      assertCanJoin({ cooldownUntil: until, now: new Date('2026-11-09T10:00:00Z') }),
    ).not.toThrow();
  });

  it('limite l’effectif à 16 joueurs', () => {
    expect(() => assertSquadHasRoom(15)).not.toThrow();
    expect(() => assertSquadHasRoom(16)).toThrowError(/Effectif complet/);
  });

  it('interdit l’annulation à moins de deux heures du coup d’envoi', () => {
    const kickoff = new Date('2026-11-03T12:00:00Z');
    expect(canCancelMatch(kickoff, new Date('2026-11-03T09:59:00Z'))).toBe(true);
    expect(canCancelMatch(kickoff, new Date('2026-11-03T10:01:00Z'))).toBe(false);
  });

  it('ferme la contestation après 48 heures', () => {
    const finalized = new Date('2026-11-01T10:00:00Z');
    expect(contestWindowOpen(finalized, new Date('2026-11-02T10:00:00Z'))).toBe(true);
    expect(contestWindowOpen(finalized, new Date('2026-11-04T10:00:00Z'))).toBe(false);
    expect(contestWindowOpen(null, now)).toBe(false);
  });
});
