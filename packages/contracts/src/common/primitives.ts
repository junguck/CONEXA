import { z } from 'zod';

/** Identifiant UUID — `docs/product/API.md` §1 « Conventions ». */
export const uuidSchema = z.uuid();

/** Horodatage ISO 8601 UTC (`2026-11-03T15:30:00Z`), affiché en Africa/Douala. */
export const isoDateTimeSchema = z.iso.datetime();

/** Date civile `AAAA-MM-JJ` (semaine des picks, période d'un abonnement). */
export const dateOnlySchema = z.iso.date();

/** Montant en FCFA **entier** : `amount_fcfa: 8000`, jamais de décimales. */
export const amountFcfaSchema = z.int().min(0);

/** Montant strictement positif (prix, facture, séquestre). */
export const positiveAmountFcfaSchema = z.int().positive();

/** Curseur opaque de pagination : le client le renvoie tel quel. */
export const cursorSchema = z.string().min(1);

/** `?limit=20` : 20 par défaut, 100 au maximum (garde-fou de charge). */
export const pageLimitSchema = z.coerce.number().int().min(1).max(100).default(20);
