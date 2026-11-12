import { z } from 'zod';

import { openApiComponents } from '../common/openapi.js';
import { errorEnvelopeSchema } from '../common/error.js';
import { dateOnlySchema, isoDateTimeSchema } from '../common/primitives.js';
import {
  CheckinSchema,
  ContactSchema,
  CurrentPicksSchema,
  DateCardSchema,
  DateFeedbackSchema,
  DatePaymentIntentSchema,
  DatingDateSchema,
  DatingInviteSchema,
  DatingPickSchema,
  DatingProfileSchema,
  EligibilitySchema,
  PatchPreferencesSchema,
  PutDatingProfileSchema,
  SendCardSchema,
  SetDateSlotSchema,
} from './index.js';

const QuestionnaireQuestionSchema = z.object({
  key: z.string(),
  label: z.string(),
  kind: z.enum(['choice', 'scale']),
  options: z.array(z.string()).optional(),
  labels: z.record(z.string(), z.string()).optional(),
});

const QuestionnaireBlockSchema = z.object({
  key: z.enum(['values', 'personality', 'lifestyle']),
  questions: z.array(QuestionnaireQuestionSchema),
});

/** Réponse de `GET /dating/questions` : catalogue fermé du questionnaire. */
const QuestionnaireSchema = z.object({
  version: z.number().int().positive(),
  blocks: z.array(QuestionnaireBlockSchema),
});

/** Catalogue des cartes : fermé, sans texte libre. */
const CardCatalogEntrySchema = z.object({
  card_type: z.string(),
  label_fr: z.string(),
  expects_payload: z.boolean(),
});

const IdParam = {
  name: 'id',
  in: 'path',
  required: true,
  schema: { type: 'string', format: 'uuid' },
} as const;

const errorResponse = {
  description: 'Erreur métier : enveloppe `error` avec un code du catalogue.',
  content: {
    'application/json': { schema: { $ref: '#/components/schemas/ErrorEnvelope' } },
  },
} as const;

const auth = [{ bearerAuth: [] }] as const;

function ok(schema: Record<string, unknown>, description: string) {
  return {
    description,
    content: { 'application/json': { schema } },
  };
}

function body(schema: Record<string, unknown>) {
  return {
    required: true,
    content: { 'application/json': { schema } },
  };
}

function ref(name: string) {
  return { $ref: `#/components/schemas/${name}` };
}

/**
 * Contrat OpenAPI 3.1 du domaine rencontres, dérivé des schémas Zod publiés.
 *
 * Chemins identiques à `services/dating/gateway.routes.json` (sans préfixe :
 * la Gateway porte `/api/v1`). Aucune donnée personnelle n'est décrite ici :
 * le contact n'existe que sous forme de réponse `Contact` réservée au participant
 * autorisé, et aucun numéro n'apparaît dans les autres schémas.
 */
export function buildDatingOpenApiDocument(): Record<string, unknown> {
  return {
    openapi: '3.1.0',
    info: {
      title: 'Convexa — rencontres (dating)',
      version: '1.0.0',
      description:
        'Questionnaire fermé, propositions, invitations et date au restaurant. Le contact n’est révélé qu’après le check-in des deux participants (décision 15B). Aucun crédit restaurant (décision 16C).',
    },
    servers: [{ url: '/api/v1' }],
    tags: [{ name: 'dating', description: 'Rencontres, invitations et dates' }],
    components: {
      securitySchemes: {
        bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
      },
      schemas: openApiComponents({
        ErrorEnvelope: errorEnvelopeSchema,
        Eligibility: EligibilitySchema,
        Questionnaire: QuestionnaireSchema,
        DatingProfile: DatingProfileSchema,
        PutDatingProfileInput: PutDatingProfileSchema,
        PatchPreferencesInput: PatchPreferencesSchema,
        DatingPick: DatingPickSchema,
        CurrentPicks: CurrentPicksSchema,
        DatingInvite: DatingInviteSchema,
        DatingDate: DatingDateSchema,
        SetDateSlotInput: SetDateSlotSchema,
        DateCard: DateCardSchema,
        SendCardInput: SendCardSchema,
        CardCatalogEntry: CardCatalogEntrySchema,
        DatePaymentIntent: DatePaymentIntentSchema,
        CheckinInput: CheckinSchema,
        DateFeedbackInput: DateFeedbackSchema,
        Contact: ContactSchema,
        DateOnly: dateOnlySchema,
        IsoDateTime: isoDateTimeSchema,
      }),
    },
    paths: {
      '/dating/eligibility': {
        get: {
          tags: ['dating'],
          summary: 'Éligibilité aux rencontres',
          security: auth,
          responses: {
            200: ok(ref('Eligibility'), 'Éligible ou raisons du refus.'),
            401: errorResponse,
          },
        },
      },
      '/dating/questions': {
        get: {
          tags: ['dating'],
          summary: 'Questionnaire fermé et sa version',
          security: auth,
          responses: { 200: ok(ref('Questionnaire'), 'Questions et options stables.') },
        },
      },
      '/dating/profile': {
        get: {
          tags: ['dating'],
          summary: 'Profil de rencontres',
          security: auth,
          responses: {
            200: ok(ref('DatingProfile'), 'Profil courant.'),
            404: errorResponse,
          },
        },
        put: {
          tags: ['dating'],
          summary: 'Enregistre le questionnaire',
          description:
            'Émet `dating.embedding_requested` dans la même transaction si les réponses ou la version changent.',
          security: auth,
          requestBody: body(ref('PutDatingProfileInput')),
          responses: {
            200: ok(ref('DatingProfile'), 'Profil enregistré.'),
            422: errorResponse,
          },
        },
      },
      '/dating/preferences': {
        patch: {
          tags: ['dating'],
          summary: 'Modifie les préférences',
          security: auth,
          requestBody: body(ref('PatchPreferencesInput')),
          responses: { 204: { description: 'Préférences enregistrées.' }, 422: errorResponse },
        },
      },
      '/dating/pause': {
        post: {
          tags: ['dating'],
          summary: 'Met les propositions en pause',
          security: auth,
          responses: { 204: { description: 'Profil en pause.' } },
        },
      },
      '/dating/resume': {
        post: {
          tags: ['dating'],
          summary: 'Reprend les propositions',
          security: auth,
          responses: { 204: { description: 'Profil actif.' } },
        },
      },
      '/dating/picks/current': {
        get: {
          tags: ['dating'],
          summary: 'Trois propositions de la semaine',
          description:
            'Deux profils ressemblants et un complémentaire, classés par les vecteurs IA. Quota d’invitations décidé par le serveur.',
          security: auth,
          responses: {
            200: ok(ref('CurrentPicks'), 'Propositions et quota restant.'),
            403: errorResponse,
          },
        },
      },
      '/dating/picks/{id}/invite': {
        post: {
          tags: ['dating'],
          summary: 'Invite depuis une proposition',
          security: auth,
          parameters: [IdParam],
          responses: {
            201: ok(ref('DatingInvite'), 'Invitation créée.'),
            403: errorResponse,
            422: errorResponse,
          },
        },
      },
      '/dating/picks/{id}/pass': {
        post: {
          tags: ['dating'],
          summary: 'Passe une proposition',
          security: auth,
          parameters: [IdParam],
          responses: { 204: { description: 'Proposition passée.' }, 404: errorResponse },
        },
      },
      '/dating/invites': {
        get: {
          tags: ['dating'],
          summary: 'Invitations reçues ou envoyées',
          security: auth,
          parameters: [
            {
              name: 'box',
              in: 'query',
              required: false,
              schema: { type: 'string', enum: ['received', 'sent'], default: 'received' },
            },
          ],
          responses: {
            200: ok({ type: 'array', items: ref('DatingInvite') }, 'Invitations en attente.'),
          },
        },
      },
      '/dating/invites/{id}/accept': {
        post: {
          tags: ['dating'],
          summary: 'Accepte une invitation et crée le date',
          description: 'Le payeur est figé à la création (règle `resolvePayer`).',
          security: auth,
          parameters: [IdParam],
          responses: {
            201: ok(ref('DatingDate'), 'Date créé.'),
            404: errorResponse,
            422: errorResponse,
          },
        },
      },
      '/dating/invites/{id}/decline': {
        post: {
          tags: ['dating'],
          summary: 'Refuse une invitation',
          security: auth,
          parameters: [IdParam],
          responses: { 204: { description: 'Invitation refusée.' }, 404: errorResponse },
        },
      },
      '/dating/invites/{id}/withdraw': {
        post: {
          tags: ['dating'],
          summary: 'Retire une invitation envoyée',
          security: auth,
          parameters: [IdParam],
          responses: { 204: { description: 'Invitation retirée.' }, 404: errorResponse },
        },
      },
      '/dates': {
        get: {
          tags: ['dating'],
          summary: 'Mes dates',
          security: auth,
          parameters: [
            {
              name: 'status',
              in: 'query',
              required: false,
              schema: {
                type: 'string',
                enum: [
                  'negotiating',
                  'awaiting_payment',
                  'confirmed',
                  'checked_in',
                  'completed',
                  'cancelled',
                  'no_show',
                  'disputed',
                ],
              },
            },
          ],
          responses: {
            200: ok({ type: 'array', items: ref('DatingDate') }, 'Dates du participant.'),
          },
        },
      },
      '/dates/card-catalog': {
        get: {
          tags: ['dating'],
          summary: 'Catalogue fermé des cartes',
          security: auth,
          responses: {
            200: ok(
              { type: 'array', items: ref('CardCatalogEntry') },
              'Cartes autorisées, sans texte libre.',
            ),
          },
        },
      },
      '/dates/{id}': {
        get: {
          tags: ['dating'],
          summary: 'Détail d’un date',
          security: auth,
          parameters: [IdParam],
          responses: {
            200: ok(ref('DatingDate'), 'Date et fenêtre d’annulation.'),
            403: errorResponse,
            404: errorResponse,
          },
        },
      },
      '/dates/{id}/cards': {
        get: {
          tags: ['dating'],
          summary: 'Cartes échangées',
          security: auth,
          parameters: [IdParam],
          responses: {
            200: ok({ type: 'array', items: ref('DateCard') }, 'Cartes du date.'),
          },
        },
        post: {
          tags: ['dating'],
          summary: 'Envoie une carte',
          description: 'Seul le payeur choisit la formule. Aucun texte libre.',
          security: auth,
          parameters: [IdParam],
          requestBody: body(ref('SendCardInput')),
          responses: {
            201: ok(ref('DateCard'), 'Carte enregistrée.'),
            403: errorResponse,
            422: errorResponse,
          },
        },
      },
      '/dates/{id}/slot': {
        post: {
          tags: ['dating'],
          summary: 'Choisit un créneau Partners et le retient',
          description:
            'Démarre la saga de réservation. `restaurant_id` est un lieu Partners. La retenue doit renvoyer `starts_at` ; sinon la demande est refusée pour ne pas deviner la fenêtre d’annulation.',
          security: auth,
          parameters: [IdParam],
          requestBody: body(ref('SetDateSlotInput')),
          responses: {
            200: ok(ref('DatingDate'), 'Créneau retenu.'),
            409: errorResponse,
            422: errorResponse,
          },
        },
      },
      '/dates/{id}/formula': {
        post: {
          tags: ['dating'],
          summary: 'Choisit la formule (payeur)',
          security: auth,
          parameters: [IdParam],
          requestBody: body({
            type: 'object',
            required: ['formula_id'],
            additionalProperties: false,
            properties: { formula_id: { type: 'string', format: 'uuid' } },
          }),
          responses: { 200: ok(ref('DatingDate'), 'Formule choisie.'), 403: errorResponse },
        },
      },
      '/dates/{id}/orders': {
        post: {
          tags: ['dating'],
          summary: 'Ajoute les plats dans la limite de la formule',
          security: auth,
          parameters: [IdParam],
          requestBody: body({
            type: 'object',
            required: ['items'],
            additionalProperties: false,
            properties: {
              items: {
                type: 'array',
                minItems: 1,
                items: {
                  type: 'object',
                  required: ['menu_item_id', 'quantity', 'unit_price_fcfa'],
                  additionalProperties: false,
                  properties: {
                    menu_item_id: { type: 'string', format: 'uuid' },
                    quantity: { type: 'integer', minimum: 1 },
                    unit_price_fcfa: { type: 'integer', minimum: 0 },
                  },
                },
              },
              allergy_note: { type: 'string', maxLength: 200 },
            },
          }),
          responses: {
            200: ok(ref('DatingDate'), 'Commande enregistrée, total recalculé.'),
            422: errorResponse,
          },
        },
      },
      '/dates/{id}/pay': {
        post: {
          tags: ['dating'],
          summary: 'Paie le date (payeur uniquement)',
          description:
            'Retient la table puis attend le séquestre : le date n’est confirmé que par `payment.escrowed`. Aucun mouvement d’argent dans cette route.',
          security: auth,
          parameters: [IdParam],
          responses: {
            200: ok(ref('DatePaymentIntent'), 'État de la réservation.'),
            403: errorResponse,
            409: errorResponse,
          },
        },
      },
      '/dates/{id}/cancel': {
        post: {
          tags: ['dating'],
          summary: 'Annule le date',
          description:
            'Libre jusqu’à 3 h avant le créneau ; la retenue est libérée et tout séquestre remboursé une seule fois. Aucun remboursement en crédit restaurant.',
          security: auth,
          parameters: [IdParam],
          responses: {
            204: { description: 'Date annulé.' },
            409: errorResponse,
          },
        },
      },
      '/dates/{id}/checkin': {
        post: {
          tags: ['dating'],
          summary: 'Check-in sur place',
          description:
            'Le second check-in fait passer le date à `checked_in`. C’est la seule condition de révélation du contact (décision 15B).',
          security: auth,
          parameters: [IdParam],
          requestBody: body(ref('CheckinInput')),
          responses: {
            200: ok(ref('DatingDate'), 'Check-in enregistré.'),
            422: errorResponse,
          },
        },
      },
      '/dates/{id}/sos': {
        post: {
          tags: ['dating'],
          summary: 'Alerte pendant le date',
          description: 'Alerte le restaurant et l’administration immédiatement.',
          security: auth,
          parameters: [IdParam],
          responses: { 204: { description: 'Alerte enregistrée.' }, 409: errorResponse },
        },
      },
      '/dates/{id}/feedback': {
        post: {
          tags: ['dating'],
          summary: 'Retour privé après le date',
          description:
            'Le retour n’ouvre pas le contact : il ne dépend que du check-in des deux participants.',
          security: auth,
          parameters: [IdParam],
          requestBody: body(ref('DateFeedbackInput')),
          responses: { 204: { description: 'Retour enregistré.' }, 422: errorResponse },
        },
      },
      '/dates/{id}/contact': {
        get: {
          tags: ['dating'],
          summary: 'Contact du partenaire',
          description:
            'Réponse uniquement si les deux participants ont fait leur check-in ; sinon `CONTACT_NOT_REVEALED`. Le numéro reste détenu par Identity.',
          security: auth,
          parameters: [IdParam],
          responses: {
            200: ok(ref('Contact'), 'Contact révélé au participant autorisé.'),
            403: errorResponse,
            409: errorResponse,
          },
        },
      },
    },
  };
}
