export * from './common/primitives.js';
export * from './common/error.js';
export * from './common/identity.js';
export * from './common/money.js';
export * from './common/pagination.js';
export * from './common/openapi.js';
export * from './openapi-document.js';

/*
 * Contrats de domaine (piste v1). Le canonique ne définit que les primitives
 * communes ; chaque service possède son dossier ici et l'exporte par ce baril,
 * qui reste donc le point d'entrée unique de `@conexa/contracts`.
 */
export * from './billing/index.js';
export * from './dating/index.js';
export * from './football/index.js';
export * from './identity/index.js';
export * from './marketplace/index.js';
export * from './messaging/index.js';
export * from './notifications/index.js';
export * from './ai/index.js';
export * from './partners/index.js';
export * from './payments/index.js';
export * from './talents/index.js';
export * from './uploads/index.js';
