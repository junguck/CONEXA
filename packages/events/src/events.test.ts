import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import {
  EventPiiError,
  assertNoPii,
  buildEvent,
  eventEnvelopeSchema,
  findForbiddenKeys,
  parseEvent,
} from './index.js';

const traceparent = '00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01';

describe('enveloppe d’événement', () => {
  it('construit une enveloppe valide par défaut', () => {
    const event = buildEvent({
      type: 'user.approved',
      producer: 'identity',
      payload: { user_id: '0b27a4d2-3d13-4f01-8b3a-9a9f3f6a6f11' },
      occurredAt: new Date('2026-10-26T10:00:00Z'),
    });
    expect(event.version).toBe(1);
    expect(event.occurred_at).toBe('2026-10-26T10:00:00.000Z');
    expect(eventEnvelopeSchema.safeParse(event).success).toBe(true);
  });

  it('refuse un type, un producteur ou un traceparent mal formés', () => {
    const base = { type: 'user.approved', producer: 'identity', payload: {} };
    expect(eventEnvelopeSchema.safeParse(buildEvent(base)).success).toBe(true);
    expect(() => buildEvent({ ...base, type: 'UserApproved' })).toThrow();
    expect(() => buildEvent({ ...base, producer: 'Identity' })).toThrow();
    expect(() => buildEvent({ ...base, traceparent: 'nope' })).toThrow();
  });

  it('accepte un traceparent W3C', () => {
    const event = buildEvent({
      type: 'payment.escrowed',
      producer: 'payments',
      payload: {},
      traceparent,
    });
    expect(event.traceparent).toBe(traceparent);
  });
});

describe('garde-fou PII', () => {
  it('trouve une clé interdite imbriquée dans un tableau', () => {
    const payload = { user: { contacts: [{ whatsapp: '+237 6 00 00 00 00' }] } };
    expect(findForbiddenKeys(payload)).toEqual(['user.contacts[0].whatsapp']);
    expect(() => assertNoPii(payload)).toThrow(EventPiiError);
  });

  it('laisse passer les champs publics que user.updated doit transporter', () => {
    expect(() =>
      assertNoPii({ user_id: 'uuid', first_name: 'Aïcha', photo_url: 'https://x' }),
    ).not.toThrow();
  });

  it('refuse un numéro même quand il est masqué en valeur', () => {
    expect(() =>
      parseEvent({
        id: '0b27a4d2-3d13-4f01-8b3a-9a9f3f6a6f11',
        type: 'user.updated',
        version: 1,
        occurred_at: '2026-10-26T10:00:00Z',
        producer: 'identity',
        payload: { email: 'aicha@example.com' },
      }),
    ).toThrow(EventPiiError);
  });

  it('le message d’erreur ne contient jamais la valeur', () => {
    const error = new EventPiiError(['email']);
    expect(error.message).not.toContain('@');
  });
});

describe('JSON Schema versionné', () => {
  it('le fichier committé correspond au schéma courant', () => {
    const committed = JSON.parse(
      readFileSync(new URL('./common/schemas/envelope.v1.json', import.meta.url), 'utf8'),
    );
    expect(z.toJSONSchema(eventEnvelopeSchema, { target: 'draft-2020-12' })).toEqual(committed);
  });
});
