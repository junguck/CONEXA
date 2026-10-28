/**
 * Jeton du bus de publication. Payments publie `payment.*` et `payout.*` sans
 * jamais dépendre du transport : le bus en mémoire sert au développement et aux
 * tests, l'outbox durable arrive avec l'infrastructure (packages/events).
 */
export const PAYMENT_EVENT_BUS = 'PAYMENTS_EVENT_BUS';
