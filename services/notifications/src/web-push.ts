import {
  createCipheriv,
  createECDH,
  createPrivateKey,
  createPublicKey,
  hkdfSync,
  randomBytes,
  sign,
  verify as verifyRaw,
} from 'node:crypto';

/**
 * Web Push (RFC 8030 / 8291 / 8292) avec les primitives de Node : aucune
 * dépendance externe, et la charge utile est chiffrée pour le navigateur seul.
 * Les clés VAPID identifient l'application ; sans elles le canal `console`
 * prend le relais (voir `push.provider.ts`).
 */

const RECORD_SIZE = 4096;

export function encodeBase64Url(buffer: Buffer): string {
  return buffer.toString('base64url');
}

export function decodeBase64Url(value: string): Buffer {
  return Buffer.from(value, 'base64url');
}

export interface VapidKeys {
  /** Clé publique non compressée (65 octets), base64url. */
  publicKey: string;
  /** Clé privée PEM EC P-256. */
  privateKey: string;
  /** Contact exigé par les services de push : `mailto:` ou URL. */
  subject: string;
}

export interface VapidToken {
  jwt: string;
  /** Valeur du champ `Authorization` complet. */
  authorization: string;
}

/** Origine de l'endpoint : l'audience du JWT est le service de push, pas l'app. */
export function endpointOrigin(endpoint: string): string {
  return new URL(endpoint).origin;
}

/** Clé publique brute (65 octets) vers une clé Node, pour vérifier une signature. */
export function publicKeyFromRaw(raw: Buffer) {
  if (raw.length !== 65 || raw[0] !== 4) {
    throw new Error('Clé publique P-256 non compressée attendue (65 octets, préfixe 0x04)');
  }
  return createPublicKey({
    key: {
      kty: 'EC',
      crv: 'P-256',
      x: raw.subarray(1, 33).toString('base64url'),
      y: raw.subarray(33, 65).toString('base64url'),
    },
    format: 'jwk',
  });
}

export function buildVapidToken(
  endpoint: string,
  keys: VapidKeys,
  now: number = Date.now(),
  lifetimeSeconds = 12 * 60 * 60,
): VapidToken {
  const header = encodeBase64Url(Buffer.from(JSON.stringify({ typ: 'JWT', alg: 'ES256' })));
  const claims = encodeBase64Url(
    Buffer.from(
      JSON.stringify({
        aud: endpointOrigin(endpoint),
        exp: Math.floor(now / 1000) + lifetimeSeconds,
        sub: keys.subject,
      }),
    ),
  );
  const unsigned = `${header}.${claims}`;
  // ES256 = r||s, pas la signature DER par défaut d'OpenSSL.
  const signature = sign('sha256', Buffer.from(unsigned), {
    key: createPrivateKey(keys.privateKey),
    dsaEncoding: 'ieee-p1363',
  });
  const jwt = `${unsigned}.${encodeBase64Url(signature)}`;
  return { jwt, authorization: `vapid t=${jwt}, k=${keys.publicKey}` };
}

/** Vérifie un jeton VAPID : testé, et utile au diagnostic d'un refus 401. */
export function verifyVapidToken(
  token: string,
  publicKey: string,
  now: number = Date.now(),
): { aud: string; sub: string; exp: number } {
  const [header, claims, signature] = token.split('.');
  if (!header || !claims || !signature) {
    throw new Error('Jeton VAPID mal formé');
  }
  const signed = `${header}.${claims}`;
  const ok = verifyRaw(
    'sha256',
    Buffer.from(signed),
    { key: publicKeyFromRaw(decodeBase64Url(publicKey)), dsaEncoding: 'ieee-p1363' },
    decodeBase64Url(signature),
  );
  if (!ok) {
    throw new Error('Signature VAPID invalide');
  }
  const parsed = JSON.parse(decodeBase64Url(claims).toString('utf8')) as {
    aud: string;
    sub: string;
    exp: number;
  };
  if (parsed.exp * 1000 <= now) {
    throw new Error('Jeton VAPID expiré');
  }
  return parsed;
}

export interface EncryptedPayload {
  body: Buffer;
  salt: Buffer;
  senderPublicKey: Buffer;
}

export function createEphemeral(): { privateKey: Buffer; publicKey: Buffer } {
  const ecdh = createECDH('prime256v1');
  ecdh.generateKeys();
  return { privateKey: ecdh.getPrivateKey(), publicKey: ecdh.getPublicKey() };
}

/**
 * Chiffre une charge utile pour un abonnement (RFC 8291, `aes128gcm`).
 * `sender` permet de fixer la paire éphémère dans les tests.
 */
export function encryptPushPayload(
  payload: Buffer,
  subscription: { p256dh: string; auth: string },
  sender?: { privateKey: Buffer; publicKey: Buffer },
): EncryptedPayload {
  const ephemeral = sender ?? createEphemeral();
  const authSecret = decodeBase64Url(subscription.auth);
  if (authSecret.length !== 16) {
    throw new Error("Le secret d'authentification doit faire 16 octets");
  }
  const uaPublic = decodeBase64Url(subscription.p256dh);

  const ecdh = createECDH('prime256v1');
  ecdh.setPrivateKey(ephemeral.privateKey);
  const shared = ecdh.computeSecret(uaPublic);

  const keyInfo = Buffer.concat([
    Buffer.from('WebPush: info\0', 'utf8'),
    uaPublic,
    ephemeral.publicKey,
  ]);
  const ikm = Buffer.from(hkdfSync('sha256', shared, authSecret, keyInfo, 32));

  const salt = randomBytes(16);
  const cek = Buffer.from(
    hkdfSync('sha256', ikm, salt, Buffer.from('Content-Encoding: aes128gcm\0', 'utf8'), 16),
  );
  const nonce = Buffer.from(
    hkdfSync('sha256', ikm, salt, Buffer.from('Content-Encoding: nonce\0', 'utf8'), 12),
  );

  // Séparateur de padding final : 0x02 pour le dernier (et unique) enregistrement.
  const plaintext = Buffer.concat([payload, Buffer.from([2])]);
  const cipher = createCipheriv('aes-128-gcm', cek, nonce);
  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final(), cipher.getAuthTag()]);

  const header = Buffer.alloc(16 + 4 + 1 + ephemeral.publicKey.length);
  salt.copy(header, 0);
  header.writeUInt32BE(RECORD_SIZE, 16);
  header.writeUInt8(ephemeral.publicKey.length, 20);
  ephemeral.publicKey.copy(header, 21);

  return { body: Buffer.concat([header, ciphertext]), salt, senderPublicKey: ephemeral.publicKey };
}
