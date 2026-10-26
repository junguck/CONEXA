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
