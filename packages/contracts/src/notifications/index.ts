import { z } from 'zod';

/**
 * Notifications push (F1.5). Le service ne parle qu'au navigateur : les
 * notifications in-app restent dans Messaging. Le canal `web_push` exige des
 * clés VAPID ; sans elles le service tourne avec le canal `console` et le dit.
 */

export const PUSH_CHANNELS = ['console', 'web_push'] as const;
export const PushChannelSchema = z.enum(PUSH_CHANNELS);
export type PushChannel = z.infer<typeof PushChannelSchema>;

export const RegisterSubscriptionSchema = z.object({
  /** URL fournie par le navigateur : elle seule désigne l'abonnement. */
  endpoint: z.url().max(2048),
  keys: z.object({
    p256dh: z.string().min(80).max(200),
    auth: z.string().min(16).max(100),
  }),
  platform: z.enum(['web', 'android', 'ios']).default('web'),
});
export type RegisterSubscriptionInput = z.infer<typeof RegisterSubscriptionSchema>;

export const PushSubscriptionSchema = z.object({
  id: z.uuid(),
  endpoint: z.url(),
  platform: z.string(),
  created_at: z.iso.datetime(),
  last_success_at: z.iso.datetime().nullable(),
  failure_count: z.number().int().nonnegative(),
});
export type PushSubscription = z.infer<typeof PushSubscriptionSchema>;

export const DispatchPushSchema = z.object({
  user_id: z.uuid(),
  type: z.string().min(2).max(64),
  title: z.string().min(2).max(120),
  body: z.string().min(1).max(240),
  url: z.string().startsWith('/').max(300).optional(),
  /** Regroupe les notifications de même nature côté navigateur. */
  tag: z.string().min(2).max(64).optional(),
});
export type DispatchPushInput = z.infer<typeof DispatchPushSchema>;

export const PushDeliverySchema = z.object({
  id: z.uuid(),
  type: z.string(),
  channel: PushChannelSchema,
  status: z.enum(['sent', 'failed']),
  error_code: z.string().nullable(),
  created_at: z.iso.datetime(),
});
export type PushDelivery = z.infer<typeof PushDeliverySchema>;

export const DispatchPushResultSchema = z.object({
  sent: z.number().int().nonnegative(),
  failed: z.number().int().nonnegative(),
  skipped: z.number().int().nonnegative(),
});
export type DispatchPushResult = z.infer<typeof DispatchPushResultSchema>;

/** Charge utile reçue par le service worker. */
export interface PushMessage {
  title: string;
  body: string;
  url?: string;
  tag?: string;
  type: string;
}
