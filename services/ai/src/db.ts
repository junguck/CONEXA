import { createDb } from '@conexa/service-kit';
import type { ColumnType } from 'kysely';

import { env } from './config.js';

export interface EmbeddingsTable {
  id: string;
  owner_type: 'dating_profile' | 'talent_profile';
  owner_id: string;
  model: string;
  dimensions: number;
  /**
   * Colonne `vector` de `pgvector` : un littéral `[0.1,-0.2]` en base, rendu
   * par `pg` sous forme de chaîne. `formatVector` / `parseVector` font
   * l'aller-retour avec `number[]`.
   */
  vector: ColumnType<string, string, string>;
  updated_at: ColumnType<Date, Date | undefined, Date>;
}

export interface Database {
  embeddings: EmbeddingsTable;
}

const handle = createDb<Database>({ connectionString: env.DATABASE_URL, schema: 'ai' });

export const db = handle.db;
export const pingDatabase = handle.ping;
