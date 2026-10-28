/**
 * Filtre local du chat de démonstration. Il imite la règle serveur de
 * `docs/product/API.md` §3 : chiffres, nombres en lettres, liens, pseudos et
 * demandes de contact sont refusés. Le serveur reste l'autorité : ce filtre
 * n'est là que pour montrer le comportement dans la maquette.
 */

const DIGITS = /\p{Nd}/u;
const LINK = /(https?:\/\/|www\.)\S+/iu;
const HANDLE = /(^|\s)@[\p{L}\p{N}_]{2,}/u;
const CONTACT = /\b(whatsapp|whats\s?app|appelle[- ]moi|appel|dm|snap|telegram)\b/iu;

const NUMBER_WORDS: Record<string, number> = {
  zero: 0,
  zéro: 0,
  un: 1,
  une: 1,
  deux: 2,
  trois: 3,
  quatre: 4,
  cinq: 5,
  six: 6,
  sept: 7,
  huit: 8,
  neuf: 9,
  dix: 10,
};

const WORD = /\p{L}+/gu;

export interface FilterResult {
  blocked: boolean;
  reasons: string[];
}

/** Détecte deux mots-nombres consécutifs (« zéro six… ») sans bloquer « un ». */
function hasNumberWords(text: string): boolean {
  const words = (text.toLowerCase().match(WORD) ?? []).map((word) =>
    word.replace(/[^\p{L}]/gu, ''),
  );
  let run = 0;
  for (const word of words) {
    if (word in NUMBER_WORDS) {
      run += 1;
      if (run >= 2) return true;
    } else {
      run = 0;
    }
  }
  return false;
}

export function filterMessage(text: string): FilterResult {
  const normalized = text.normalize('NFKC').replace(/[\u200B-\u200D\uFEFF]/g, '');
  const reasons: string[] = [];
  if (DIGITS.test(normalized)) reasons.push('chiffres');
  if (LINK.test(normalized)) reasons.push('lien');
  if (HANDLE.test(normalized)) reasons.push('pseudo');
  if (CONTACT.test(normalized)) reasons.push('demande de contact');
  if (hasNumberWords(normalized)) reasons.push('nombre en lettres');
  return { blocked: reasons.length > 0, reasons };
}

/** Message lisible quand le serveur refusera le texte (mêmes raisons). */
export function rejectionMessage(reasons: string[]): string {
  if (reasons.length === 0) return 'Message refusé.';
  return `Message non envoyé : ${reasons.join(', ')}. Les numéros, liens et demandes de contact sont bloqués dans les conversations Convexa.`;
}
