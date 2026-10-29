/**
 * Jeton du bus de publication. Billing publie `entitlements.changed` à chaque
 * modification de droits ; le bus en mémoire sert au développement et aux tests,
 * l'outbox durable arrive avec l'infrastructure.
 */
export const BILLING_EVENT_BUS = 'BILLING_EVENT_BUS';

/** Horloge injectable : le balayage quotidien est testé au franc près. */
export const BILLING_CLOCK = Symbol('BILLING_CLOCK');
