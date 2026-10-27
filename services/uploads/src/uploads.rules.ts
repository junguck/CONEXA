import {
  DAILY_UPLOAD_QUOTA,
  UPLOAD_RULES,
  type UploadPurpose,
  type UploadStatus,
} from '@conexa/contracts';
import { AppError, forbidden, invalidState } from '@conexa/errors';

export interface Declaration {
  purpose: UploadPurpose;
  contentType: string;
  byteSize: number;
}

export function ruleFor(purpose: UploadPurpose) {
  return UPLOAD_RULES[purpose];
}

/**
 * Valide la déclaration faite par le client **avant** d'ouvrir un emplacement :
 * un fichier refusé ici ne coûte jamais un octet de stockage.
 */
export function validateDeclaration(declaration: Declaration): void {
  const rule = ruleFor(declaration.purpose);
  if (!rule.contentTypes.includes(declaration.contentType)) {
    throw new AppError(
      'UPLOAD_TYPE_NOT_ALLOWED',
      `Type refusé pour ${declaration.purpose} : ${declaration.contentType}`,
      { allowed: rule.contentTypes },
    );
  }
  if (declaration.byteSize > rule.maxBytes) {
    throw new AppError('UPLOAD_TOO_LARGE', 'Fichier trop lourd pour cet usage', {
      max_bytes: rule.maxBytes,
      byte_size: declaration.byteSize,
    });
  }
}

/**
 * Le type annoncé et celui réellement reçu doivent coïncider : le type MIME
 * d'un envoi brut ne peut pas être réécrit entre la déclaration et l'écriture.
 */
export function assertContentTypeMatches(declared: string, received: string | undefined): void {
  if (!received || received.split(';')[0]?.trim().toLowerCase() !== declared.toLowerCase()) {
    throw new AppError('UPLOAD_TYPE_NOT_ALLOWED', 'Type MIME reçu différent de la déclaration', {
      declared,
      received: received ?? null,
    });
  }
}

/** Taille réelle : jamais celle annoncée par le client. */
export function assertWithinLimit(purpose: UploadPurpose, byteSize: number): void {
  const rule = ruleFor(purpose);
  if (byteSize > rule.maxBytes) {
    throw new AppError('UPLOAD_TOO_LARGE', 'Fichier trop lourd pour cet usage', {
      max_bytes: rule.maxBytes,
      byte_size: byteSize,
    });
  }
  if (byteSize === 0) {
    throw invalidState('Fichier vide');
  }
}

export function quotaAllows(createdToday: number): boolean {
  return createdToday < DAILY_UPLOAD_QUOTA;
}

/** Seul le propriétaire écrit ou supprime son fichier. */
export function assertOwner(ownerId: string, actorId: string): void {
  if (ownerId !== actorId) {
    throw forbidden('Fichier appartenant à un autre compte');
  }
}

/** Un fichier ne s'attache qu'une fois le contenu réellement écrit. */
export function assertAttachable(status: UploadStatus): void {
  if (status === 'deleted') {
    throw invalidState('Fichier supprimé');
  }
  if (status !== 'ready') {
    throw invalidState('Fichier non encore reçu : envoi du contenu requis');
  }
}

/** Plafond de fichiers par objet (photos d'offre, preuves…). */
export function assertSlotAvailable(purpose: UploadPurpose, attachedCount: number): void {
  const rule = ruleFor(purpose);
  if (attachedCount >= rule.maxPerObject) {
    throw invalidState(`Limite de ${rule.maxPerObject} fichier(s) atteinte pour ${purpose}`);
  }
}

/** Contenu déjà servi : immuable, donc cache long côté client. */
export function readHeaders(contentType: string): Record<string, string> {
  return {
    'Content-Type': contentType,
    'Cache-Control': 'public, max-age=31536000, immutable',
    'X-Content-Type-Options': 'nosniff',
  };
}
