/**
 * Clés interdites dans un payload d'événement : identifiants de contact,
 * secrets et données de paiement. Un événement ne transporte que des
 * identifiants ; le consommateur va chercher le reste par l'API du producteur.
 */
export const FORBIDDEN_PAYLOAD_KEYS = [
  'whatsapp',
  'whatsapp_number',
  'phone',
  'phone_number',
  'msisdn',
  'email',
  'matricule',
  'password',
  'secret',
  'token',
  'access_token',
  'refresh_token',
  'api_key',
  'id_card',
  'national_id',
  'payment_url',
] as const;

const FORBIDDEN = new Set<string>(FORBIDDEN_PAYLOAD_KEYS);

/** Levée quand un payload transporte une donnée interdite. */
export class EventPiiError extends Error {
  readonly keys: string[];

  constructor(keys: string[]) {
    super(`Payload d'événement refusé : clés interdites (${keys.join(', ')})`);
    this.name = 'EventPiiError';
    this.keys = keys;
  }
}

/** Chemins des clés interdites trouvées dans la valeur (récursif, sans les valeurs). */
export function findForbiddenKeys(value: unknown, path = ''): string[] {
  if (Array.isArray(value)) {
    return value.flatMap((item, index) => findForbiddenKeys(item, `${path}[${index}]`));
  }
  if (value !== null && typeof value === 'object') {
    return Object.entries(value as Record<string, unknown>).flatMap(([key, child]) => {
      const childPath = path === '' ? key : `${path}.${key}`;
      const own = FORBIDDEN.has(key.toLowerCase()) ? [childPath] : [];
      return [...own, ...findForbiddenKeys(child, childPath)];
    });
  }
  return [];
}

/** Refuse un payload qui contient une clé interdite, même imbriquée. */
export function assertNoPii(payload: Record<string, unknown>): void {
  const keys = findForbiddenKeys(payload);
  if (keys.length > 0) throw new EventPiiError(keys);
}
