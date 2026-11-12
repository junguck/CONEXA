import type {
  DateCard,
  DateStatus,
  DatingDate,
  DatingInvite,
  DatingPick,
  DatingProfile,
  Eligibility,
  PutDatingProfileInput,
  QuestionnaireBlock,
} from '@conexa/contracts';

import { apiClient, type RequestOptions } from '../../shell/api/client';

/**
 * Surface dating réellement exposée par le service `@conexa/dating`.
 *
 * Le client partagé porte l'authentification dès qu'Identity fournit le jeton ;
 * aucun écran ne fabrique d'identifiant, de montant, de quota ni de règle ici.
 * Les codes d'erreur (`CANCEL_WINDOW_CLOSED`, `CONTACT_NOT_REVEALED`, …) sont
 * traduits par `shell/api/errors`, jamais réinventés.
 */

export interface CurrentPicks {
  week_start: string;
  quota_left: number;
  picks: DatingPick[];
}

export interface PaymentIntent {
  payment_id: string | null;
  status: string;
}

export interface CardCatalogEntry {
  card_type: string;
  label_fr: string;
  expects_payload: boolean;
}

export interface DateSlotInput {
  restaurant_id: string;
  slot_id: string;
}

export interface DateOrderLine {
  menu_item_id: string;
  quantity: number;
  unit_price_fcfa: number;
}

/** Ordre d'exécution d'une saga, miroir de `SagaSnapshot.state`. */
export type SagaState =
  'holding' | 'awaiting_payment' | 'confirming' | 'confirmed' | 'failed' | 'cancelled';

export interface SagaView {
  date_id: string;
  state: SagaState;
  failure_reason: 'SLOT_LOST' | 'PAYMENT_FAILED' | 'HOLD_EXPIRED' | null;
  attempt: number;
}

const post = <T>(
  path: string,
  body: unknown = {},
  options: Omit<RequestOptions, 'method' | 'body'> = {},
) => apiClient.post<T>(path, body, options);
const get = <T>(path: string, options: Omit<RequestOptions, 'method' | 'body'> = {}) =>
  apiClient.get<T>(path, options);
const put = <T>(path: string, body: unknown) => apiClient.request<T>(path, { method: 'PUT', body });

export const datingApi = {
  eligibility: () => get<Eligibility>('dating/eligibility'),
  questions: () => get<{ version: number; blocks: QuestionnaireBlock[] }>('dating/questions'),
  profile: () => get<DatingProfile>('dating/profile'),
  saveProfile: (input: PutDatingProfileInput) => put<DatingProfile>('dating/profile', input),
  savePreferences: (input: { seeking?: string[]; age_min?: number; age_max?: number }) =>
    apiClient.request<void>('dating/preferences', { method: 'PATCH', body: input }),
  pause: () => post<void>('dating/pause'),
  resume: () => post<void>('dating/resume'),

  picks: () => get<CurrentPicks>('dating/picks/current'),
  invite: (pickId: string) => post<DatingInvite>(`dating/picks/${pickId}/invite`),
  pass: (pickId: string) => post<void>(`dating/picks/${pickId}/pass`),
  invites: (box: 'received' | 'sent' = 'received') =>
    get<DatingInvite[]>('dating/invites', { query: { box } }),
  acceptInvite: (inviteId: string) => post<DatingDate>(`dating/invites/${inviteId}/accept`),
  declineInvite: (inviteId: string) => post<void>(`dating/invites/${inviteId}/decline`),
  withdrawInvite: (inviteId: string) => post<void>(`dating/invites/${inviteId}/withdraw`),

  cardCatalog: () => get<CardCatalogEntry[]>('dates/card-catalog'),
  dates: (status?: DateStatus) => get<DatingDate[]>('dates', status ? { query: { status } } : {}),
  date: (dateId: string) => get<DatingDate>(`dates/${dateId}`),
  cards: (dateId: string) => get<DateCard[]>(`dates/${dateId}/cards`),
  sendCard: (dateId: string, cardType: string, payload: Record<string, unknown> = {}) =>
    post<DateCard>(`dates/${dateId}/cards`, { card_type: cardType, payload }),
  setSlot: (dateId: string, input: DateSlotInput) =>
    post<DatingDate>(`dates/${dateId}/slot`, input),
  setFormula: (dateId: string, formulaId: string) =>
    post<DatingDate>(`dates/${dateId}/formula`, { formula_id: formulaId }),
  addOrders: (dateId: string, items: DateOrderLine[], allergyNote?: string) =>
    post<DatingDate>(`dates/${dateId}/orders`, {
      items,
      ...(allergyNote === undefined ? {} : { allergy_note: allergyNote }),
    }),
  pay: (dateId: string, idempotencyKey: string) =>
    post<PaymentIntent>(`dates/${dateId}/pay`, {}, { idempotencyKey }),
  cancel: (dateId: string) => post<void>(`dates/${dateId}/cancel`),
  checkin: (dateId: string, code: string) => post<DatingDate>(`dates/${dateId}/checkin`, { code }),
  sos: (dateId: string) => post<void>(`dates/${dateId}/sos`),
  feedback: (
    dateId: string,
    input: {
      wants_contact: boolean;
      criteria: { conversation: number; values: number; attraction: number; punctuality: number };
    },
  ) => post<void>(`dates/${dateId}/feedback`, input),
  contact: (dateId: string) => get<{ whatsapp: string }>(`dates/${dateId}/contact`),

  /** Lieu et créneaux viennent de Partners : Dating ne les duplique pas. */
  venues: () =>
    get<Array<{ id: string; name: string; city: string; address: string }>>('partners/venues'),
  venueSlots: (venueId: string) =>
    get<Array<{ id: string; starts_at: string; ends_at: string; capacity: number }>>(
      `partners/venues/${venueId}/slots`,
    ),
};

export type { DatingDate, DatingPick, DatingInvite, DatingProfile };
