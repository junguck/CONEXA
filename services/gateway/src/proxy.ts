import http from 'node:http';
import https from 'node:https';

import type { Request, Response } from 'express';

const HOP_BY_HOP = new Set([
  'connection',
  'keep-alive',
  'proxy-authenticate',
  'proxy-authorization',
  'te',
  'trailer',
  'transfer-encoding',
  'upgrade',
  'host',
  'content-length',
]);

/** Transmet la requête au service et renvoie sa réponse, sans tamponner le corps. */
export function proxyRequest(
  request: Request,
  response: Response,
  upstream: string,
  pathname: string,
  extraHeaders: Record<string, string>,
): void {
  const target = new URL(upstream);
  const transport = target.protocol === 'https:' ? https : http;

  const headers: Record<string, string | string[]> = {};
  for (const [name, value] of Object.entries(request.headers)) {
    if (
      value === undefined ||
      HOP_BY_HOP.has(name.toLowerCase()) ||
      name.toLowerCase().startsWith('x-user-')
    ) {
      continue;
    }
    headers[name] = value;
  }

  const proxyRequest_ = transport.request(
    {
      protocol: target.protocol,
      hostname: target.hostname,
      port: target.port || (target.protocol === 'https:' ? 443 : 80),
      method: request.method,
      path: pathname,
      headers: { ...headers, ...extraHeaders },
    },
    (upstreamResponse) => {
      response.writeHead(upstreamResponse.statusCode ?? 502, upstreamResponse.headers);
      upstreamResponse.pipe(response);
    },
  );

  proxyRequest_.on('error', () => {
    if (!response.headersSent) {
      response.status(502).json({
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Service indisponible',
          request_id: (request as Request & { id?: string }).id ?? 'req_unknown',
        },
      });
    }
  });

  request.pipe(proxyRequest_);
}
