import { fr } from './fr';

/** Langue unique de l'interface (fr). Aucune dépendance i18n tant qu'il n'y a qu'une langue. */
export const messages = fr;

type Leaves<T, Prefix extends string = ''> = {
  [K in keyof T & string]: T[K] extends string ? `${Prefix}${K}` : Leaves<T[K], `${Prefix}${K}.`>;
}[keyof T & string];

export type MessageKey = Leaves<typeof fr>;

/** Résout une clé pointée (`home.title`) et retombe sur la clé brute si elle manque. */
export function t(key: MessageKey): string {
  const value = key.split('.').reduce<unknown>((node, part) => {
    if (node && typeof node === 'object' && part in node) {
      return (node as Record<string, unknown>)[part];
    }
    return undefined;
  }, fr);

  return typeof value === 'string' ? value : key;
}
