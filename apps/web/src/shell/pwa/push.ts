/**
 * Abonnement aux notifications push (Web Push + VAPID). La clé publique vient
 * de la configuration du serveur (`NEXT_PUBLIC_VAPID_PUBLIC_KEY`), jamais un
 * secret. L'envoi appartient au service Realtime (F4.x).
 */

/** Convertit une clé VAPID base64url en tableau d'octets pour `pushManager.subscribe`. */
export function urlBase64ToUint8Array(base64Url: string): Uint8Array<ArrayBuffer> {
  const padding = '='.repeat((4 - (base64Url.length % 4)) % 4);
  const base64 = (base64Url + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(base64);
  const bytes = new Uint8Array(new ArrayBuffer(raw.length));
  for (let index = 0; index < raw.length; index += 1) {
    bytes[index] = raw.charCodeAt(index);
  }
  return bytes;
}

export interface PushSubscriptionPayload {
  endpoint: string;
  keys: { p256dh: string; auth: string };
}

export function toPayload(subscription: PushSubscription): PushSubscriptionPayload | null {
  const json = subscription.toJSON();
  if (!json.endpoint || !json.keys?.p256dh || !json.keys.auth) return null;
  return {
    endpoint: json.endpoint,
    keys: { p256dh: json.keys.p256dh, auth: json.keys.auth },
  };
}

/**
 * Demande l'autorisation puis abonne l'appareil. À appeler sur un geste
 * explicite de l'utilisateur (jamais au chargement).
 */
export async function subscribeToPush(
  vapidPublicKey: string,
): Promise<PushSubscriptionPayload | null> {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) return null;
  if (!vapidPublicKey) return null;

  const permission = await Notification.requestPermission();
  if (permission !== 'granted') return null;

  const registration = await navigator.serviceWorker.ready;
  const existing = await registration.pushManager.getSubscription();
  const subscription =
    existing ??
    (await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
    }));

  return toPayload(subscription);
}
