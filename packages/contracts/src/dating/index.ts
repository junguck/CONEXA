import { z } from 'zod';

import { IdSchema, IsoDateSchema } from '../common/identity.js';

export const MIN_AGE = 18;
export const PICKS_PER_WEEK = 3;
export const INVITES_PER_WEEK = 3;
export const RELIABILITY_MIN = 60;

export const ELIGIBILITY_REASONS = [
  'AGE_RESTRICTED',
  'QUESTIONNAIRE_MISSING',
  'RELIABILITY_TOO_LOW',
] as const;
export const EligibilityReasonSchema = z.enum(ELIGIBILITY_REASONS);
export type EligibilityReason = z.infer<typeof EligibilityReasonSchema>;

export const EligibilitySchema = z.object({
  eligible: z.boolean(),
  reasons: z.array(EligibilityReasonSchema),
});
export type Eligibility = z.infer<typeof EligibilitySchema>;

export const GENDERS = ['female', 'male', 'other'] as const;
export const GenderSchema = z.enum(GENDERS);
export type Gender = z.infer<typeof GenderSchema>;

export const QUESTIONNAIRE_VERSION = 1;

export interface QuestionnaireQuestion {
  key: string;
  label: string;
  kind: 'choice' | 'scale';
  options?: string[];
}

export interface QuestionnaireBlock {
  key: 'values' | 'personality' | 'lifestyle';
  questions: QuestionnaireQuestion[];
}

/** Questionnaire v1 : réponses fermées, jamais de texte libre (donc jamais exposé). */
export const QUESTIONNAIRE_BLOCKS: QuestionnaireBlock[] = [
  {
    key: 'values',
    questions: [
      {
        key: 'values_priority',
        label: 'Ce qui compte le plus pour toi',
        kind: 'choice',
        options: ['famille', 'études', 'amitié', 'foi', 'carrière'],
      },
      {
        key: 'values_conflict',
        label: 'Face à un désaccord',
        kind: 'choice',
        options: ['j’en parle tout de suite', 'je prends du temps', 'je laisse tomber'],
      },
      {
        key: 'values_weekend',
        label: 'Ton week-end idéal',
        kind: 'choice',
        options: ['sortie entre amis', 'calme à la maison', 'sport', 'culture'],
      },
      {
        key: 'values_trust',
        label: 'La confiance se gagne',
        kind: 'scale',
      },
    ],
  },
  {
    key: 'personality',
    questions: [
      {
        key: 'personality_energy',
        label: 'Tu te ressource',
        kind: 'choice',
        options: ['seul', 'avec quelques proches', 'dans un groupe'],
      },
      {
        key: 'personality_humour',
        label: 'Ton humour',
        kind: 'choice',
        options: ['pince-sans-rire', 'jeux de mots', 'taquin', 'discret'],
      },
      {
        key: 'personality_speaking',
        label: 'Tu parles de toi',
        kind: 'scale',
      },
      {
        key: 'personality_spontaneity',
        label: 'Tu décides',
        kind: 'scale',
      },
    ],
  },
  {
    key: 'lifestyle',
    questions: [
      {
        key: 'lifestyle_rhythm',
        label: 'Ton rythme',
        kind: 'choice',
        options: ['lève-tôt', 'nocturne', 'variable'],
      },
      {
        key: 'lifestyle_study',
        label: 'Tes soirées',
        kind: 'choice',
        options: ['révisions', 'sport', 'sorties', 'associatif'],
      },
      {
        key: 'lifestyle_budget',
        label: 'Ton budget sortie',
        kind: 'scale',
      },
      {
        key: 'lifestyle_smoking',
        label: 'Tabac',
        kind: 'choice',
        options: ['jamais', 'occasionnel', 'régulier'],
      },
    ],
  },
];

export const QUESTION_KEYS = QUESTIONNAIRE_BLOCKS.flatMap((block) =>
  block.questions.map((question) => question.key),
);

export const AnswersSchema = z.record(
  z.string(),
  z.union([z.string().max(40), z.number().int().min(1).max(5)]),
);
export type Answers = z.infer<typeof AnswersSchema>;

export const DatingProfileSchema = z.object({
  questionnaire_v: z.number().int().positive(),
  answers: z.record(z.string(), z.union([z.string(), z.number()])),
  seeking: z.array(GenderSchema).min(1).max(3),
  age_min: z.number().int().min(MIN_AGE).max(99),
  age_max: z.number().int().min(MIN_AGE).max(99),
  paused: z.boolean(),
});
export type DatingProfile = z.infer<typeof DatingProfileSchema>;

export const PutDatingProfileSchema = z
  .object({
    birth_date: z.iso.date(),
    questionnaire_v: z.number().int().positive(),
    answers: AnswersSchema,
    seeking: z.array(GenderSchema).min(1).max(3),
    age_min: z.number().int().min(MIN_AGE).max(99),
    age_max: z.number().int().min(MIN_AGE).max(99),
  })
  .refine((value) => value.age_min <= value.age_max, {
    message: 'age_min doit être inférieur ou égal à age_max',
    path: ['age_min'],
  });
export type PutDatingProfileInput = z.infer<typeof PutDatingProfileSchema>;

export const PatchPreferencesSchema = z
  .object({
    seeking: z.array(GenderSchema).min(1).max(3).optional(),
    age_min: z.number().int().min(MIN_AGE).max(99).optional(),
    age_max: z.number().int().min(MIN_AGE).max(99).optional(),
  })
  .refine((value) => Object.keys(value).length > 0, { message: 'Aucun champ à modifier' });

export const WeeklyQuotaSchema = z.object({
  week_start: z.iso.date(),
  invites_left: z.number().int().nonnegative(),
  picks_left: z.number().int().nonnegative(),
});
export type WeeklyQuota = z.infer<typeof WeeklyQuotaSchema>;

export const PICK_KINDS = ['similar', 'complementary'] as const;
export const PickKindSchema = z.enum(PICK_KINDS);
export type PickKind = z.infer<typeof PickKindSchema>;

export const PICK_DECISIONS = ['none', 'invited', 'passed'] as const;
export const PickDecisionSchema = z.enum(PICK_DECISIONS);
export type PickDecision = z.infer<typeof PickDecisionSchema>;

export const DatingPickSchema = z.object({
  id: IdSchema,
  candidate_id: IdSchema,
  kind: PickKindSchema,
  compat_label: z.string(),
  decision: PickDecisionSchema,
  week_start: z.iso.date(),
});
export type DatingPick = z.infer<typeof DatingPickSchema>;

export const INVITE_STATUSES = ['pending', 'accepted', 'declined', 'withdrawn', 'expired'] as const;
export const InviteStatusSchema = z.enum(INVITE_STATUSES);
export type InviteStatus = z.infer<typeof InviteStatusSchema>;

export const DatingInviteSchema = z.object({
  id: IdSchema,
  from_user_id: IdSchema,
  to_user_id: IdSchema,
  status: InviteStatusSchema,
  week_start: z.iso.date(),
  created_at: IsoDateSchema,
});
export type DatingInvite = z.infer<typeof DatingInviteSchema>;

export const DATE_STATUSES = [
  'negotiating',
  'awaiting_payment',
  'confirmed',
  'checked_in',
  'completed',
  'cancelled',
  'no_show',
  'disputed',
] as const;
export const DateStatusSchema = z.enum(DATE_STATUSES);
export type DateStatus = z.infer<typeof DateStatusSchema>;

export const DATE_COMMISSION_PCT = 10;
export const CANCEL_WINDOW_HOURS = 3;

export const DatingDateSchema = z.object({
  id: IdSchema,
  status: DateStatusSchema,
  partner_id: IdSchema,
  payer_id: IdSchema,
  i_am_payer: z.boolean(),
  restaurant_id: IdSchema.nullable(),
  slot_id: IdSchema.nullable(),
  formula_id: IdSchema.nullable(),
  total_fcfa: z.number().int().nonnegative(),
  commission_fcfa: z.number().int().nonnegative(),
  table_label: z.string().nullable(),
  cancellable_until: IsoDateSchema.nullable(),
  can_cancel: z.boolean(),
  contact_revealed: z.boolean(),
});
export type DatingDate = z.infer<typeof DatingDateSchema>;

export const CARD_TYPES = [
  'SLOT_PROPOSE',
  'SLOT_ACCEPT',
  'SLOT_DECLINE',
  'FORMULA_SELECT',
  'ORDER_DONE',
  'ARRIVE_EARLY',
  'SHY',
  'LATE_5',
  'LATE_10',
  'LATE_15',
  'READY',
  'CONFIRM_YES',
  'CONFIRM_NO',
  'THANKS',
] as const;
export const CardTypeSchema = z.enum(CARD_TYPES);
export type CardType = z.infer<typeof CardTypeSchema>;

/** Aucun texte libre : chaque carte a une charge utile fermée. */
export const CardPayloadSchema = z.union([
  z.object({ slot_id: IdSchema }),
  z.object({ formula_id: IdSchema }),
  z.object({ order_id: IdSchema }),
  z.object({}).strict(),
]);

export const SendCardSchema = z.object({
  card_type: CardTypeSchema,
  payload: CardPayloadSchema.optional(),
});
export type SendCardInput = z.infer<typeof SendCardSchema>;

export const DateCardSchema = z.object({
  id: IdSchema,
  sender_id: IdSchema,
  card_type: CardTypeSchema,
  payload: z.record(z.string(), z.unknown()),
  created_at: IsoDateSchema,
});
export type DateCard = z.infer<typeof DateCardSchema>;

export const CARD_CATALOG = [
  { card_type: 'SLOT_PROPOSE', label_fr: 'Proposer un créneau', expects_payload: true },
  { card_type: 'SLOT_ACCEPT', label_fr: 'Accepter le créneau', expects_payload: true },
  { card_type: 'SLOT_DECLINE', label_fr: 'Refuser le créneau', expects_payload: true },
  { card_type: 'FORMULA_SELECT', label_fr: 'Choisir une formule', expects_payload: true },
  { card_type: 'ORDER_DONE', label_fr: 'Commande prête', expects_payload: true },
  { card_type: 'ARRIVE_EARLY', label_fr: 'J’arrive en avance', expects_payload: false },
  { card_type: 'SHY', label_fr: 'Un peu timide', expects_payload: false },
  { card_type: 'LATE_5', label_fr: '5 minutes de retard', expects_payload: false },
  { card_type: 'LATE_10', label_fr: '10 minutes de retard', expects_payload: false },
  { card_type: 'LATE_15', label_fr: '15 minutes de retard', expects_payload: false },
  { card_type: 'READY', label_fr: 'Je suis prêt(e)', expects_payload: false },
  { card_type: 'CONFIRM_YES', label_fr: 'Je confirme', expects_payload: false },
  { card_type: 'CONFIRM_NO', label_fr: 'Je ne confirme pas', expects_payload: false },
  { card_type: 'THANKS', label_fr: 'Merci', expects_payload: false },
] as const;

export const CriteriaSchema = z.object({
  conversation: z.number().int().min(1).max(5),
  values: z.number().int().min(1).max(5),
  attraction: z.number().int().min(1).max(5),
  punctuality: z.number().int().min(1).max(5),
});
export type Criteria = z.infer<typeof CriteriaSchema>;

export const DateFeedbackSchema = z.object({
  wants_contact: z.boolean(),
  criteria: CriteriaSchema,
});
export type DateFeedbackInput = z.infer<typeof DateFeedbackSchema>;

export const CheckinSchema = z.object({ code: z.string().trim().min(4).max(8) });

export const ContactSchema = z.object({ whatsapp: z.string() });
