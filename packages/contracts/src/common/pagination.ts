import { z } from 'zod';

export const PAGE_DEFAULT_LIMIT = 20;
export const PAGE_MAX_LIMIT = 100;

export const PageQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(PAGE_MAX_LIMIT).default(PAGE_DEFAULT_LIMIT),
  cursor: z.string().min(1).max(512).optional(),
});

export type PageQuery = z.infer<typeof PageQuerySchema>;

/** Une page d'API : `{ data, next_cursor }` (API.md §1). */
export function pageSchema<T extends z.ZodType>(item: T) {
  return z.object({
    data: z.array(item),
    next_cursor: z.string().nullable(),
  });
}

export function encodeCursor(value: string): string {
  return Buffer.from(value, 'utf8').toString('base64url');
}

export function decodeCursor(cursor: string): string {
  return Buffer.from(cursor, 'base64url').toString('utf8');
}
