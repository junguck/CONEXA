import { FILTERED_PATTERNS, type ChatFilterVerdict } from '@conexa/contracts';
import { AppError } from '@conexa/errors';

/**
 * Filtre des conversations de capitaines (F2.4) : avant le match, on organise
 * sans échanger de numéro. Le filtre est volontairement strict — il refuse une
 * suite de cinq chiffres, un lien de contact ou une poignée sociale — et il ne
 * s'applique qu'aux messages texte : les cartes ont une charge utile fermée.
 */
export function inspectMessage(body: string): ChatFilterVerdict {
  // Le canal externe prime : un lien WhatsApp contient aussi des chiffres, et
  // c'est bien le contournement que l'utilisateur doit voir refusé.
  if (FILTERED_PATTERNS.contact.test(body)) {
    return { allowed: false, reason: 'CHAT_CONTACT_BLOCKED' };
  }
  if (FILTERED_PATTERNS.digits.test(body)) {
    return { allowed: false, reason: 'CHAT_DIGIT_BLOCKED' };
  }
  return { allowed: true, reason: null };
}

/** Lève l'erreur métier correspondant au verdict, sans journaliser le texte. */
export function assertMessageAllowed(body: string): void {
  const verdict = inspectMessage(body);
  if (verdict.allowed || verdict.reason === null) {
    return;
  }
  throw new AppError(
    verdict.reason,
    verdict.reason === 'CHAT_DIGIT_BLOCKED'
      ? 'Les numéros sont interdits dans ce fil'
      : 'Les contacts externes sont interdits dans ce fil',
  );
}
