import { createHash, randomUUID } from 'node:crypto';

import { Injectable } from '@nestjs/common';

import type {
  AttachUploadInput,
  CreateUploadInput,
  Upload,
  UploadObjectType,
  UploadStatus,
} from '@conexa/contracts';
import { AppError, invalidState, notFound } from '@conexa/errors';

import { env } from './config.js';
import { db } from './db.js';
import { LocalDiskStorage, type StorageDriver } from './storage.js';
import {
  assertAttachable,
  assertContentTypeMatches,
  assertOwner,
  assertSlotAvailable,
  assertWithinLimit,
  quotaAllows,
  validateDeclaration,
} from './uploads.rules.js';

/** Un emplacement non rempli expire : le contenu doit arriver dans les 24 h. */
export const PENDING_TTL_MS = 24 * 60 * 60 * 1000;

interface UploadRow {
  id: string;
  owner_id: string;
  purpose: Upload['purpose'];
  content_type: string;
  byte_size: number;
  status: UploadStatus;
  created_at: Date;
}

@Injectable()
export class UploadsService {
  // Champs et non paramètres de constructeur : Nest les lirait comme des
  // dépendances à injecter alors qu'aucun provider n'existe pour eux.
  private readonly storage: StorageDriver = new LocalDiskStorage(env.UPLOADS_STORAGE_DIR);
  private readonly now: () => Date = () => new Date();

  async create(
    ownerId: string,
    input: CreateUploadInput,
  ): Promise<{ id: string; upload_url: string; expires_at: string }> {
    validateDeclaration({
      purpose: input.purpose,
      contentType: input.content_type,
      byteSize: input.byte_size,
    });

    const since = new Date(this.now().getTime() - 24 * 60 * 60 * 1000);
    const created = await db
      .selectFrom('uploads')
      .select(({ fn }) => [fn.countAll<number>().as('count')])
      .where('owner_id', '=', ownerId)
      .where('created_at', '>=', since)
      .executeTakeFirst();

    if (!quotaAllows(Number(created?.count ?? 0))) {
      throw new AppError('RATE_LIMITED', 'Quota quotidien d’envois atteint');
    }

    const row = await db
      .insertInto('uploads')
      .values({
        id: randomUUID(),
        owner_id: ownerId,
        purpose: input.purpose,
        content_type: input.content_type,
        byte_size: input.byte_size,
        status: 'pending',
      })
      .returning(['id', 'created_at'])
      .executeTakeFirstOrThrow();

    return {
      id: row.id,
      upload_url: `/uploads/${row.id}/content`,
      expires_at: new Date(row.created_at.getTime() + PENDING_TTL_MS).toISOString(),
    };
  }

  /** Écrit le contenu réel : type et taille vérifiés sur les octets reçus. */
  async writeContent(
    ownerId: string,
    uploadId: string,
    receivedType: string | undefined,
    bytes: Buffer,
  ): Promise<Upload> {
    const upload = await this.load(uploadId);
    assertOwner(upload.owner_id, ownerId);
    if (upload.status !== 'pending') {
      throw invalidState('Contenu déjà reçu pour ce fichier');
    }
    assertContentTypeMatches(upload.content_type, receivedType);
    assertWithinLimit(upload.purpose, bytes.length);

    await this.storage.write(upload.id, bytes);

    const updated = await db
      .updateTable('uploads')
      .set({
        status: 'ready',
        storage_key: upload.id,
        checksum: createHash('sha256').update(bytes).digest('hex'),
        byte_size: bytes.length,
        ready_at: this.now(),
      })
      .where('id', '=', upload.id)
      .returning(['id', 'owner_id', 'purpose', 'content_type', 'byte_size', 'status', 'created_at'])
      .executeTakeFirstOrThrow();

    return this.toApi(updated);
  }

  async metadata(uploadId: string): Promise<Upload> {
    return this.toApi(await this.load(uploadId));
  }

  /** Lecture binaire : le service ne sert que les fichiers réellement écrits. */
  async content(uploadId: string): Promise<{ contentType: string; bytes: Buffer }> {
    const upload = await this.load(uploadId);
    if (upload.status !== 'ready') {
      throw notFound('Fichier');
    }
    return {
      contentType: upload.content_type,
      bytes: await this.storage.read(upload.id),
    };
  }

  async attach(
    actorId: string,
    uploadId: string,
    input: AttachUploadInput,
  ): Promise<{ object_type: UploadObjectType; object_id: string }> {
    const upload = await this.load(uploadId);
    assertOwner(upload.owner_id, actorId);
    assertAttachable(upload.status);

    const existing = await db
      .selectFrom('upload_attachments')
      .select('id')
      .where('upload_id', '=', upload.id)
      .executeTakeFirst();

    if (existing) {
      return { object_type: input.object_type, object_id: input.object_id };
    }

    const attached = await this.attachedCount(upload.purpose, input.object_type, input.object_id);
    assertSlotAvailable(upload.purpose, attached);

    await db
      .insertInto('upload_attachments')
      .values({
        upload_id: upload.id,
        object_type: input.object_type,
        object_id: input.object_id,
        created_by: actorId,
      })
      .execute();

    return { object_type: input.object_type, object_id: input.object_id };
  }

  async listForObject(objectType: UploadObjectType, objectId: string): Promise<Upload[]> {
    const rows = await db
      .selectFrom('upload_attachments')
      .innerJoin('uploads', 'uploads.id', 'upload_attachments.upload_id')
      .select([
        'uploads.id',
        'uploads.owner_id',
        'uploads.purpose',
        'uploads.content_type',
        'uploads.byte_size',
        'uploads.status',
        'uploads.created_at',
      ])
      .where('upload_attachments.object_type', '=', objectType)
      .where('upload_attachments.object_id', '=', objectId)
      .where('uploads.status', '=', 'ready')
      .orderBy('upload_attachments.created_at', 'asc')
      .execute();

    return rows.map((row) => this.toApi(row));
  }

  async remove(ownerId: string, uploadId: string): Promise<void> {
    const upload = await this.load(uploadId);
    assertOwner(upload.owner_id, ownerId);

    await this.storage.remove(upload.id).catch(() => undefined);
    await db
      .updateTable('uploads')
      .set({ status: 'deleted', deleted_at: this.now() })
      .where('id', '=', upload.id)
      .execute();
  }

  private async load(uploadId: string): Promise<UploadRow> {
    const row = await db
      .selectFrom('uploads')
      .select(['id', 'owner_id', 'purpose', 'content_type', 'byte_size', 'status', 'created_at'])
      .where('id', '=', uploadId)
      .where('status', '!=', 'deleted')
      .executeTakeFirst();

    if (!row) {
      throw notFound('Fichier');
    }
    return row;
  }

  private async attachedCount(
    purpose: Upload['purpose'],
    objectType: UploadObjectType,
    objectId: string,
  ): Promise<number> {
    const result = await db
      .selectFrom('upload_attachments')
      .innerJoin('uploads', 'uploads.id', 'upload_attachments.upload_id')
      .select(({ fn }) => [fn.countAll<number>().as('count')])
      .where('upload_attachments.object_type', '=', objectType)
      .where('upload_attachments.object_id', '=', objectId)
      .where('uploads.purpose', '=', purpose)
      .executeTakeFirst();

    return Number(result?.count ?? 0);
  }

  private toApi(row: UploadRow): Upload {
    return {
      id: row.id,
      owner_id: row.owner_id,
      purpose: row.purpose,
      content_type: row.content_type,
      byte_size: row.byte_size,
      status: row.status,
      url: row.status === 'ready' ? this.url(row.id) : null,
      created_at: row.created_at.toISOString(),
    };
  }

  private url(id: string): string {
    const path = `/uploads/${id}/content`;
    return env.UPLOADS_PUBLIC_BASE_URL ? `${env.UPLOADS_PUBLIC_BASE_URL}${path}` : path;
  }
}
