#!/usr/bin/env node
// Applique, dans l'ordre, les migrations db/migrations/<schema>/*.sql
// Usage : DATABASE_URL=postgres://... node tools/db-migrate.mjs <schema>
// Les migrations sont en sens avant uniquement : une migration appliquée ne se modifie jamais.
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

import { Client } from 'pg';

const schema = process.argv[2];

if (!schema || !/^[a-z][a-z0-9_]*$/.test(schema)) {
  console.error('Usage : node tools/db-migrate.mjs <schema> (ex. identity)');
  process.exit(1);
}

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  console.error('DATABASE_URL manquant. Voir .env.example.');
  process.exit(1);
}

const directory = path.join(process.cwd(), 'db', 'migrations', schema);
const files = (
  await readdir(directory).catch(() => {
    throw new Error(`Dossier de migrations introuvable : ${directory}`);
  })
)
  .filter((file) => file.endsWith('.sql'))
  .sort();

const client = new Client({ connectionString: databaseUrl });
await client.connect();

try {
  await client.query(`create schema if not exists ${schema}`);
  await client.query(`
    create table if not exists ${schema}._migrations (
      name text primary key,
      applied_at timestamptz not null default now()
    )
  `);

  const { rows } = await client.query(`select name from ${schema}._migrations`);
  const applied = new Set(rows.map((row) => row.name));
  let count = 0;

  for (const file of files) {
    if (applied.has(file)) {
      continue;
    }
    const sql = await readFile(path.join(directory, file), 'utf8');
    await client.query('begin');
    try {
      await client.query(`set local search_path to ${schema}`);
      await client.query(sql);
      await client.query(`insert into ${schema}._migrations (name) values ($1)`, [file]);
      await client.query('commit');
      count += 1;
      console.log(`appliquée  ${schema}/${file}`);
    } catch (error) {
      await client.query('rollback');
      console.error(`échec      ${schema}/${file}`);
      throw error;
    }
  }

  console.log(`${schema} : ${files.length} migration(s), ${count} appliquée(s)`);
} finally {
  await client.end();
}
