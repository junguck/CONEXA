import { describe, expect, it } from 'vitest';

import { cosine, hashEmbedding, rankBySimilarity, tokenize } from './embeddings.js';

describe('tokenisation', () => {
  it('ignore la casse et les accents', () => {
    expect(tokenize('Randonnée, Cuisine et Yassa')).toEqual(['randonnee', 'cuisine', 'yassa']);
  });

  it('écarte les mots vides et les lettres isolées', () => {
    expect(tokenize('je suis à la maison')).toEqual(['suis', 'maison']);
  });
});

describe('vecteur local', () => {
  it('est déterministe', () => {
    expect(hashEmbedding('football du dimanche')).toEqual(hashEmbedding('football du dimanche'));
  });

  it('est normalisé sur la sphère unité', () => {
    const norm = Math.sqrt(hashEmbedding('musique afrobeat').reduce((t, v) => t + v * v, 0));
    expect(norm).toBeCloseTo(1, 3);
  });

  it('rapproche deux textes qui partagent des mots', () => {
    const a = hashEmbedding('j’aime le football et la musique');
    const b = hashEmbedding('musique et football le week-end');
    const c = hashEmbedding('couture tricot broderie');
    expect(cosine(a, b)).toBeGreaterThan(cosine(a, c));
  });

  it('accepte une autre dimension', () => {
    expect(hashEmbedding('test', 16)).toHaveLength(16);
  });
});

describe('cosinus', () => {
  it('vaut 1 pour un vecteur avec lui-même', () => {
    const vector = hashEmbedding('match de football');
    expect(cosine(vector, vector)).toBeCloseTo(1, 5);
  });

  it('vaut 0 si un vecteur est nul', () => {
    expect(cosine([0, 0, 0, 0], hashEmbedding('football', 4))).toBe(0);
  });

  it('refuse des dimensions différentes', () => {
    expect(() => cosine([1, 0], [1, 0, 0])).toThrow(/Dimensions/);
  });
});

describe('classement', () => {
  it('trie par score décroissant et respecte la limite', () => {
    const query = hashEmbedding('football musique');
    const results = rankBySimilarity(
      query,
      [
        { owner_id: 'b0000000-0000-4000-8000-000000000001', vector: hashEmbedding('couture') },
        {
          owner_id: 'b0000000-0000-4000-8000-000000000002',
          vector: hashEmbedding('football musique'),
        },
      ],
      1,
    );
    expect(results).toHaveLength(1);
    expect(results[0]?.owner_id).toBe('b0000000-0000-4000-8000-000000000002');
    expect(results[0]?.score).toBeGreaterThan(0.9);
  });

  it('exclut les identifiants demandés', () => {
    const query = hashEmbedding('football');
    const results = rankBySimilarity(
      query,
      [
        { owner_id: 'a0000000-0000-4000-8000-000000000001', vector: hashEmbedding('football') },
        { owner_id: 'a0000000-0000-4000-8000-000000000002', vector: hashEmbedding('football') },
      ],
      5,
      ['a0000000-0000-4000-8000-000000000001'],
    );
    expect(results.map((result) => result.owner_id)).toEqual([
      'a0000000-0000-4000-8000-000000000002',
    ]);
  });
});
