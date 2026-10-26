import { z } from 'zod';

import { IdSchema, IsoDateSchema } from '../common/identity.js';
import { PageQuerySchema, pageSchema } from '../common/pagination.js';

export const SkillSchema = z.object({
  id: z.number().int().positive(),
  name: z.string(),
  category: z.string(),
});
export type Skill = z.infer<typeof SkillSchema>;

export const SKILL_LEVELS = [1, 2, 3, 4, 5] as const;

export const UserSkillSchema = z.object({
  skill_id: z.number().int().positive(),
  level: z.number().int().min(1).max(5),
  proof_url: z.string().url().optional(),
});
export type UserSkill = z.infer<typeof UserSkillSchema>;

export const PutSkillsSchema = z.object({
  skills: z.array(UserSkillSchema).max(20),
  bio: z.string().trim().max(500).optional(),
});
export type PutSkillsInput = z.infer<typeof PutSkillsSchema>;

export const POST_KINDS = [
  'need',
  'project',
  'competition',
  'service_offer',
  'help_request',
] as const;
export const PostKindSchema = z.enum(POST_KINDS);
export type PostKind = z.infer<typeof PostKindSchema>;

export const POST_STATUSES = ['open', 'closed', 'deleted'] as const;
export const PostStatusSchema = z.enum(POST_STATUSES);
export type PostStatus = z.infer<typeof PostStatusSchema>;

export const PostSchema = z.object({
  id: IdSchema,
  author_id: IdSchema,
  kind: PostKindSchema,
  title: z.string(),
  description: z.string(),
  budget_fcfa: z.number().int().nonnegative().nullable(),
  skill_ids: z.array(z.number().int().positive()),
  status: PostStatusSchema,
  boosted: z.boolean(),
  created_at: IsoDateSchema,
});
export type Post = z.infer<typeof PostSchema>;

export const PostPageSchema = pageSchema(PostSchema);

export const CreatePostSchema = z.object({
  kind: PostKindSchema,
  title: z.string().trim().min(5).max(120),
  description: z.string().trim().min(20).max(2000),
  budget_fcfa: z.number().int().min(0).max(10_000_000).optional(),
  skill_ids: z.array(z.number().int().positive()).max(8).default([]),
});
export type CreatePostInput = z.infer<typeof CreatePostSchema>;

export const UpdatePostSchema = z
  .object({
    title: z.string().trim().min(5).max(120).optional(),
    description: z.string().trim().min(20).max(2000).optional(),
    budget_fcfa: z.number().int().min(0).max(10_000_000).nullable().optional(),
    skill_ids: z.array(z.number().int().positive()).max(8).optional(),
  })
  .refine((value) => Object.keys(value).length > 0, { message: 'Aucun champ à modifier' });

export const PostSearchSchema = PageQuerySchema.extend({
  kind: PostKindSchema.optional(),
  skill_id: z.coerce.number().int().positive().optional(),
  q: z.string().trim().min(1).max(80).optional(),
  mine: z
    .enum(['true', 'false'])
    .transform((value) => value === 'true')
    .optional(),
  status: PostStatusSchema.default('open'),
});

export const APPLY_MESSAGE_MAX = 600;

export const ApplySchema = z.object({
  message: z.string().trim().max(APPLY_MESSAGE_MAX).optional(),
});

export const APPLICATION_STATUSES = ['pending', 'accepted', 'declined', 'withdrawn'] as const;
export const ApplicationStatusSchema = z.enum(APPLICATION_STATUSES);
export type ApplicationStatus = z.infer<typeof ApplicationStatusSchema>;

export const ApplicationSchema = z.object({
  id: IdSchema,
  post_id: IdSchema,
  applicant_id: IdSchema,
  message: z.string().nullable(),
  status: ApplicationStatusSchema,
  created_at: IsoDateSchema,
});
export type Application = z.infer<typeof ApplicationSchema>;

export const BoostSchema = z.object({
  days: z.union([z.literal(3), z.literal(7)]),
  provider: z.enum(['mtn_momo', 'orange_money']),
  phone_msisdn: z.string().min(9).max(15),
});

export const MISSION_STATUSES = [
  'proposed',
  'accepted',
  'funded',
  'delivered',
  'approved',
  'disputed',
  'cancelled',
] as const;
export const MissionStatusSchema = z.enum(MISSION_STATUSES);
export type MissionStatus = z.infer<typeof MissionStatusSchema>;

export const MissionSchema = z.object({
  id: IdSchema,
  post_id: IdSchema,
  client_id: IdSchema,
  provider_id: IdSchema,
  amount_fcfa: z.number().int().positive(),
  commission_fcfa: z.number().int().nonnegative(),
  provider_net_fcfa: z.number().int().nonnegative(),
  deadline_at: IsoDateSchema.nullable(),
  status: MissionStatusSchema,
  payment_id: z.string().nullable(),
  created_at: IsoDateSchema,
});
export type Mission = z.infer<typeof MissionSchema>;

export const CreateMissionSchema = z.object({
  post_id: IdSchema,
  provider_id: IdSchema,
  amount_fcfa: z.number().int().min(500).max(10_000_000),
  deadline_at: IsoDateSchema.optional(),
});

export const FundMissionSchema = z.object({
  provider: z.enum(['mtn_momo', 'orange_money']),
  phone_msisdn: z.string().min(9).max(15),
});

export const DeliverSchema = z.object({
  note: z.string().trim().max(1000).optional(),
  file_upload_ids: z.array(IdSchema).max(10).default([]),
});

export const DisputeSchema = z.object({ reason: z.string().trim().min(10).max(1000) });

export const CreateReviewSchema = z.object({
  mission_id: IdSchema,
  rating: z.number().int().min(1).max(5),
  comment: z.string().trim().max(600).optional(),
});
export type CreateReviewInput = z.infer<typeof CreateReviewSchema>;

export const ReviewSchema = z.object({
  id: IdSchema,
  mission_id: IdSchema,
  author_id: IdSchema,
  target_id: IdSchema,
  rating: z.number().int().min(1).max(5),
  comment: z.string().nullable(),
  created_at: IsoDateSchema,
});
export type Review = z.infer<typeof ReviewSchema>;

export const EVENT_STATUSES = ['draft', 'published', 'cancelled', 'finished'] as const;
export const EventStatusSchema = z.enum(EVENT_STATUSES);

export const EventSchema = z.object({
  id: IdSchema,
  organizer_id: IdSchema,
  title: z.string(),
  description: z.string().nullable(),
  place: z.string(),
  starts_at: IsoDateSchema,
  price_fcfa: z.number().int().nonnegative(),
  capacity: z.number().int().positive().nullable(),
  sponsor_name: z.string().nullable(),
  status: EventStatusSchema,
  registered: z.number().int().nonnegative(),
});
export type Event = z.infer<typeof EventSchema>;

export const CreateEventSchema = z.object({
  title: z.string().trim().min(5).max(140),
  description: z.string().trim().max(2000).optional(),
  place: z.string().trim().min(3).max(200),
  starts_at: IsoDateSchema,
  price_fcfa: z.number().int().min(0).max(5_000_000).default(0),
  capacity: z.number().int().min(1).max(5000).optional(),
  sponsor_name: z.string().trim().max(120).optional(),
});

export const TicketSchema = z.object({
  provider: z.enum(['mtn_momo', 'orange_money']),
  phone_msisdn: z.string().min(9).max(15),
});

export const CheckinAttendanceSchema = z.object({ user_id: IdSchema });

export const MeetupSchema = z.object({
  invitee_id: IdSchema,
  post_id: IdSchema.optional(),
  place: z.string().trim().min(3).max(200),
  starts_at: IsoDateSchema,
});

export type PostSearchQuery = z.infer<typeof PostSearchSchema>;
export type UpdatePostInput = z.infer<typeof UpdatePostSchema>;
