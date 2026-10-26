/* global fetch */
import { createHmac } from 'node:crypto';

import { Client } from 'pg';

export const GATEWAY = process.env.GATEWAY_URL ?? 'http://127.0.0.1:3000';
export const PAYMENTS = process.env.PAYMENTS_URL ?? 'http://127.0.0.1:3015';
export const BILLING = process.env.BILLING_URL ?? 'http://127.0.0.1:3016';
export const MESSAGING = process.env.MESSAGING_URL ?? 'http://127.0.0.1:3017';
export const SERVICE_TOKEN = process.env.SERVICE_TOKEN ?? '';
export const WEBHOOK_SECRET = process.env.PAYMENTS_WEBHOOK_SECRET ?? 'dev-webhook-secret-change-me';

export const AICHA = { id: 'a0000000-0000-4000-8000-000000000002', whatsapp: '+237655000002' };
export const BORIS = { id: 'a0000000-0000-4000-8000-000000000003', whatsapp: '+237655000003' };
export const ADMIN = { id: 'a0000000-0000-4000-8000-000000000001', whatsapp: '+237655000001' };

let passed = 0;

export function check(condition, label, extra) {
  if (!condition) {
    throw new Error(`Échec : ${label}${extra === undefined ? '' : ` — ${JSON.stringify(extra)}`}`);
  }
  passed += 1;
  console.log(`  ok  ${label}`);
}

export function passedCount() {
  return passed;
}

export async function call(url, options = {}) {
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

/** Code OTP connu : on écrit la ligne hachée comme le ferait Identity. */
async function seedOtp(whatsapp, code) {
  const secret = process.env.OTP_HASH_SECRET ?? 'dev-otp-secret-change-me';
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  try {
    const hash = createHmac('sha256', secret).update(code).digest('hex');
    await client.query(
      `insert into identity.otp_codes (whatsapp, code_hash, expires_at)
       values ($1, $2, now() + interval '5 minutes')`,
      [whatsapp, hash],
    );
  } finally {
    await client.end();
  }
}

/** Jeton d'un compte seedé, via la Gateway (OTP → JWT). */
export async function login(user, code = '424242') {
  await seedOtp(user.whatsapp, code);
  const verify = await call(`${GATEWAY}/auth/otp/verify`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ whatsapp: user.whatsapp, code }),
  });
  if (verify.status !== 200 || typeof verify.body?.access_token !== 'string') {
    throw new Error(`Connexion impossible : ${JSON.stringify(verify.body)}`);
  }
  return verify.body.access_token;
}

/** Signature du webhook : HMAC du corps brut, comme le fait l'agrégateur. */
export function webhookSignature(rawBody) {
  return createHmac('sha256', WEBHOOK_SECRET).update(rawBody).digest('hex');
}
