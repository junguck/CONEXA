/**
 * Classement des propositions hebdomadaires (F4.4). Fonctions pures : mêmes
 * entrées, même résultat. Aucune lecture de base, aucun accès à un autre schéma.
 */

export const VECTOR_DIM = 64;
export const QUARANTINE_DAYS = 60;

/** Poids des trois blocs dans le score de ressemblance (somme = 1). */
export const BLOCK_WEIGHTS = { values: 0.5, personality: 0.3, lifestyle: 0.2 } as const;

/** Seuil de valeurs communes sous lequel on ne propose pas de profil « complémentaire ». */
export const COMPLEMENTARY_MIN_VALUES = 0.3;

export interface ProfileVectors {
  values: number[];
  personality: number[];
  lifestyle: number[];
}

export interface Candidate {
  user_id: string;
  vectors: ProfileVectors | null;
}

export type PickKind = 'similar' | 'complementary';
export interface RankedPick {
  user_id: string;
  kind: PickKind;
  score: number;
}

/** Cosinus de deux vecteurs ; 0 si l'un est nul (pas de signal, pas de division). */
export function cosine(a: number[], b: number[]): number {
  if (a.length !== b.length) throw new Error('vecteurs de dimensions différentes');
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let index = 0; index < a.length; index += 1) {
    const x = a[index] ?? 0;
    const y = b[index] ?? 0;
    dot += x * y;
    na += x * x;
    nb += y * y;
  }
  if (na === 0 || nb === 0) return 0;
  return dot / (Math.sqrt(na) * Math.sqrt(nb));
}

/** Ressemblance pondérée des trois blocs, dans [-1, 1]. */
export function similarity(a: ProfileVectors, b: ProfileVectors): number {
  return (
    BLOCK_WEIGHTS.values * cosine(a.values, b.values) +
    BLOCK_WEIGHTS.personality * cosine(a.personality, b.personality) +
    BLOCK_WEIGHTS.lifestyle * cosine(a.lifestyle, b.lifestyle)
  );
}

/** Un refus vieux de moins de 60 jours met la personne en quarantaine. */
export function inQuarantine(declinedAt: Date | null, now: Date): boolean {
  if (declinedAt === null) return false;
  return now.getTime() - declinedAt.getTime() < QUARANTINE_DAYS * 86_400_000;
}

export function isValidVector(vector: unknown): vector is number[] {
  return (
    Array.isArray(vector) &&
    vector.length === VECTOR_DIM &&
    vector.every((value) => typeof value === 'number' && Number.isFinite(value))
  );
}

/**
 * Deux « ressemblants » (meilleurs scores) puis un « complémentaire » : parmi les
 * restants qui partagent assez de valeurs, celui dont la personnalité diffère le
 * plus. Égalités départagées par identifiant : le tirage est reproductible.
 * Sans vecteur du demandeur, ou pour les candidats sans vecteur, on complète à
 * score neutre (0) dans l'ordre des identifiants.
 */
export function rankPicks(
  me: ProfileVectors | null,
  candidates: Candidate[],
  count = 3,
): RankedPick[] {
  const sorted = [...candidates].sort((a, b) => a.user_id.localeCompare(b.user_id));
  const scored = sorted.map((candidate) => ({
    candidate,
    score: me && candidate.vectors ? similarity(me, candidate.vectors) : 0,
    has: me !== null && candidate.vectors !== null,
  }));

  const byScore = [...scored].sort(
    (a, b) => b.score - a.score || a.candidate.user_id.localeCompare(b.candidate.user_id),
  );
  const similar = byScore.slice(0, Math.max(0, count - 1));
  const chosen = new Set(similar.map((entry) => entry.candidate.user_id));

  let complementary: (typeof scored)[number] | undefined;
  if (me) {
    complementary = scored
      .filter(
        (entry) =>
          !chosen.has(entry.candidate.user_id) &&
          entry.has &&
          cosine(me.values, entry.candidate.vectors!.values) >= COMPLEMENTARY_MIN_VALUES,
      )
      .sort(
        (a, b) =>
          cosine(me.personality, a.candidate.vectors!.personality) -
            cosine(me.personality, b.candidate.vectors!.personality) ||
          a.candidate.user_id.localeCompare(b.candidate.user_id),
      )[0];
  }
  if (!complementary) {
    complementary = byScore.find((entry) => !chosen.has(entry.candidate.user_id));
  }

  const picks: RankedPick[] = similar.map((entry) => ({
    user_id: entry.candidate.user_id,
    kind: 'similar' as const,
    score: entry.score,
  }));
  if (complementary && picks.length < count) {
    picks.push({
      user_id: complementary.candidate.user_id,
      kind: 'complementary',
      score: complementary.score,
    });
  }
  return picks;
}
