#!/usr/bin/env node
/* global fetch */
// Parcours de bout en bout de la v1 : OTP → JWT → Gateway → services, plus
// l'upload binaire et la route interne de contact d'Identity.
//
// Prérequis : PostgreSQL migré et seedé, Identity (3001), Gateway (3000),
// Football (3002) et Uploads (3006) démarrés avec les mêmes clés JWT.
// Usage : node tests/e2e/v1-smoke.mjs
import { createHmac, randomUUID } from 'node:crypto';
import process from 'node:process';

import { Client } from 'pg';

const GATEWAY = process.env.GATEWAY_URL ?? 'http://127.0.0.1:3000';
const IDENTITY = process.env.IDENTITY_URL ?? 'http://127.0.0.1:3001';
const OTP_SECRET = process.env.OTP_HASH_SECRET ?? 'dev-otp-secret-change-me';
const SERVICE_TOKEN = process.env.SERVICE_TOKEN ?? '';
const DATABASE_URL = process.env.DATABASE_URL ?? '';

const AICHA = { id: 'a0000000-0000-4000-8000-000000000002', whatsapp: '+237655000002' };
const BORIS = { id: 'a0000000-0000-4000-8000-000000000003', whatsapp: '+237655000003' };
const TEAM_ID = 'b0000000-0000-4000-8000-000000000001';

const PNG = Buffer.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52,
  0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01, 0x08, 0x06, 0x00, 0x00, 0x00, 0x1f, 0x15, 0xc4,
  0x89,
]);

let passed = 0;

function check(condition, label, extra) {
  if (!condition) {
    throw new Error(`Échec : ${label}${extra === undefined ? '' : ` — ${JSON.stringify(extra)}`}`);
  }
  passed += 1;
  console.log(`  ok  ${label}`);
}

async function call(url, options = {}) {
  const response = await fetch(url, options);
  const text = await response.text();
  let body;
  try {
    body = text.length === 0 ? null : JSON.parse(text);
  } catch {
    body = text;
  }
  return { status: response.status, body, headers: response.headers };
}

/** Code OTP connu : on écrit nous-mêmes la ligne hachée, comme le ferait Identity. */
async function seedOtp(whatsapp, code) {
  if (!DATABASE_URL) {
    throw new Error('DATABASE_URL requis pour préparer le code OTP du test');
  }
  const client = new Client({ connectionString: DATABASE_URL });
  await client.connect();
  try {
    const hash = createHmac('sha256', OTP_SECRET).update(code).digest('hex');
    await client.query(
      `insert into identity.otp_codes (whatsapp, code_hash, expires_at)
       values ($1, $2, now() + interval '5 minutes')`,
      [whatsapp, hash],
    );
  } finally {
    await client.end();
  }
}

async function main() {
  console.log('Parcours v1 — OTP, Gateway, Football, Uploads, contact interne');

  await seedOtp(AICHA.whatsapp, '424242');

  const verify = await call(`${GATEWAY}/auth/otp/verify`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ whatsapp: AICHA.whatsapp, code: '424242' }),
  });
  check(verify.status === 200, 'OTP vérifié via la Gateway', verify.body);
  check(typeof verify.body?.access_token === 'string', 'jeton d’accès émis');
  const token = verify.body.access_token;
  const auth = { authorization: `Bearer ${token}` };

  const me = await call(`${GATEWAY}/me`, { headers: auth });
  check(me.status === 200 && me.body.id === AICHA.id, 'GET /me renvoie le bon compte', me.body);
  check(me.body.status === 'active', 'compte seedé actif');

  const anonymous = await call(`${GATEWAY}/me`);
  check(
    anonymous.status === 401 && anonymous.body?.error?.code === 'UNAUTHENTICATED',
    'route protégée sans jeton → 401 UNAUTHENTICATED',
    anonymous.body,
  );

  const teams = await call(`${GATEWAY}/football/teams`, { headers: auth });
  check(teams.status === 200, 'Football répond à travers la Gateway', teams.body);
  check(
    JSON.stringify(teams.body).includes(TEAM_ID),
    'l’équipe seedée est visible dans la liste',
    teams.body,
  );

  const created = await call(`${GATEWAY}/uploads`, {
    method: 'POST',
    headers: { ...auth, 'content-type': 'application/json' },
    body: JSON.stringify({
      purpose: 'profile_photo',
      content_type: 'image/png',
      byte_size: PNG.length,
    }),
  });
  check(
    created.status === 201 || created.status === 200,
    'emplacement d’upload créé',
    created.body,
  );
  const uploadId = created.body?.id;
  check(typeof uploadId === 'string', 'identifiant de fichier renvoyé');

  const written = await call(`${GATEWAY}/uploads/${uploadId}/content`, {
    method: 'PUT',
    headers: { ...auth, 'content-type': 'image/png' },
    body: PNG,
  });
  check(written.status === 200 && written.body.status === 'ready', 'contenu écrit', written.body);

  const read = await call(`${GATEWAY}/uploads/${uploadId}/content`);
  check(read.status === 200, 'contenu lisible sans jeton (URL non devinable)');
  check(
    read.headers.get('content-type') === 'image/png',
    'type MIME servi correctement',
    read.headers.get('content-type'),
  );

  // Objet de galerie neuf : le test reste rejouable (une photo de profil active
  // est déjà rattachée par une exécution précédente).
  const galleryId = randomUUID();
  const attached = await call(`${GATEWAY}/uploads/${uploadId}/attach`, {
    method: 'POST',
    headers: { ...auth, 'content-type': 'application/json' },
    body: JSON.stringify({ object_type: 'portfolio', object_id: galleryId }),
  });
  check(attached.status === 200, 'fichier rattaché au profil', attached.body);

  const files = await call(`${GATEWAY}/files?object_type=portfolio&object_id=${galleryId}`, {
    headers: auth,
  });
  check(
    files.status === 200 && files.body.length === 1 && files.body[0].id === uploadId,
    'la galerie de l’objet liste le fichier',
    files.body,
  );

  const contact = await call(`${IDENTITY}/internal/users/${BORIS.id}/contact`, {
    headers: { 'x-service-token': SERVICE_TOKEN },
  });
  check(
    contact.status === 200 && contact.body.whatsapp === BORIS.whatsapp,
    'Identity rend le contact au service porteur du jeton',
    contact.body,
  );

  const contactDenied = await call(`${IDENTITY}/internal/users/${BORIS.id}/contact`);
  check(contactDenied.status === 403, 'contact interne sans jeton → 403', contactDenied.body);

  const contactViaGateway = await call(`${GATEWAY}/internal/users/${BORIS.id}/contact`, {
    headers: { 'x-service-token': SERVICE_TOKEN },
  });
  check(
    contactViaGateway.status === 403,
    'Gateway bloque /internal même avec le jeton de service',
    contactViaGateway.body,
  );

  const tooBig = await call(`${GATEWAY}/uploads`, {
    method: 'POST',
    headers: { ...auth, 'content-type': 'application/json' },
    body: JSON.stringify({
      purpose: 'team_logo',
      content_type: 'image/png',
      byte_size: 3 * 1024 * 1024,
    }),
  });
  check(
    tooBig.status === 413 && tooBig.body?.error?.code === 'UPLOAD_TOO_LARGE',
    'déclaration trop lourde refusée avant stockage',
    tooBig.body,
  );

  console.log(`\n${passed} vérifications passées.`);
}

main().catch((error) => {
  console.error(`\n${error.message}`);
  process.exitCode = 1;
});
