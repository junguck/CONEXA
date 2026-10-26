import { createDb } from '@conexa/service-kit';
import type { ColumnType } from 'kysely';

import { env } from './config.js';

export interface EmbeddingsTable {
  id: string;
  owner_type: 'dating_profile' | 'talent_profile';
  owner_id: string;
  model: string;
  dimensions: number;
  /** `pgvector` absent en local : le vecteur tient dans un tableau JSON. */
  /** En écriture : JSON sérialisé (pg enverrait sinon un littéral de tableau). */
  vector: ColumnType<number[], string, string>;
  updated_at: ColumnType<Date, Date | undefined, Date>;
}

export interface Database {
  embeddings: EmbeddingsTable;
}

const handle = createDb<Database>({ connectionString: env.DATABASE_URL, schema: 'ai' });

export const db = handle.db;
export const pingDatabase = handle.ping;
