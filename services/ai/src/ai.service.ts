import { randomUUID } from 'node:crypto';

import { Injectable } from '@nestjs/common';

import type {
  Embedding,
  EmbeddingOwnerType,
  SimilarRequestInput,
  SimilarResult,
  UpsertEmbeddingInput,
} from '@conexa/contracts';
import { notFound, validationError } from '@conexa/errors';

import { env } from './config.js';
import { db } from './db.js';
import { createEmbeddingProvider } from './embedding.provider.js';
import { cosine, formatVector, parseVector, rankBySimilarity } from './embeddings.js';

@Injectable()
export class AiService {
  readonly provider = createEmbeddingProvider();

  /**
   * Encodage idempotent : le dernier texte gagne, un seul vecteur par
   * propriétaire. Un changement de modèle ou de dimension remplace l'ancien
   * vecteur au lieu de le laisser comparable à tort.
   */
  async upsert(input: UpsertEmbeddingInput): Promise<Embedding> {
    const [vector] = await this.provider.embed([input.text]);
    if (!vector) {
      throw validationError('Texte non encodable');
    }

    const row = await db
      .insertInto('embeddings')
      .values({
        id: randomUUID(),
        owner_type: input.owner_type,
        owner_id: input.owner_id,
        model: this.provider.model,
        dimensions: vector.length,
        vector: formatVector(vector),
        updated_at: new Date(),
      })
      .onConflict((oc) =>
        oc.columns(['owner_type', 'owner_id']).doUpdateSet({
          model: this.provider.model,
          dimensions: vector.length,
          vector: formatVector(vector),
          updated_at: new Date(),
        }),
      )
      .returning(['owner_type', 'owner_id', 'dimensions', 'model', 'updated_at'])
      .executeTakeFirstOrThrow();

    return {
      owner_type: row.owner_type,
      owner_id: row.owner_id,
      dimensions: row.dimensions,
      model: row.model,
      updated_at: row.updated_at.toISOString(),
    };
  }

  /**
   * Classe les propriétaires par similarité avec un texte ou un vecteur
   * existant. Le calcul ignore les vecteurs d'un autre modèle ou d'une autre
   * dimension : mieux vaut ne rien comparer que comparer faux.
   */
  async similar(input: SimilarRequestInput): Promise<SimilarResult> {
    const query = await this.referenceVector(input);

    const rows = await db
      .selectFrom('embeddings')
      .select(['owner_id', 'vector', 'dimensions', 'model'])
      .where('owner_type', '=', input.owner_type)
      .execute();

    const candidates = rows
      .filter((row) => row.model === this.provider.model && row.dimensions === query.length)
      .map((row) => ({ owner_id: row.owner_id, vector: parseVector(row.vector) }));

    return {
      results: rankBySimilarity(query, candidates, input.limit, [
        ...input.exclude,
        ...(input.owner_id ? [input.owner_id] : []),
      ]),
      compared: candidates.length,
    };
  }

  /** Santé du fournisseur : appelé par /ready, jamais par une route publique. */
  async checkProvider(): Promise<boolean> {
    try {
      await this.provider.embed(['connexa']);
      return true;
    } catch {
      return false;
    }
  }

  private async referenceVector(input: SimilarRequestInput): Promise<number[]> {
    if (input.text !== undefined) {
      const [vector] = await this.provider.embed([input.text]);
      if (!vector) throw validationError('Texte non encodable');
      return vector;
    }

    const row = await db
      .selectFrom('embeddings')
      .select(['vector', 'dimensions', 'model'])
      .where('owner_type', '=', input.owner_type)
      .where('owner_id', '=', input.owner_id as string)
      .executeTakeFirst();
    if (!row) throw notFound('Vecteur de référence');
    if (row.dimensions !== env.EMBEDDING_DIMENSIONS) {
      throw validationError('Vecteur de référence d’une autre dimension : à réencoder');
    }
    return parseVector(row.vector);
  }

  /** Utilisé par les tests et le diagnostic : deux vecteurs identiques valent 1. */
  static compare(left: number[], right: number[]): number {
    return cosine(left, right);
  }
}

export type { EmbeddingOwnerType };
