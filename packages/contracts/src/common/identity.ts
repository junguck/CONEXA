import { z } from 'zod';
import { isoDateTimeSchema, uuidSchema } from './primitives.js';

/** Alias v1 (ADR 0007) de la primitive `uuidSchema`. */
export const IdSchema = uuidSchema;
export type Id = z.infer<typeof IdSchema>;

/**
 * Alias v1 de `isoDateTimeSchema`. v1 acceptait un décalage (`+01:00`) ;
 * le canonique exige UTC (`API.md` §1 « ISO 8601 UTC »), écart documenté
 * dans l'ADR 0007.
 */
export const IsoDateSchema = isoDateTimeSchema;
export type IsoDate = z.infer<typeof IsoDateSchema>;

/** Rôles portés par le JWT émis par Identity (RS256). */
export const ROLES = [
  'student',
  'captain',
  'restaurant_staff',
  'partner_staff',
  'moderator',
  'admin',
  'service',
] as const;

export const RoleSchema = z.enum(ROLES);
export type Role = z.infer<typeof RoleSchema>;

export const ACCOUNT_STATUSES = ['pending', 'active', 'suspended', 'banned'] as const;
export const AccountStatusSchema = z.enum(ACCOUNT_STATUSES);
export type AccountStatus = z.infer<typeof AccountStatusSchema>;

/** Contenu du JWT émis par Identity ; `sid` identifie la session révocable. */
export const JwtClaimsSchema = z.object({
  sub: IdSchema,
  roles: z.array(RoleSchema).default([]),
  status: AccountStatusSchema.default('active'),
  sid: z.string().min(8).optional(),
});

export type JwtClaims = z.infer<typeof JwtClaimsSchema>;
