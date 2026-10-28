import { AppError } from '@conexa/errors';

import { env } from './config.js';
import { hashEmbedding } from './embeddings.js';

/**
 * Fournisseur d'embeddings derrière une interface. `local` (défaut) calcule un
 * sac de mots normalisé, sans réseau. `http` parle à une API compatible
 * OpenAI (`/embeddings`) et exige une clé : sans clé il refuse de démarrer,
 * jamais de repli silencieux qui produirait des vecteurs incohérents.
 */
export interface EmbeddingProvider {
  readonly model: string;
  readonly dimensions: number;
  embed(texts: string[]): Promise<number[][]>;
}

export class LocalEmbeddingProvider implements EmbeddingProvider {
  readonly model = 'local-bag-of-words-v1';

  constructor(readonly dimensions: number) {}

  async embed(texts: string[]): Promise<number[][]> {
    return texts.map((text) => hashEmbedding(text, this.dimensions));
  }
}

export type FetchLike = (input: string, init: RequestInit) => Promise<Response>;

export class HttpEmbeddingProvider implements EmbeddingProvider {
  readonly dimensions: number;

  constructor(
    private readonly options: {
      baseUrl: string;
      apiKey: string;
      model: string;
      dimensions: number;
    },
    private readonly fetchImpl: FetchLike = fetch,
  ) {
    this.dimensions = options.dimensions;
    this.model = options.model;
  }

  readonly model: string;

  async embed(texts: string[]): Promise<number[][]> {
    const response = await this.fetchImpl(`${this.options.baseUrl.replace(/\/$/, '')}/embeddings`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${this.options.apiKey}`,
      },
      body: JSON.stringify({ model: this.options.model, input: texts }),
    });

    if (!response.ok) {
      throw new AppError('INTERNAL_ERROR', 'Fournisseur d’embeddings : requête refusée', {
        status: response.status,
      });
    }

    const body = (await response.json()) as {
      data?: Array<{ embedding?: number[]; index?: number }>;
    };
    const vectors = (body.data ?? [])
      .slice()
      .sort((left, right) => (left.index ?? 0) - (right.index ?? 0))
      .map((item) => item.embedding);

    if (vectors.length !== texts.length || vectors.some((vector) => !Array.isArray(vector))) {
      throw new AppError('INTERNAL_ERROR', 'Fournisseur d’embeddings : réponse incomplète');
    }

    return vectors.map((vector) => {
      if (!vector || vector.length !== this.dimensions) {
        throw new AppError(
          'INTERNAL_ERROR',
          `Dimension inattendue (${vector?.length ?? 0} au lieu de ${this.dimensions})`,
        );
      }
      return vector;
    });
  }
}

export function createEmbeddingProvider(): EmbeddingProvider {
  if (env.AI_PROVIDER === 'local') {
    return new LocalEmbeddingProvider(env.EMBEDDING_DIMENSIONS);
  }
  if (!env.EMBEDDINGS_BASE_URL || !env.EMBEDDINGS_API_KEY) {
    throw new AppError(
      'INTERNAL_ERROR',
      'AI_PROVIDER=http exige EMBEDDINGS_BASE_URL et EMBEDDINGS_API_KEY',
    );
  }
  return new HttpEmbeddingProvider({
    baseUrl: env.EMBEDDINGS_BASE_URL,
    apiKey: env.EMBEDDINGS_API_KEY,
    model: env.EMBEDDINGS_MODEL,
    dimensions: env.EMBEDDING_DIMENSIONS,
  });
}
