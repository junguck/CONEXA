/**
 * Inbox : trace des messages déjà traités par un consommateur.
 * Livraison au moins une fois ⇒ le traitement est idempotent par `(consumer, messageId)`.
 */
export interface InboxStore {
  has(consumer: string, messageId: string): Promise<boolean>;
  record(consumer: string, messageId: string, processedAt: Date): Promise<void>;
}

export type ConsumeResult = 'duplicate' | 'handled';

/**
 * Traite un message une seule fois : si l'inbox l'a déjà vu, retour immédiat.
 * Une erreur du traitement n'inscrit rien : le message pourra être repris.
 */
export async function consumeIdempotent(
  inbox: InboxStore,
  consumer: string,
  messageId: string,
  handler: () => Promise<void>,
  now: () => Date = () => new Date(),
): Promise<ConsumeResult> {
  if (await inbox.has(consumer, messageId)) return 'duplicate';
  await handler();
  await inbox.record(consumer, messageId, now());
  return 'handled';
}
