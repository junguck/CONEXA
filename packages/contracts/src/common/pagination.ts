import { Buffer } from 'node:buffer';
import { z } from 'zod';
import { cursorSchema, pageLimitSchema } from './primitives.js';

/** Paramètres de liste : `?limit=20&cursor=<opaque>` (`docs/product/API.md` §1). */
export const cursorQuerySchema = z.object({
  limit: pageLimitSchema,
  cursor: cursorSchema.optional(),
});

export type CursorQuery = z.infer<typeof cursorQuerySchema>;

/** `{ "data": [...], "next_cursor": "..." | null }` — forme de toute liste. */
export function pageSchema<T extends z.ZodType>(item: T) {
  return z.object({
    data: z.array(item),
    next_cursor: cursorSchema.nullable(),
  });
}

/** Type compagnon de `pageSchema`, pour les signatures de service. */
export interface Page<T> {
  data: T[];
  next_cursor: string | null;
}

/**
 * Alias v1 (ADR 0007) des paramètres de liste. Le canonique n'impose pas de
 * longueur maximale au curseur : il accepte donc un sur-ensemble de v1.
 */
export const PageQuerySchema = cursorQuerySchema;
export type PageQuery = CursorQuery;

/**
 * Curseur opaque base64url, côté serveur uniquement (`Buffer` Node).
 * Le client ne fait que le renvoyer tel quel.
 */
export function encodeCursor(value: string): string {
  return Buffer.from(value, 'utf8').toString('base64url');
}

export function decodeCursor(cursor: string): string {
  return Buffer.from(cursor, 'base64url').toString('utf8');
}
