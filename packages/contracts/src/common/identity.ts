import { z } from 'zod';

export const IdSchema = z.uuid();
export type Id = z.infer<typeof IdSchema>;

export const IsoDateSchema = z.iso.datetime({ offset: true });
export type IsoDate = z.infer<typeof IsoDateSchema>;

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

/** Contenu du JWT émis par Identity (RS256). */
export const JwtClaimsSchema = z.object({
  sub: IdSchema,
  roles: z.array(RoleSchema).default([]),
  status: AccountStatusSchema.default('active'),
  sid: z.string().min(8).optional(),
});

export type JwtClaims = z.infer<typeof JwtClaimsSchema>;
