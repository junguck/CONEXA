import { describe, expect, it } from 'vitest';

import {
  afterSignature,
  canPropose,
  canSign,
  nextVersion,
  snapshotCommission,
  type AgreementState,
} from './agreements.rules.js';

const v = (version: number, status: AgreementState['status'], pct = 10): AgreementState => ({
  version,
  status,
  commission_pct: pct,
});

describe('contrats versionnés', () => {
  it('numérote au-dessus de la plus haute version', () => {
    expect(nextVersion([])).toBe(1);
    expect(nextVersion([v(1, 'superseded'), v(3, 'active')])).toBe(4);
  });

  it('refuse une seconde proposition tant qu’une est en attente', () => {
    expect(canPropose([v(1, 'active')])).toBe(true);
    expect(canPropose([v(1, 'active'), v(2, 'pending_signature')])).toBe(false);
  });

  it('ne se signe que depuis pending_signature', () => {
    expect(canSign('pending_signature')).toBe(true);
    expect(canSign('active')).toBe(false);
    expect(canSign('superseded')).toBe(false);
  });

  it('la signature remplace l’actif et laisse un seul actif', () => {
    const after = afterSignature([v(1, 'active', 10), v(2, 'pending_signature', 12)], 2);
    expect(after.map((item) => item.status)).toEqual(['superseded', 'active']);
    expect(after.filter((item) => item.status === 'active')).toHaveLength(1);
  });

  it('ne touche pas un ancien contrat déjà remplacé', () => {
    const after = afterSignature(
      [v(1, 'superseded'), v(2, 'active'), v(3, 'pending_signature')],
      3,
    );
    expect(after.map((item) => item.status)).toEqual(['superseded', 'superseded', 'active']);
  });

  it('l’instantané copie le taux du contrat actif, jamais d’un autre', () => {
    expect(snapshotCommission(v(2, 'active', 12))).toBe(12);
    expect(snapshotCommission(v(3, 'pending_signature', 5))).toBeNull();
    expect(snapshotCommission(undefined)).toBeNull();
  });
});
