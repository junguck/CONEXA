import { EntitlementsSchema, type Entitlements } from '@conexa/contracts';

/**
 * Droits des abonnés (`ARCHITECTURE.md` §7). Billing est la seule source de
 * vérité ; ce paquet ne fait que **nommer** les clés et les règles de lecture,
 * pour qu'aucun service n'écrive un taux ou une limite en dur.
 *
 * Aucune valeur par défaut ici : les droits gratuits vivent dans
 * `billing.plans` (`is_default`), jamais dans le code d'un consommateur.
 */

export const ENTITLEMENT_KEYS = [
  'commission_pct',
  'max_active_listings',
  'picks_per_week',
  'boost_discount_pct',
  'event_commission_pct',
] as const;

export type EntitlementKey = (typeof ENTITLEMENT_KEYS)[number];
export type { Entitlements };

/** Un plan inconnu ne produit pas de droits silencieux : on refuse. */
export function assertEntitlements(value: unknown): Entitlements {
  const parsed = EntitlementsSchema.safeParse(value);
  if (!parsed.success) {
    throw new Error('Droits invalides : le plan doit fournir toutes les clés connues');
  }
  return parsed.data;
}

export function limitOf(entitlements: Entitlements, key: EntitlementKey): number {
  return entitlements[key];
}

/** Un droit numérique à 0 est un droit **absent** (non souscrit). */
export function has(entitlements: Entitlements, key: EntitlementKey): boolean {
  return entitlements[key] > 0;
}
