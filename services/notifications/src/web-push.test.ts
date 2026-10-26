import {
  createDecipheriv,
  createECDH,
  generateKeyPairSync,
  hkdfSync,
  randomBytes,
} from 'node:crypto';

import { describe, expect, it } from 'vitest';

import {
  buildVapidToken,
  createEphemeral,
  encryptPushPayload,
  verifyVapidToken,
  type VapidKeys,
} from './web-push.js';

function vapidKeys(): VapidKeys {
  const { privateKey, publicKey } = generateKeyPairSync('ec', { namedCurve: 'prime256v1' });
  const der = publicKey.export({ format: 'der', type: 'spki' });
  // La clé brute est le point non compressé, à la fin du SPKI.
  const raw = der.subarray(der.length - 65);
  return {
    publicKey: raw.toString('base64url'),
    privateKey: privateKey.export({ format: 'pem', type: 'pkcs8' }).toString(),
    subject: 'mailto:contact@convexa.app',
  };
}

/** Déchiffrement côté navigateur (RFC 8291), joué par le test. */
function decryptForTest(
  body: Buffer,
  receiver: { privateKey: Buffer; publicKey: Buffer },
  authSecret: Buffer,
): Buffer {
  const salt = body.subarray(0, 16);
  const idLength = body.readUInt8(20);
  const senderPublic = body.subarray(21, 21 + idLength);
  const ciphertext = body.subarray(21 + idLength);

  const ecdh = createECDH('prime256v1');
  ecdh.setPrivateKey(receiver.privateKey);
  const shared = ecdh.computeSecret(senderPublic);

  const ikm = Buffer.from(
    hkdfSync(
      'sha256',
      shared,
      authSecret,
      Buffer.concat([
        Buffer.from('WebPush: info\0', 'utf8'),
        receiver.publicKey,
        senderPublic,
      ]),
      32,
    ),
  );
  const cek = Buffer.from(
    hkdfSync('sha256', ikm, salt, Buffer.from('Content-Encoding: aes128gcm\0', 'utf8'), 16),
  );
  const nonce = Buffer.from(
    hkdfSync('sha256', ikm, salt, Buffer.from('Content-Encoding: nonce\0', 'utf8'), 12),
  );

  const tag = ciphertext.subarray(ciphertext.length - 16);
  const decipher = createDecipheriv('aes-128-gcm', cek, nonce);
  decipher.setAuthTag(tag);
  return Buffer.concat([
    decipher.update(ciphertext.subarray(0, ciphertext.length - 16)),
    decipher.final(),
  ]);
}

describe('chiffrement Web Push', () => {
  it('chiffre pour le navigateur et rien que pour lui', () => {
    const receiverEcdh = createECDH('prime256v1');
    receiverEcdh.generateKeys();
    const receiver = {
      privateKey: receiverEcdh.getPrivateKey(),
      publicKey: receiverEcdh.getPublicKey(),
    };
    const authSecret = randomBytes(16);
    const message = { title: 'Nouveau défi', url: '/football/defis' };

    const encrypted = encryptPushPayload(
      Buffer.from(JSON.stringify(message), 'utf8'),
      {
        p256dh: receiver.publicKey.toString('base64url'),
        auth: authSecret.toString('base64url'),
      },
      createEphemeral(),
    );

    const plaintext = decryptForTest(encrypted.body, receiver, authSecret);
    // Dernier octet = séparateur de padding 0x02.
    expect(plaintext[plaintext.length - 1]).toBe(2);
    expect(JSON.parse(plaintext.subarray(0, plaintext.length - 1).toString('utf8'))).toEqual(
      message,
    );
  });

  it('refuse un secret d’authentification de mauvaise taille', () => {
    expect(() =>
      encryptPushPayload(Buffer.from('x'), {
        p256dh: randomBytes(65).toString('base64url'),
        auth: randomBytes(8).toString('base64url'),
      }),
    ).toThrow(/16 octets/);
  });
});

describe('jetons VAPID', () => {
  it('signe pour l’origine du service de push et se vérifie', () => {
    const keys = vapidKeys();
    const token = buildVapidToken('https://fcm.googleapis.com/wp/abc', keys);

    expect(token.authorization).toBe(`vapid t=${token.jwt}, k=${keys.publicKey}`);
    expect(verifyVapidToken(token.jwt, keys.publicKey)).toMatchObject({
      aud: 'https://fcm.googleapis.com',
      sub: keys.subject,
    });
  });

  it('refuse un jeton expiré', () => {
    const keys = vapidKeys();
    const token = buildVapidToken('https://push.example.com/1', keys, Date.now(), 60);
    expect(() => verifyVapidToken(token.jwt, keys.publicKey, Date.now() + 120_000)).toThrow(
      /expiré/,
    );
  });

  it('refuse une signature d’une autre clé', () => {
    const keys = vapidKeys();
    const other = vapidKeys();
    const token = buildVapidToken('https://push.example.com/1', keys);
    expect(() => verifyVapidToken(token.jwt, other.publicKey)).toThrow(/Signature/);
  });
});
