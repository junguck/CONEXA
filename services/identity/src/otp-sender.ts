import { AppError } from '@conexa/errors';
import { createLogger, maskPhone } from '@conexa/service-kit';

/**
 * Envoi des codes OTP derrière une interface : le service ne dépend d'aucun
 * fournisseur. `console` journalise le code masqué pour le développement ;
 * `sms` passe par MBOASMS (voir `docs/vendor/mboasms.md` et l'ADR 0010) et
 * refuse de démarrer sans URL ni clé, plutôt que d'échouer à la première
 * inscription.
 *
 * WhatsApp n'est pas branché : la décision produit du 2026-10-29 est un OTP
 * par SMS uniquement.
 */
export interface OtpSender {
  send(whatsapp: string, code: string): Promise<void>;
}

const logger = createLogger('identity-otp');

/** Développement : le code n'est jamais envoyé, seulement journalisé masqué. */
export class ConsoleOtpSender implements OtpSender {
  async send(whatsapp: string, code: string): Promise<void> {
    logger.info({ whatsapp: maskPhone(whatsapp) }, `OTP de développement : ${code}`);
  }
}

export interface SmsSenderOptions {
  /** URL d'envoi fournie par MBOASMS (aucune valeur par défaut : jamais devinée). */
  url: string;
  apiKey: string;
  /** Émetteur affiché sur le téléphone. */
  sender: string;
}

/**
 * Corps de l'envoi SMS, isolé pour être testé sans réseau.
 *
 * Le format exact n'est **pas encore confirmé** par la documentation MBOASMS :
 * il est concentré ici pour qu'une seule fonction change quand elle arrivera
 * (voir `docs/vendor/mboasms.md`, « à confirmer »).
 */
export function buildSmsPayload(
  to: string,
  code: string,
  sender: string,
  ttlMinutes = 10,
): Record<string, unknown> {
  return {
    sender,
    recipient: to,
    message: `Convexa : votre code est ${code}. Il expire dans ${ttlMinutes} minutes.`,
  };
}

export class MboaSmsSender implements OtpSender {
  constructor(private readonly options: SmsSenderOptions) {}

  async send(whatsapp: string, code: string): Promise<void> {
    const response = await fetch(this.options.url, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        // MBOASMS remet la clé d'API en en-tête `Authorization`.
        authorization: `Bearer ${this.options.apiKey}`,
      },
      body: JSON.stringify(buildSmsPayload(whatsapp, code, this.options.sender)),
    });

    if (!response.ok) {
      // Le numéro n'apparaît jamais dans l'erreur : seul un statut est journalisé.
      throw new AppError('INTERNAL_ERROR', 'Envoi SMS refusé', {
        status: response.status,
      });
    }
  }
}

export type OtpSenderConfig =
  { provider: 'console' } | { provider: 'sms'; url?: string; apiKey?: string; sender: string };

export function createOtpSender(config: OtpSenderConfig): OtpSender {
  if (config.provider === 'console') {
    return new ConsoleOtpSender();
  }
  if (!config.url || !config.apiKey) {
    throw new AppError('INTERNAL_ERROR', 'OTP_PROVIDER=sms exige MBOASMS_URL et MBOASMS_API_KEY');
  }
  return new MboaSmsSender({
    url: config.url,
    apiKey: config.apiKey,
    sender: config.sender,
  });
}
