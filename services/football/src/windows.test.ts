import { describe, expect, it } from 'vitest';

import {
  MVP_VOTE_WINDOW_HOURS,
  REPORT_DEADLINE_HOURS,
  mvpVoteDeadline,
  mvpWindowOpen,
  reportDeadline,
  shouldCancelForNoReport,
  shouldCloseContest,
  shouldProvisionalValidate,
} from './rules.js';

const finalized = new Date('2026-11-01T22:00:00Z');

describe('fenêtre de vote MVP (ADR 0008 : 24 h)', () => {
  it('fixe la fenêtre à 24 heures après la validation', () => {
    expect(MVP_VOTE_WINDOW_HOURS).toBe(24);
    expect(mvpVoteDeadline(finalized)?.toISOString()).toBe('2026-11-02T22:00:00.000Z');
  });

  it('accepte un vote dans les 24 h, refuse au-delà', () => {
    expect(mvpWindowOpen(finalized, new Date('2026-11-02T21:59:59Z'))).toBe(true);
    expect(mvpWindowOpen(finalized, new Date('2026-11-02T22:00:01Z'))).toBe(false);
  });

  it('n’ouvre aucun vote sans match finalisé', () => {
    expect(mvpWindowOpen(null, finalized)).toBe(false);
    expect(mvpVoteDeadline(null)).toBeNull();
  });
});

describe('clôture des rapports (24 h après le coup d’envoi)', () => {
  const kickoff = new Date('2026-11-01T18:00:00Z');
  const base = { startsAt: kickoff };

  it('ne fait rien avant l’échéance', () => {
    expect(REPORT_DEADLINE_HOURS).toBe(24);
    expect(reportDeadline(kickoff).toISOString()).toBe('2026-11-02T18:00:00.000Z');
    expect(
      shouldProvisionalValidate({ ...base, reports: 1, now: new Date('2026-11-02T17:59:00Z') }),
    ).toBe(false);
    expect(
      shouldCancelForNoReport({ ...base, reports: 0, now: new Date('2026-11-02T17:59:00Z') }),
    ).toBe(false);
  });

  it('valide provisoirement une déclaration unique à H+24', () => {
    expect(
      shouldProvisionalValidate({ ...base, reports: 1, now: new Date('2026-11-02T18:00:00Z') }),
    ).toBe(true);
    expect(
      shouldProvisionalValidate({ ...base, reports: 2, now: new Date('2026-11-02T18:05:00Z') }),
    ).toBe(false);
  });

  it('annule un match sans aucune déclaration à H+24', () => {
    expect(
      shouldCancelForNoReport({ ...base, reports: 0, now: new Date('2026-11-02T18:00:00Z') }),
    ).toBe(true);
    expect(
      shouldCancelForNoReport({ ...base, reports: 1, now: new Date('2026-11-02T18:00:00Z') }),
    ).toBe(false);
  });
});

describe('clôture de la contestation (48 h)', () => {
  it('ne clôt pas avant 48 h et clôt une seule fois', () => {
    expect(
      shouldCloseContest({
        finalizedAt: finalized,
        contestClosedAt: null,
        now: new Date('2026-11-03T21:59:00Z'),
      }),
    ).toBe(false);
    expect(
      shouldCloseContest({
        finalizedAt: finalized,
        contestClosedAt: null,
        now: new Date('2026-11-03T22:00:00Z'),
      }),
    ).toBe(true);
    expect(
      shouldCloseContest({
        finalizedAt: finalized,
        contestClosedAt: new Date('2026-11-03T22:00:00Z'),
        now: new Date('2026-11-04T22:00:00Z'),
      }),
    ).toBe(false);
    expect(shouldCloseContest({ finalizedAt: null, contestClosedAt: null, now: finalized })).toBe(
      false,
    );
  });
});
