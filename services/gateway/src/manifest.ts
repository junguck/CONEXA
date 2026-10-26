import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';

import { z } from 'zod';

export const RouteSchema = z.object({
  method: z.enum(['GET', 'POST', 'PATCH', 'PUT', 'DELETE']),
  path: z.string().startsWith('/'),
  auth: z.boolean().default(true),
});

export const ManifestSchema = z.object({
  service: z.string().min(2),
  base_path: z.string().default(''),
  upstream: z.url(),
  internal: z.boolean().default(false),
  routes: z.array(RouteSchema).min(1),
});

export type GatewayRoute = z.infer<typeof RouteSchema>;
export type ServiceManifest = z.infer<typeof ManifestSchema>;

export interface RouteMatch {
  manifest: ServiceManifest;
  route: GatewayRoute;
}

/** Lit `services/<nom>/gateway.routes.json` : un service s'ajoute sans toucher au gateway. */
export function loadManifests(directory = 'services'): ServiceManifest[] {
  const entries = readdirSync(directory, { withFileTypes: true }).filter((entry) =>
    entry.isDirectory(),
  );
  const manifests: ServiceManifest[] = [];

  for (const entry of entries) {
    const file = path.join(directory, entry.name, 'gateway.routes.json');
    try {
      const parsed = ManifestSchema.parse(JSON.parse(readFileSync(file, 'utf8')));
      manifests.push(parsed);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        continue;
      }
      throw new Error(`Manifeste invalide ${file} : ${(error as Error).message}`, { cause: error });
    }
  }

  return manifests;
}

function patternToRegExp(pattern: string): RegExp {
  const escaped = pattern
    .split('/')
    .map((segment) => {
      if (segment === '*') {
        return '.*';
      }
      if (segment.startsWith(':')) {
        return '[^/]+';
      }
      return segment.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    })
    .join('/');
  return new RegExp(`^${escaped}/?$`);
}

export function matchRoute(
  manifests: ServiceManifest[],
  method: string,
  pathname: string,
): RouteMatch | null {
  for (const manifest of manifests) {
    for (const route of manifest.routes) {
      if (route.method !== method) {
        continue;
      }
      const publicPath = `${manifest.base_path.replace(/\/$/, '')}${route.path}`;
      if (patternToRegExp(publicPath).test(pathname)) {
        return { manifest, route };
      }
    }
  }
  return null;
}
