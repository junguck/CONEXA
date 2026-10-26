import { createDb } from '@conexa/service-kit';

import { env } from './config.js';

/** Seules les tables du schéma `template` sont accessibles depuis ce service. */
export interface Database {
  template_items: {
    id: string;
    label: string;
    created_at: Date;
  };
}

const handle = createDb<Database>({
  connectionString: env.DATABASE_URL,
  schema: 'template',
});

export const db = handle.db;
export const pingDatabase = handle.ping;
