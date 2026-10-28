import { EMBEDDING_DIMENSIONS } from '@conexa/contracts';

/**
 * Embeddings locaux, sans dépendance ni service externe. Ce n'est pas un modèle
 * sémantique : deux textes se ressemblent s'ils partagent des mots. C'est
 * suffisant pour développer et tester les parcours (F4.3, F5.1) en attendant un
 * fournisseur ; l'interface reste la même le jour où on en branche un.
 */

const STOP_WORDS = new Set([
  'le',
  'la',
  'les',
  'un',
  'une',
  'des',
  'de',
  'du',
  'et',
  'en',
  'a',
  'au',
  'aux',
  'je',
  'tu',
  'il',
  'nous',
  'vous',
  'ils',
  'que',
  'qui',
  'pour',
  'avec',
  'sur',
  'dans',
  'est',
  'sont',
  'mon',
  'ma',
  'mes',
  'the',
  'and',
]);

export function normalizeText(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

export function tokenize(text: string): string[] {
  return normalizeText(text)
    .split(/[^a-z0-9]+/)
    .filter((token) => token.length >= 2 && !STOP_WORDS.has(token));
}

/** FNV-1a 32 bits : stable entre processus, contrairement à `Math.random`. */
function fnv1a(token: string): number {
  let hash = 0x811c9dc5;
  for (let index = 0; index < token.length; index += 1) {
    hash ^= token.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash;
}

/**
 * Sac de mots projeté sur `dimensions` axes avec signe : deux textes partageant
 * des mots ont un cosinus élevé, deux textes sans mot commun ont un cosinus bas.
 */
export function hashEmbedding(text: string, dimensions = EMBEDDING_DIMENSIONS): number[] {
  if (dimensions <= 0) throw new RangeError('dimensions doit être positif');
  const vector = new Array<number>(dimensions).fill(0);

  for (const token of tokenize(text)) {
    const hash = fnv1a(token);
    const index = hash % dimensions;
    // Le bit suivant décide du signe : les collisions ne s'additionnent pas.
    const sign = (hash >>> 8) % 2 === 0 ? 1 : -1;
    vector[index] = (vector[index] ?? 0) + sign;
  }

  return l2Normalize(vector);
}

export function l2Normalize(vector: number[]): number[] {
  const norm = Math.sqrt(vector.reduce((total, value) => total + value * value, 0));
  if (norm === 0) return vector.map(() => 0);
  return vector.map((value) => Number((value / norm).toFixed(6)));
}

/** Cosinus ; deux vecteurs de dimensions différentes ne sont pas comparables. */
export function cosine(a: number[], b: number[]): number {
  if (a.length !== b.length) throw new RangeError('Dimensions incompatibles');
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let index = 0; index < a.length; index += 1) {
    const x = a[index] ?? 0;
    const y = b[index] ?? 0;
    dot += x * y;
    normA += x * x;
    normB += y * y;
  }
  if (normA === 0 || normB === 0) return 0;
  return Number((dot / Math.sqrt(normA * normB)).toFixed(6));
}

export function rankBySimilarity(
  query: number[],
  candidates: Array<{ owner_id: string; vector: number[] }>,
  limit: number,
  exclude: string[] = [],
): Array<{ owner_id: string; score: number }> {
  const skip = new Set(exclude);
  return (
    candidates
      .filter((candidate) => !skip.has(candidate.owner_id))
      .map((candidate) => ({
        owner_id: candidate.owner_id,
        score: cosine(query, candidate.vector),
      }))
      // À score égal, l'ordre reste stable : le tri est déterministe.
      .sort(
        (left, right) => right.score - left.score || left.owner_id.localeCompare(right.owner_id),
      )
      .slice(0, limit)
  );
}
