#!/usr/bin/env node
// Parcours des services transverses : paiement (collecte mock, webhook signé,
// séquestre, libération, grand livre équilibré), abonnement et droits effectifs,
// fil de discussion filtré et notifications.
//
// Prérequis : PostgreSQL migré et seedé, Identity 3199, Gateway 3000,
// Payments 3015, Billing 3016, Messaging 3017 démarrés avec les mêmes clés et
// le même SERVICE_TOKEN.
// Usage : node tests/e2e/money-messaging.mjs
import { randomUUID } from 'node:crypto';
import process from 'node:process';

import {
  AICHA,
  ADMIN,
  BILLING,
  BORIS,
  GATEWAY,
  MESSAGING,
  PAYMENTS,
  SERVICE_TOKEN,
  call,
  check,
  login,
  passedCount,
  webhookSignature,
} from './helpers.mjs';

const internal = { 'x-service-token': SERVICE_TOKEN };

async function confirmPayment(paymentId, amount, status = 'successful') {
  const raw = JSON.stringify({ reference: paymentId, status, amount_fcfa: amount });
  return call(`${GATEWAY}/payments/webhooks/campay`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-campay-signature': webhookSignature(raw) },
    body: raw,
  });
}

async function createPayment({ token, objectType, objectId, amount }) {
  return call(`${GATEWAY}/payments`, {
    method: 'POST',
    headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
    body: JSON.stringify({
      object_type: objectType,
      object_id: objectId,
      amount_fcfa: amount,
      provider: 'mock',
      phone_msisdn: AICHA.whatsapp,
      idempotency_key: `e2e-${objectId}`,
    }),
  });
}

async function moneySection(token) {
  const orderId = randomUUID();
  const created = await createPayment({
    token,
    objectType: 'order',
    objectId: orderId,
    amount: 8000,
  });
  check(created.status === 201 || created.status === 200, 'paiement créé', created.body);
  const paymentId = created.body.id;
  check(created.body.status === 'pending', 'paiement en attente avant confirmation');

  const duplicate = await createPayment({
    token,
    objectType: 'order',
    objectId: orderId,
    amount: 8000,
  });
  check(duplicate.body.id === paymentId, 'clé d’idempotence : même paiement rejoué');

  const webhook = await confirmPayment(paymentId, 8000);
  check(webhook.status === 200 && webhook.body.status === 'escrow', 'webhook signé → séquestre');

  const replay = await confirmPayment(paymentId, 8000);
  check(replay.body.status === 'escrow', 'webhook rejoué : pas de double séquestre');

  const forged = await call(`${GATEWAY}/payments/webhooks/campay`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-campay-signature': 'faux' },
    body: '{}',
  });
  check(forged.status === 403, 'webhook mal signé refusé', forged.body);

  const released = await call(`${PAYMENTS}/internal/payments/${paymentId}/release`, {
    method: 'POST',
    headers: { ...internal, 'content-type': 'application/json' },
    body: JSON.stringify({ commission_fcfa: 640, net_fcfa: 7360 }),
  });
  check(
    released.status === 200 && released.body.status === 'released',
    'séquestre libéré',
    released.body,
  );

  const again = await call(`${PAYMENTS}/internal/payments/${paymentId}/release`, {
    method: 'POST',
    headers: { ...internal, 'content-type': 'application/json' },
    body: JSON.stringify({ commission_fcfa: 640, net_fcfa: 7360 }),
  });
  check(again.status === 409, 'double libération refusée', again.body);

  const wrongSplit = await call(`${PAYMENTS}/internal/payments/${paymentId}/refund`, {
    method: 'POST',
    headers: { ...internal, 'content-type': 'application/json' },
    body: '{}',
  });
  check(wrongSplit.status === 409, 'remboursement après libération refusé', wrongSplit.body);

  const balance = await call(`${PAYMENTS}/internal/ledger/balance`, { headers: internal });
  check(
    balance.status === 200 && balance.body.imbalance_fcfa === 0,
    'grand livre équilibré (débits = crédits)',
    balance.body,
  );

  const noToken = await call(`${PAYMENTS}/internal/ledger/balance`);
  check(noToken.status === 403, 'routes internes sans jeton → 403');

  const refundedId = randomUUID();
  const refundSource = await createPayment({
    token,
    objectType: 'date',
    objectId: refundedId,
    amount: 12000,
  });
  await confirmPayment(refundSource.body.id, 12000);
  const refunded = await call(`${PAYMENTS}/internal/payments/${refundSource.body.id}/refund`, {
    method: 'POST',
    headers: { ...internal, 'content-type': 'application/json' },
    body: JSON.stringify({ reason: 'annulation avant 3 h' }),
  });
  check(refunded.status === 200 && refunded.body.status === 'refunded', 'remboursement complet');

  const settled = await call(`${PAYMENTS}/internal/ledger/balance`, { headers: internal });
  check(settled.body.imbalance_fcfa === 0, 'grand livre encore équilibré après remboursement');
}

async function billingSection(token) {
  const plans = await call(`${GATEWAY}/billing/plans`);
  check(plans.status === 200 && plans.body.length >= 5, 'plans publics listés', plans.body.length);

  const free = await call(`${GATEWAY}/billing/subscriptions`, {
    method: 'POST',
    headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
    body: JSON.stringify({ plan_code: 'student_free' }),
  });
  check(free.status === 201 && free.body.status === 'active', 'plan gratuit actif immédiatement');

  const me = await call(`${GATEWAY}/billing/me`, { headers: { authorization: `Bearer ${token}` } });
  check(me.body.entitlements.commission_pct === 8, 'commission du plan gratuit = 8 %', me.body);

  const forbiddenPlan = await call(`${GATEWAY}/billing/subscriptions`, {
    method: 'POST',
    headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
    body: JSON.stringify({ plan_code: 'restaurant_standard' }),
  });
  check(forbiddenPlan.status === 403, 'plan d’une autre audience refusé', forbiddenPlan.body);

  const paid = await call(`${GATEWAY}/billing/subscriptions`, {
    method: 'POST',
    headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
    body: JSON.stringify({ plan_code: 'student_plus' }),
  });
  check(paid.body.status === 'pending', 'plan payant en attente de paiement');

  const subscriptionId = paid.body.id;
  const payment = await createPayment({
    token,
    objectType: 'subscription',
    objectId: subscriptionId,
    amount: 2000,
  });
  await confirmPayment(payment.body.id, 2000);

  const activated = await call(`${GATEWAY}/billing/subscriptions/${subscriptionId}/activate`, {
    method: 'POST',
    headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
    body: JSON.stringify({ payment_id: payment.body.id }),
  });
  check(
    activated.status === 200 && activated.body.status === 'active',
    'abonnement payant activé après séquestre',
    activated.body,
  );
  check(
    typeof activated.body.current_period_end === 'string',
    'fin de période calculée',
    activated.body.current_period_end,
  );

  const entitlements = await call(`${BILLING}/internal/entitlements/${AICHA.id}`, {
    headers: internal,
  });
  check(
    entitlements.status === 200 && entitlements.body.commission_pct === 6,
    'droits payants lus par les services (6 %)',
    entitlements.body,
  );

  const unknownPayment = await call(`${GATEWAY}/billing/subscriptions/${subscriptionId}/activate`, {
    method: 'POST',
    headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
    body: JSON.stringify({ payment_id: randomUUID() }),
  });
  check(unknownPayment.status !== 200, 'activation avec un paiement inconnu refusée');
}

async function messagingSection(token) {
  const mismatch = await call(`${MESSAGING}/internal/threads`, {
    method: 'POST',
    headers: { ...internal, 'content-type': 'application/json' },
    body: JSON.stringify({
      scope: 'match',
      object_id: randomUUID(),
      participant_ids: [AICHA.id, BORIS.id],
    }),
  });
  check(mismatch.status === 201 || mismatch.status === 200, 'fil créé par un domaine');

  const threadId = mismatch.body.id;
  check(
    mismatch.body.participants.includes(AICHA.id) && mismatch.body.participants.includes(BORIS.id),
    'les deux capitaines sont participants',
  );

  const auth = { authorization: `Bearer ${token}`, 'content-type': 'application/json' };
  const sent = await call(`${GATEWAY}/messaging/threads/${threadId}/messages`, {
    method: 'POST',
    headers: auth,
    body: JSON.stringify({ kind: 'text', body: 'On joue à 16h sur le terrain A ?' }),
  });
  check(sent.status === 201 || sent.status === 200, 'message texte accepté', sent.body);

  const blocked = await call(`${GATEWAY}/messaging/threads/${threadId}/messages`, {
    method: 'POST',
    headers: auth,
    body: JSON.stringify({ kind: 'text', body: 'mon num 655443312' }),
  });
  check(
    blocked.status === 422 && blocked.body.error.code === 'CHAT_DIGIT_BLOCKED',
    'numéro bloqué dans le fil',
    blocked.body,
  );

  const link = await call(`${GATEWAY}/messaging/threads/${threadId}/messages`, {
    method: 'POST',
    headers: auth,
    body: JSON.stringify({ kind: 'text', body: 'écris sur wa.me/237655443312' }),
  });
  check(
    link.status === 422 && link.body.error.code === 'CHAT_CONTACT_BLOCKED',
    'lien externe bloqué',
    link.body,
  );

  const card = await call(`${GATEWAY}/messaging/threads/${threadId}/messages`, {
    method: 'POST',
    headers: auth,
    body: JSON.stringify({ kind: 'card', card_type: 'SLOT_PROPOSE', payload: { slot_id: 'x' } }),
  });
  check(card.status === 201 || card.status === 200, 'carte à charge utile fermée acceptée');

  const messages = await call(`${GATEWAY}/messaging/threads/${threadId}/messages`, {
    headers: { authorization: `Bearer ${token}` },
  });
  check(messages.body.length === 3, 'message système + texte + carte', messages.body.length);

  const borisToken = await login(BORIS);
  const borisView = await call(`${GATEWAY}/messaging/threads/${threadId}/messages`, {
    headers: { authorization: `Bearer ${borisToken}` },
  });
  check(borisView.status === 200, 'participant ajouté par le domaine peut lire');

  const adminToken = await login(ADMIN);
  const stranger = await call(`${GATEWAY}/messaging/threads/${threadId}/messages`, {
    headers: { authorization: `Bearer ${adminToken}` },
  });
  check(stranger.status === 403, 'non-participant refusé', stranger.body);

  const notified = await call(`${MESSAGING}/internal/notifications`, {
    method: 'POST',
    headers: { ...internal, 'content-type': 'application/json' },
    body: JSON.stringify({
      user_id: AICHA.id,
      type: 'match.challenge.received',
      payload: { match_id: randomUUID() },
    }),
  });
  check(notified.status === 201 || notified.status === 200, 'notification interne créée');

  const notifications = await call(`${GATEWAY}/notifications`, {
    headers: { authorization: `Bearer ${token}` },
  });
  check(
    notifications.status === 200 && notifications.body.some((n) => !n.read),
    'notification non lue visible par son destinataire',
  );

  const read = await call(`${GATEWAY}/notifications/read`, {
    method: 'POST',
    headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
    body: '{}',
  });
  check(read.status === 200 && read.body.updated >= 1, 'notifications marquées lues', read.body);
}

async function main() {
  console.log('Parcours transverses — paiements, abonnements, messagerie');
  const token = await login(AICHA);
  await moneySection(token);
  await billingSection(token);
  await messagingSection(token);
  console.log(`\n${passedCount()} vérifications passées.`);
}

main().catch((error) => {
  console.error(`\n${error.message}`);
  process.exitCode = 1;
});
