import { Kysely, PostgresDialect } from 'kysely';
import { Pool } from 'pg';

export interface DbHandle<DB> {
  /** Requêtes cantonnées au schéma du service : aucun accès croisé (ARCHITECTURE.md §1). */
  db: Kysely<DB>;
  ping: () => Promise<boolean>;
  destroy: () => Promise<void>;
}

export function createDb<DB>(options: {
  connectionString: string;
  schema: string;
  max?: number;
}): DbHandle<DB> {
  const pool = new Pool({
    connectionString: options.connectionString,
    max: options.max ?? 10,
    application_name: `conexa-${options.schema}`,
  });
  const root = new Kysely<DB>({ dialect: new PostgresDialect({ pool }) });

  return {
    db: root.withSchema(options.schema),
    ping: async () => {
      try {
        await pool.query('select 1');
        return true;
      } catch {
        return false;
      }
    },
    destroy: () => root.destroy(),
  };
}
