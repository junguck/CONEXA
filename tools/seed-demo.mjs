#!/usr/bin/env node
// Données de démonstration pour un environnement local : quelques étudiants
// validés, une équipe de football, une offre de service et leurs pièces.
// Idempotent : les identifiants sont fixes, on peut le relancer sans doublon.
//
// Usage : DATABASE_URL=postgres://... node tools/seed-demo.mjs
import process from 'node:process';

import { Client } from 'pg';

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  console.error('DATABASE_URL manquant. Voir .env.example.');
  process.exit(1);
}

/** Comptes de démonstration, joignables avec le code OTP de 000000 en dev. */
export const DEMO_USERS = {
  admin: {
    id: 'a0000000-0000-4000-8000-000000000001',
    whatsapp: '+237655000001',
    full_name: 'Admin Convexa',
    role: 'admin',
    matricule: 'ADM2026001',
  },
  aicha: {
    id: 'a0000000-0000-4000-8000-000000000002',
    whatsapp: '+237655000002',
    full_name: 'Aïcha N.',
    role: 'student',
    matricule: 'ETU2026002',
  },
  boris: {
    id: 'a0000000-0000-4000-8000-000000000003',
    whatsapp: '+237655000003',
    full_name: 'Boris M.',
    role: 'student',
    matricule: 'ETU2026003',
  },
};

const TEAM_ID = 'b0000000-0000-4000-8000-000000000001';
const LISTING_ID = 'c0000000-0000-4000-8000-000000000001';

const client = new Client({ connectionString: databaseUrl });
await client.connect();

try {
  await client.query('begin');

  // Identity : trois comptes actifs, une filière chacun.
  const filiere = await client.query(
    `insert into identity.filieres (name) values ('Génie logiciel')
     on conflict (name) do update set name = excluded.name returning id`,
  );
  const filiereId = filiere.rows[0].id;

  for (const user of Object.values(DEMO_USERS)) {
    await client.query(
      `insert into identity.profiles
         (id, whatsapp, full_name, matricule, birth_date, gender, filiere_id, study_level,
          status, role, reliability, consent_at)
       values ($1, $2, $3, $4, '2003-04-12', 'female', $5, 2, 'active', $6, 100, now())
       on conflict (id) do update set
         status = 'active',
         role = excluded.role,
         full_name = excluded.full_name,
         filiere_id = excluded.filiere_id`,
      [user.id, user.whatsapp, user.full_name, user.matricule, filiereId, user.role],
    );
  }

  // Football : un terrain, l'équipe d'Aïcha, Boris coéquipier.
  await client.query(
    `insert into football.fields (id, name, location)
     values ('d0000000-0000-4000-8000-000000000001', 'Terrain A', 'Campus principal')
     on conflict (id) do nothing`,
  );

  await client.query(
    `insert into football.teams (id, name, filiere_id, captain_id)
     values ($1, 'Les Lions du Campus', $2, $3)
     on conflict (id) do nothing`,
    [TEAM_ID, filiereId, DEMO_USERS.aicha.id],
  );

  for (const [userId, role] of [
    [DEMO_USERS.aicha.id, 'captain'],
    [DEMO_USERS.boris.id, 'player'],
  ]) {
    await client.query(
      `insert into football.team_members (team_id, user_id, role)
       values ($1, $2, $3)
       on conflict (team_id, user_id) do nothing`,
      [TEAM_ID, userId, role],
    );
  }

  // Marketplace : une offre active de Boris, une formule standard.
  const category = await client.query(
    `select id from marketplace.service_categories where slug = 'design' limit 1`,
  );
  if (category.rowCount === 0) {
    throw new Error('Catégorie marketplace « design » absente : migration non appliquée ?');
  }

  await client.query(
    `insert into marketplace.service_listings
       (id, owner_id, category_id, title, description, delivery_mode, status)
     values ($1, $2, $3, 'Logo et charte pour association',
             'Création d’un logo, d’une palette et d’un modèle de publication pour une association étudiante.',
             'online', 'active')
     on conflict (id) do nothing`,
    [LISTING_ID, DEMO_USERS.boris.id, category.rows[0].id],
  );

  await client.query(
    `insert into marketplace.listing_packages
       (listing_id, tier, name, description, price_fcfa, delivery_days, revisions)
     values ($1, 'standard', 'Formule standard', 'Logo + palette + un modèle', 15000, 7, 2)
     on conflict (listing_id, tier) do nothing`,
    [LISTING_ID],
  );

  await client.query('commit');
  console.log('Seed de démonstration appliqué :');
  for (const user of Object.values(DEMO_USERS)) {
    console.log(`  ${user.role.padEnd(7)} ${user.whatsapp}  ${user.full_name}`);
  }
  console.log(`  équipe   ${TEAM_ID}`);
  console.log(`  offre    ${LISTING_ID}`);
} catch (error) {
  await client.query('rollback');
  console.error('Échec du seed :', error.message);
  process.exitCode = 1;
} finally {
  await client.end();
}
