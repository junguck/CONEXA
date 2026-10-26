import { z } from 'zod';

import { AccountStatusSchema, IdSchema, RoleSchema } from '../common/identity.js';

/** Numéros camerounais uniquement, indicatif inclus (API.md §3.1). */
export const PhoneSchema = z.string().regex(/^\+237[6-9]\d{8}$/, 'Numéro au format +2376XXXXXXXX');

export const OtpRequestSchema = z.object({ whatsapp: PhoneSchema });
export const OtpVerifySchema = z.object({
  whatsapp: PhoneSchema,
  code: z.string().regex(/^\d{6}$/, 'Code à 6 chiffres'),
});

export const RegisterSchema = z.object({
  full_name: z.string().min(3).max(80),
  matricule: z.string().regex(/^[A-Z0-9]{6,20}$/, 'Matricule en majuscules et chiffres'),
  birth_date: z.iso.date(),
  gender: z.enum(['female', 'male', 'other']),
  filiere_id: z.coerce.number().int().positive(),
  study_level: z.coerce.number().int().min(1).max(7),
  photo_upload_id: IdSchema.optional(),
  consent: z.literal(true),
});

export const UpdateMeSchema = z.object({
  full_name: z.string().min(3).max(80).optional(),
  photo_upload_id: IdSchema.optional(),
  filiere_id: z.coerce.number().int().positive().optional(),
  study_level: z.coerce.number().int().min(1).max(7).optional(),
});

export const TokenPairSchema = z.object({
  access_token: z.string(),
  refresh_token: z.string(),
  expires_in: z.number().int().positive(),
  is_new_user: z.boolean(),
});

export const FiliereSchema = z.object({ id: z.number().int(), name: z.string() });

export const PublicUserSchema = z.object({
  id: IdSchema,
  full_name: z.string(),
  photo_url: z.string().nullable(),
  filiere: FiliereSchema.nullable(),
  study_level: z.number().int().nullable(),
  team: z.object({ id: IdSchema, name: z.string() }).nullable(),
  reliability_band: z.enum(['high', 'medium', 'low']),
});

export const MeSchema = PublicUserSchema.extend({
  birth_date: z.iso.date().nullable(),
  gender: z.enum(['female', 'male', 'other']).nullable(),
  status: AccountStatusSchema,
  role: RoleSchema,
  reliability: z.number().int(),
  whatsapp_masked: z.string(),
  dating_enabled: z.boolean(),
});

export const AdminDecisionSchema = z.object({ reason: z.string().max(500).optional() });

export const ReportSchema = z.object({
  target_type: z.enum(['user', 'team', 'match', 'post', 'message', 'date', 'service_order']),
  target_id: IdSchema,
  reason: z.string().min(3).max(120),
  details: z.string().max(1000).optional(),
});

export type TokenPair = z.infer<typeof TokenPairSchema>;
export type RegisterInput = z.infer<typeof RegisterSchema>;
export type Me = z.infer<typeof MeSchema>;
export type PublicUser = z.infer<typeof PublicUserSchema>;
export type ReportInput = z.infer<typeof ReportSchema>;
