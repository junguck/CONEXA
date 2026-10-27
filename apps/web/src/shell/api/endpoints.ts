import type {
  Application,
  Challenge,
  CreatePostInput,
  DateCard,
  DatingDate,
  DatingInvite,
  DatingPick,
  Eligibility,
  Entitlements,
  Match,
  MatchDetail,
  Me,
  Message,
  Mission,
  Notification,
  Payment,
  Plan,
  PlayerStats,
  Post,
  PublicUser,
  RegisterInput,
  ReportInput,
  SendMessageInput,
  ServiceListing,
  ServiceOrder,
  SubscribeInput,
  Subscription,
  Team,
  TeamRankingRow,
  TeamStats,
  Thread,
  TokenPair,
} from '@conexa/contracts';

import { apiClient, type ApiClient, type Page } from './client';

/**
 * Couche d'appels typée à partir de `@conexa/contracts` et des manifestes du
 * Gateway (`services/<domaine>/gateway.routes.json`). Les chemins sont ceux du
 * Gateway, sans préfixe `/api/v1` : `NEXT_PUBLIC_API_URL` porte la base publique.
 *
 * Aucune règle métier ici : l'Elo, les quotas, les commissions et les montants
 * viennent des réponses serveur, jamais d'un calcul local.
 */

export interface Filiere {
  id: number;
  name: string;
}

export interface UpdateMeInput {
  full_name?: string;
  photo_upload_id?: string;
  filiere_id?: number;
  study_level?: number;
}

/** `GET /billing/me` : abonnement courant et droits effectifs. */
export interface BillingOverview {
  subscription: Subscription | null;
  entitlements: Entitlements;
}

/** `GET /dating/picks/current` : quota restant calculé par le serveur. */
export interface CurrentPicks {
  week_start: string;
  quota_left: number;
  picks: DatingPick[];
}

const id = (value: string): string => encodeURIComponent(value);

export function createEndpoints(client: ApiClient) {
  return {
    identity: {
      me: () => client.get<Me>('me'),
      updateMe: (input: UpdateMeInput) =>
        client.request<Me>('me', { method: 'PATCH', body: input }),
      requestOtp: (whatsapp: string) => client.post<void>('auth/otp/request', { whatsapp }),
      verifyOtp: (whatsapp: string, code: string) =>
        client.post<TokenPair>('auth/otp/verify', { whatsapp, code }),
      register: (input: RegisterInput) => client.post<Me>('me/register', input),
      filieres: () => client.get<Filiere[]>('filieres'),
      publicUser: (userId: string) => client.get<PublicUser>(`users/${id(userId)}`),
      report: (input: ReportInput) => client.post<void>('reports', input),
    },

    billing: {
      /** Plans et prix : le serveur est la seule source des tarifs. */
      plans: () => client.get<Plan[]>('billing/plans'),
      me: () => client.get<BillingOverview>('billing/me'),
      subscribe: (input: SubscribeInput, idempotencyKey: string) =>
        client.post<Subscription>('billing/subscriptions', input, { idempotencyKey }),
      activate: (subscriptionId: string, paymentId: string) =>
        client.post<Subscription>(`billing/subscriptions/${id(subscriptionId)}/activate`, {
          payment_id: paymentId,
        }),
      cancel: (subscriptionId: string) =>
        client.post<Subscription>(`billing/subscriptions/${id(subscriptionId)}/cancel`, {}),
    },

    football: {
      teams: (query: { limit?: number; cursor?: string; q?: string; level?: Team['level'] } = {}) =>
        client.page<Team>('football/teams', { query }),
      team: (teamId: string) => client.get<Team>(`football/teams/${id(teamId)}`),
      myTeam: () => client.get<Team | null>('football/me/team'),
      teamStats: (teamId: string) => client.get<TeamStats>(`football/teams/${id(teamId)}/stats`),
      matches: (query: { limit?: number; cursor?: string; status?: Match['status'] } = {}) =>
        client.page<Match>('football/matches', { query }),
      match: (matchId: string) => client.get<MatchDetail>(`football/matches/${id(matchId)}`),
      rankings: (query: { scope?: string; filiere_id?: number; level?: string } = {}) =>
        client.get<TeamRankingRow[]>('football/rankings/teams', { query }),
      playerStats: (playerId: string) =>
        client.get<PlayerStats>(`football/players/${id(playerId)}/stats`),
      challenges: () => client.get<Challenge[]>('football/challenges'),
    },

    dating: {
      eligibility: () => client.get<Eligibility>('dating/eligibility'),
      picks: () => client.get<CurrentPicks>('dating/picks/current'),
      invites: (box: 'received' | 'sent' = 'received') =>
        client.get<DatingInvite[]>('dating/invites', { query: { box } }),
      dates: () => client.get<DatingDate[]>('dates'),
      date: (dateId: string) => client.get<DatingDate>(`dates/${id(dateId)}`),
      cards: (dateId: string) => client.get<DateCard[]>(`dates/${id(dateId)}/cards`),
      sendCard: (dateId: string, cardType: string, payload: Record<string, unknown>) =>
        client.post<DateCard>(`dates/${id(dateId)}/cards`, {
          card_type: cardType,
          payload,
        }),
      pay: (
        dateId: string,
        payment: { provider: string; phone_msisdn: string },
        idempotencyKey: string,
      ) => client.post<Payment>(`dates/${id(dateId)}/pay`, payment, { idempotencyKey }),
      cancel: (dateId: string) => client.post<DatingDate>(`dates/${id(dateId)}/cancel`, {}),
    },

    talents: {
      posts: (query: { limit?: number; cursor?: string; kind?: Post['kind']; q?: string } = {}) =>
        client.page<Post>('posts', { query }),
      post: (postId: string) => client.get<Post>(`posts/${id(postId)}`),
      createPost: (input: CreatePostInput) => client.post<Post>('posts', input),
      apply: (postId: string, message?: string) =>
        client.post<Application>(`posts/${id(postId)}/apply`, message ? { message } : {}),
      missions: (query: { role?: 'client' | 'provider'; status?: Mission['status'] } = {}) =>
        client.get<Mission[]>('missions', { query }),
      fundMission: (
        missionId: string,
        payment: { provider: string; phone_msisdn: string },
        idempotencyKey: string,
      ) =>
        client.post<Payment>(`missions/${id(missionId)}/fund`, payment, {
          idempotencyKey,
        }),
    },

    messaging: {
      threads: () => client.get<Thread[]>('messaging/threads'),
      messages: (threadId: string, before?: string) =>
        client.get<Message[]>(`messaging/threads/${id(threadId)}/messages`, {
          query: { before },
        }),
      send: (threadId: string, input: SendMessageInput) =>
        client.post<Message>(`messaging/threads/${id(threadId)}/messages`, input),
      markRead: (threadId: string) =>
        client.post<void>(`messaging/threads/${id(threadId)}/read`, {}),
      notifications: () => client.get<Notification[]>('notifications'),
      markNotificationsRead: () => client.post<{ updated: number }>('notifications/read', {}),
    },

    marketplace: {
      services: (query: { limit?: number; cursor?: string; q?: string; category?: string } = {}) =>
        client.page<ServiceListing>('services', { query }),
      service: (serviceId: string) => client.get<ServiceListing>(`services/${id(serviceId)}`),
      orders: (query: { role?: 'client' | 'provider'; status?: ServiceOrder['status'] } = {}) =>
        client.page<ServiceOrder>('service-orders', { query }),
    },
  };
}

export type Endpoints = ReturnType<typeof createEndpoints>;
export type { Page };

/** Instance prête à l'emploi pour les écrans, adossée à la Gateway. */
export const api = createEndpoints(apiClient);
