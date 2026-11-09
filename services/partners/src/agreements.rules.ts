import type { AgreementStatus } from '@conexa/contracts';

/** Règles pures des contrats versionnés (F4.1). Aucune I/O. */

export interface AgreementState {
  version: number;
  status: AgreementStatus;
  commission_pct: number;
}

/** Numéro de la prochaine version : toujours au-dessus de la plus haute connue. */
export function nextVersion(existing: Array<Pick<AgreementState, 'version'>>): number {
  return existing.reduce((max, item) => Math.max(max, item.version), 0) + 1;
}

/** Un seul contrat en attente de signature à la fois : proposer remplace la confusion. */
export function canPropose(existing: Array<Pick<AgreementState, 'status'>>): boolean {
  return !existing.some((item) => item.status === 'pending_signature');
}

/** Seul un contrat en attente se signe ; un contrat actif ou remplacé ne change plus. */
export function canSign(status: AgreementStatus): boolean {
  return status === 'pending_signature';
}

/**
 * Signer active le contrat visé et remplace l'actif courant. Renvoie les
 * nouveaux statuts, sans rien muter : le service applique le résultat en base.
 */
export function afterSignature<T extends AgreementState>(
  agreements: T[],
  signedVersion: number,
): T[] {
  return agreements.map((item) => {
    if (item.version === signedVersion) return { ...item, status: 'active' as const };
    if (item.status === 'active') return { ...item, status: 'superseded' as const };
    return item;
  });
}

/** Instantané figé : copie du taux au moment de la réservation. */
export function snapshotCommission(active: AgreementState | undefined): number | null {
  return active && active.status === 'active' ? active.commission_pct : null;
}
