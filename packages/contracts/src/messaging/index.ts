import { z } from 'zod';

/**
 * Messagerie et notifications (F1.5, F2.4, F4.6). Les fils sont rattachés à un
 * objet métier ; les cartes de rencontre ont une charge utile fermée.
 */

export const THREAD_SCOPES = ['match', 'order', 'mission', 'date', 'post', 'support'] as const;
export const ThreadScopeSchema = z.enum(THREAD_SCOPES);
export type ThreadScope = z.infer<typeof ThreadScopeSchema>;

export const MESSAGE_KINDS = ['text', 'system', 'card'] as const;
export const MessageKindSchema = z.enum(MESSAGE_KINDS);
export type MessageKind = z.infer<typeof MessageKindSchema>;

export const CreateThreadSchema = z.object({
  scope: ThreadScopeSchema,
  object_id: z.uuid(),
  participant_ids: z.array(z.uuid()).min(1).max(32),
});
export type CreateThreadInput = z.infer<typeof CreateThreadSchema>;

export const SendMessageSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('text'), body: z.string().min(1).max(2000) }),
  z.object({
    kind: z.literal('card'),
    card_type: z.string().min(2).max(40),
    payload: z.record(z.string(), z.unknown()),
  }),
]);
export type SendMessageInput = z.infer<typeof SendMessageSchema>;

export const MessageSchema = z.object({
  id: z.uuid(),
  thread_id: z.uuid(),
  sender_id: z.uuid().nullable(),
  kind: MessageKindSchema,
  body: z.string().nullable(),
  card_type: z.string().nullable(),
  payload: z.record(z.string(), z.unknown()).nullable(),
  created_at: z.iso.datetime(),
});
export type Message = z.infer<typeof MessageSchema>;

export const ThreadSchema = z.object({
  id: z.uuid(),
  scope: ThreadScopeSchema,
  object_id: z.uuid(),
  participants: z.array(z.uuid()),
  created_at: z.iso.datetime(),
  last_message_at: z.iso.datetime().nullable(),
});
export type Thread = z.infer<typeof ThreadSchema>;

export const NotificationSchema = z.object({
  id: z.uuid(),
  type: z.string().min(3).max(80),
  payload: z.record(z.string(), z.unknown()),
  read: z.boolean(),
  created_at: z.iso.datetime(),
});
export type Notification = z.infer<typeof NotificationSchema>;

/** Événement interne : un domaine fait notifier un utilisateur sans le connaître. */
export const CreateNotificationSchema = z.object({
  user_id: z.uuid(),
  type: z.string().min(3).max(80),
  payload: z.record(z.string(), z.unknown()).default({}),
});
export type CreateNotificationInput = z.infer<typeof CreateNotificationSchema>;

/**
 * Filtre anti-contournement des conversations de capitaines (F2.4) : on ne peut
 * ni échanger un numéro ni pousser vers un canal externe avant le jour J.
 * Le filtre est une fonction pure, testée dans le service.
 */
export interface ChatFilterVerdict {
  allowed: boolean;
  reason: 'CHAT_DIGIT_BLOCKED' | 'CHAT_CONTACT_BLOCKED' | null;
}

export const FILTERED_PATTERNS = {
  /** Une suite de 5 chiffres ou plus ressemble à un numéro. */
  digits: /\d[\s.-]?\d[\s.-]?\d[\s.-]?\d[\s.-]?\d/,
  /** Canaux externes, liens de contact et poignées sociales. */
  contact: /(wa\.me|whatsapp|t\.me|telegram|instagram|snapchat|@[a-z0-9._]{3,})|(\+?237[\s.-]?\d)/i,
} as const;
