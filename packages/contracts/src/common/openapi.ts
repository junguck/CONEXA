import { z } from 'zod';

/**
 * Schéma OpenAPI 3.1 dérivé d'un schéma Zod.
 *
 * OpenAPI 3.1 accepte JSON Schema 2020-12 : `z.toJSONSchema` suffit, sans
 * dépendance `zod-to-openapi` supplémentaire (voir ADR 0004, §OpenAPI).
 * `$schema` est retiré : un composant OpenAPI n'est pas un document autonome.
 */
export function toOpenApiSchema(schema: z.ZodType): Record<string, unknown> {
  const json = z.toJSONSchema(schema, { target: 'draft-2020-12', unrepresentable: 'any' });
  const { $schema: _ignored, ...rest } = json as Record<string, unknown>;
  return rest;
}

/** Fragment `components.schemas` réutilisable par l'OpenAPI de chaque service. */
export function openApiComponents(schemas: Record<string, z.ZodType>): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(schemas).map(([name, schema]) => [name, toOpenApiSchema(schema)]),
  );
}
