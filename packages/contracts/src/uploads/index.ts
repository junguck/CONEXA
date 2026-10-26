import { z } from 'zod';

/**
 * Uploads : fichiers envoyés par les étudiants et les équipes (photos de profil,
 * logos, preuves, portfolios). Contrats partagés (API.md §1, doc `uploads`).
 */

export const UPLOAD_PURPOSES = [
  'profile_photo',
  'team_logo',
  'listing_photo',
  'portfolio',
  'mission_evidence',
  'match_evidence',
  'date_receipt',
  'event_banner',
] as const;

export const UploadPurposeSchema = z.enum(UPLOAD_PURPOSES);
export type UploadPurpose = z.infer<typeof UploadPurposeSchema>;

export const UPLOAD_OBJECT_TYPES = [
  'profile',
  'team',
  'listing',
  'portfolio',
  'mission',
  'match',
  'date',
  'event',
  'report',
] as const;

export const UploadObjectTypeSchema = z.enum(UPLOAD_OBJECT_TYPES);
export type UploadObjectType = z.infer<typeof UploadObjectTypeSchema>;

export const UploadStatusSchema = z.enum(['pending', 'ready', 'deleted']);
export type UploadStatus = z.infer<typeof UploadStatusSchema>;

const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;
const DOCUMENT_TYPES = [...IMAGE_TYPES, 'application/pdf'] as const;

export interface UploadRule {
  /** Types MIME acceptés, jamais devinés depuis le nom du fichier. */
  contentTypes: readonly string[];
  maxBytes: number;
  /** Nombre maximum de fichiers rattachés au même objet de ce type. */
  maxPerObject: number;
}

/** Une règle par usage : le service et le client appliquent la même table. */
export const UPLOAD_RULES: Record<UploadPurpose, UploadRule> = {
  profile_photo: { contentTypes: IMAGE_TYPES, maxBytes: 5 * 1024 * 1024, maxPerObject: 1 },
  team_logo: { contentTypes: IMAGE_TYPES, maxBytes: 2 * 1024 * 1024, maxPerObject: 1 },
  listing_photo: { contentTypes: IMAGE_TYPES, maxBytes: 5 * 1024 * 1024, maxPerObject: 6 },
  portfolio: { contentTypes: DOCUMENT_TYPES, maxBytes: 10 * 1024 * 1024, maxPerObject: 12 },
  mission_evidence: { contentTypes: DOCUMENT_TYPES, maxBytes: 10 * 1024 * 1024, maxPerObject: 6 },
  match_evidence: { contentTypes: DOCUMENT_TYPES, maxBytes: 10 * 1024 * 1024, maxPerObject: 6 },
  date_receipt: { contentTypes: DOCUMENT_TYPES, maxBytes: 10 * 1024 * 1024, maxPerObject: 4 },
  event_banner: { contentTypes: IMAGE_TYPES, maxBytes: 5 * 1024 * 1024, maxPerObject: 1 },
};

export const CreateUploadSchema = z.object({
  purpose: UploadPurposeSchema,
  content_type: z.string().min(3).max(100),
  byte_size: z.number().int().positive(),
});
export type CreateUploadInput = z.infer<typeof CreateUploadSchema>;

export const AttachUploadSchema = z.object({
  object_type: UploadObjectTypeSchema,
  object_id: z.uuid(),
});
export type AttachUploadInput = z.infer<typeof AttachUploadSchema>;

export const UploadSchema = z.object({
  id: z.uuid(),
  owner_id: z.uuid(),
  purpose: UploadPurposeSchema,
  content_type: z.string().min(3),
  byte_size: z.number().int().nonnegative(),
  status: UploadStatusSchema,
  /** URL de lecture immuable une fois le fichier écrit (`status: ready`). */
  url: z.string().nullable(),
  created_at: z.iso.datetime(),
});
export type Upload = z.infer<typeof UploadSchema>;

export const AttachmentSchema = z.object({
  upload: UploadSchema,
  object_type: UploadObjectTypeSchema,
  object_id: z.uuid(),
  created_at: z.iso.datetime(),
});
export type Attachment = z.infer<typeof AttachmentSchema>;

/** Plafond quotidien par compte : évite qu'un seul étudiant remplisse le disque. */
export const DAILY_UPLOAD_QUOTA = 50;
