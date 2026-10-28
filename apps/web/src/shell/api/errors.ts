import type { ErrorCode as BusinessErrorCode } from '@conexa/contracts';

/**
 * Codes d'erreur métier de `docs/product/API.md` §1 et leur message français.
 * La liste et le statut HTTP viennent de `@conexa/contracts` ; ces textes sont
 * un repli lisible quand la réponse ne fournit pas de message, jamais une
 * règle métier. Un nouveau code côté contrats casse le typecheck ici.
 */

/** Erreurs produites côté client, hors contrat d'API. */
export type ClientErrorCode = 'NETWORK_ERROR' | 'INVALID_RESPONSE';

export type ErrorCode = BusinessErrorCode | ClientErrorCode;

const MESSAGES: Record<BusinessErrorCode, string> = {
  UNAUTHENTICATED: 'Votre session a expiré. Reconnectez-vous.',
  FORBIDDEN: 'Vous n’avez pas les droits pour cette action.',
  ACCOUNT_PENDING: 'Votre compte attend encore la validation d’un administrateur.',
  ACCOUNT_SUSPENDED: 'Votre compte est suspendu.',
  NOT_FOUND: 'Cette ressource n’existe plus.',
  VALIDATION_ERROR: 'Certains champs sont invalides. Vérifiez le formulaire.',
  INVALID_STATE: 'Cette action n’est pas possible dans l’état actuel.',
  RATE_LIMITED: 'Trop de requêtes. Patientez un instant.',
  MATRICULE_TAKEN: 'Ce matricule est déjà utilisé.',
  OTP_INVALID: 'Le code est faux ou expiré.',
  AGE_RESTRICTED: 'Les rencontres sont réservées aux personnes majeures.',
  RELIABILITY_TOO_LOW: 'Votre score de fiabilité est trop bas pour cette action.',
  TEAM_ALREADY_MEMBER: 'Ce joueur fait déjà partie d’une équipe.',
  TEAM_JOIN_COOLDOWN: 'Après avoir quitté une équipe, attendez 7 jours.',
  TEAM_NOT_ACTIVE: 'Cette équipe n’a pas encore l’effectif minimum.',
  NOT_CAPTAIN: 'Seul le capitaine peut faire cette action.',
  FIELD_SLOT_TAKEN: 'Ce créneau de terrain est déjà réservé.',
  REPORT_ALREADY_SUBMITTED: 'Le score a déjà été déclaré par ce capitaine.',
  CHAT_DIGIT_BLOCKED: 'Les chiffres et numéros sont interdits dans le chat.',
  CHAT_CONTACT_BLOCKED: 'Les liens et demandes de contact sont interdits avant le « oui » mutuel.',
  WEEKLY_QUOTA_EXCEEDED: 'Vous avez utilisé vos 3 invitations de la semaine.',
  PICK_EXPIRED: 'Cette proposition a expiré.',
  SLOT_FULL: 'Plus de table disponible sur ce créneau.',
  FORMULA_CAP_EXCEEDED: 'La commande dépasse le plafond de la formule.',
  PAYMENT_REQUIRED: 'Un paiement est nécessaire pour continuer.',
  CANCEL_WINDOW_CLOSED: 'Annulation impossible à moins de 3 h du date.',
  CONTACT_NOT_REVEALED: 'Le contact n’est révélé qu’après un « oui » mutuel.',
  ALREADY_BLOCKED: 'Cet utilisateur est déjà bloqué.',
  DUPLICATE_REQUEST: 'Cette requête a déjà été envoyée avec un contenu différent.',
  ENTITLEMENT_REQUIRED: 'Cette fonction est réservée à l’abonnement Premium.',
  PLAN_LIMIT_REACHED: 'Vous avez atteint la limite de votre plan.',
  PLAN_NOT_FOUND: 'Ce plan n’existe pas ou n’est plus actif.',
  PLAN_AUDIENCE_MISMATCH: 'Ce plan ne concerne pas ce type de compte.',
  PROMO_INVALID: 'Ce code promo est inconnu, expiré ou épuisé.',
  LISTING_NOT_ACTIVE: 'Cette offre de service n’est pas active.',
  LISTING_PROHIBITED: 'Cette offre contient un terme interdit.',
  SELF_ORDER_FORBIDDEN: 'Vous ne pouvez pas commander votre propre offre.',
  SLOT_ALREADY_BOOKED: 'Ce créneau de prestation est déjà réservé.',
  REVISIONS_EXHAUSTED: 'Aucune révision ne reste pour cette commande.',
  ORDER_NOT_COMPLETED: 'Un avis n’est possible qu’après une commande terminée.',
  OFFER_NOT_AVAILABLE: 'Cette offre partenaire est inactive ou hors période.',
  OFFER_SOLD_OUT: 'Cette offre est épuisée.',
  OFFER_LIMIT_REACHED: 'Vous avez atteint la limite de bons pour cette offre.',
  VOUCHER_INVALID: 'Ce code de bon est inconnu.',
  VOUCHER_ALREADY_USED: 'Ce bon a déjà été utilisé.',
  VOUCHER_EXPIRED: 'Ce bon est périmé.',
  PARTNER_NOT_ACTIVE: 'Cette organisation partenaire n’est pas active.',
  ASSET_NOT_APPROVED: 'Le visuel de bannière n’a pas été approuvé.',
  UPLOAD_TOO_LARGE: 'Le fichier dépasse la taille autorisée.',
  UPLOAD_TYPE_NOT_ALLOWED: 'Ce type de fichier n’est pas accepté.',
  INTERNAL_ERROR: 'Une erreur inattendue est survenue. Réessayez dans un instant.',
};

/** Liste dérivée des messages : aucune copie manuelle de `ERROR_STATUS`. */
export const BUSINESS_ERROR_CODES = Object.keys(MESSAGES) as BusinessErrorCode[];

const CLIENT_MESSAGES: Record<ClientErrorCode, string> = {
  NETWORK_ERROR: 'Connexion impossible. Vérifiez votre réseau puis réessayez.',
  INVALID_RESPONSE: 'Réponse inattendue du serveur. Réessayez dans un instant.',
};

export function isBusinessErrorCode(code: string): code is BusinessErrorCode {
  return Object.hasOwn(MESSAGES, code);
}

/** Message français pour un code connu ; repli neutre sinon. */
export function messageForCode(code: string, serverMessage?: string): string {
  if (isBusinessErrorCode(code)) return MESSAGES[code];
  if (code === 'NETWORK_ERROR' || code === 'INVALID_RESPONSE') return CLIENT_MESSAGES[code];
  return serverMessage && serverMessage.trim() !== ''
    ? serverMessage
    : 'Une erreur inattendue est survenue.';
}
