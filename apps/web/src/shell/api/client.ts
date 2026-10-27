import { messageForCode } from './errors';

/** Enveloppe de pagination par curseur de `API.md` §1. */
export interface Page<T> {
  data: T[];
  next_cursor: string | null;
}

interface ApiErrorBody {
  error?: {
    code?: string;
    message?: string;
    details?: Record<string, unknown>;
    request_id?: string;
  };
}

export interface ApiErrorInit {
  code: string;
  status?: number;
  details?: Record<string, unknown>;
  requestId?: string;
  message: string;
}

/** Erreur d'API normalisée : le code métier reste disponible pour l'écran. */
export class ApiError extends Error {
  readonly code: string;
  readonly status?: number;
  readonly details?: Record<string, unknown>;
  readonly requestId?: string;

  constructor(init: ApiErrorInit) {
    super(init.message);
    this.name = 'ApiError';
    this.code = init.code;
    if (init.status !== undefined) this.status = init.status;
    if (init.details !== undefined) this.details = init.details;
    if (init.requestId !== undefined) this.requestId = init.requestId;
  }
}

export interface RequestOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
  body?: unknown;
  query?: Record<string, string | number | boolean | undefined | null>;
  /** Obligatoire sur les POST listés dans `API.md` §1. */
  idempotencyKey?: string;
  signal?: AbortSignal;
}

export interface ApiClientOptions {
  baseUrl: string;
  /** Jeton JWT fourni par le service Identity (F1.x). */
  getToken?: () => string | null | Promise<string | null>;
  fetchImpl?: typeof fetch;
}

function buildUrl(baseUrl: string, path: string, query: RequestOptions['query']): string {
  const url = new URL(path.replace(/^\//, ''), baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`);
  for (const [key, value] of Object.entries(query ?? {})) {
    if (value !== undefined && value !== null && value !== '') {
      url.searchParams.set(key, String(value));
    }
  }
  return url.toString();
}

/**
 * Client HTTP de la PWA : transport, authentification et normalisation des
 * erreurs. Les types de réponse viennent de `@conexa/contracts` via `endpoints`.
 */
export function createApiClient({ baseUrl, getToken, fetchImpl = fetch }: ApiClientOptions) {
  async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
    const token = await getToken?.();
    const headers: Record<string, string> = { Accept: 'application/json' };
    if (options.body !== undefined) headers['Content-Type'] = 'application/json';
    if (token) headers['Authorization'] = `Bearer ${token}`;
    if (options.idempotencyKey) headers['Idempotency-Key'] = options.idempotencyKey;

    let response: Response;
    try {
      response = await fetchImpl(buildUrl(baseUrl, path, options.query), {
        method: options.method ?? 'GET',
        headers,
        body: options.body === undefined ? undefined : JSON.stringify(options.body),
        ...(options.signal ? { signal: options.signal } : {}),
        credentials: 'same-origin',
      });
    } catch {
      throw new ApiError({ code: 'NETWORK_ERROR', message: messageForCode('NETWORK_ERROR') });
    }

    if (response.status === 204) return undefined as unknown as T;

    const payload: unknown = await response.json().catch(() => null);

    if (!response.ok) {
      const body = payload as ApiErrorBody | null;
      const code = body?.error?.code ?? 'INVALID_RESPONSE';
      throw new ApiError({
        code,
        status: response.status,
        message: messageForCode(code, body?.error?.message),
        ...(body?.error?.details ? { details: body.error.details } : {}),
        ...(body?.error?.request_id ? { requestId: body.error.request_id } : {}),
      });
    }

    if (payload === null) {
      throw new ApiError({
        code: 'INVALID_RESPONSE',
        status: response.status,
        message: messageForCode('INVALID_RESPONSE'),
      });
    }

    return payload as T;
  }

  return {
    request,
    get: <T>(path: string, options: Omit<RequestOptions, 'method' | 'body'> = {}) =>
      request<T>(path, { ...options, method: 'GET' }),
    post: <T>(path: string, body: unknown, options: Omit<RequestOptions, 'method' | 'body'> = {}) =>
      request<T>(path, { ...options, method: 'POST', body }),
    page: <T>(path: string, options: Omit<RequestOptions, 'method' | 'body'> = {}) =>
      request<Page<T>>(path, { ...options, method: 'GET' }),
  };
}

export type ApiClient = ReturnType<typeof createApiClient>;

/**
 * Instance par défaut : la Gateway écoute sur le port 3000 en local. En
 * production, `NEXT_PUBLIC_API_URL` porte l'URL publique (`/api/v1` inclus).
 * L'accès direct (pas d'index) permet à Next d'inliner la variable au build.
 */
export const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000';

export const apiClient = createApiClient({ baseUrl: API_BASE_URL });
