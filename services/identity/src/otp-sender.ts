import { AppError } from '@conexa/errors';
import { createLogger, maskPhone } from '@conexa/service-kit';

/**
 * Envoi des codes OTP derrière une interface : le service ne dépend d'aucun
 * fournisseur. Tant que le fournisseur WhatsApp n'est pas choisi (décision
 * humaine), `console` journalise le code masqué ; `whatsapp` exige une URL et un
 * jeton, et refuse de démarrer sans eux plutôt que d'échouer à la première
 * inscription.
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

export interface WhatsappSenderOptions {
  baseUrl: string;
  token: string;
  templateName: string;
}

/** Charge utile d'un envoi WhatsApp Cloud API, isolée pour être testée. */
export function buildWhatsappPayload(
  to: string,
  code: string,
  templateName: string,
): Record<string, unknown> {
  return {
    messaging_product: 'whatsapp',
    to,
    type: 'template',
    template: {
      name: templateName,
      language: { code: 'fr' },
      components: [{ type: 'body', parameters: [{ type: 'text', text: code }] }],
    },
  };
}

export class WhatsappOtpSender implements OtpSender {
  constructor(private readonly options: WhatsappSenderOptions) {}

  async send(whatsapp: string, code: string): Promise<void> {
    const response = await fetch(`${this.options.baseUrl}/messages`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${this.options.token}`,
      },
      body: JSON.stringify(buildWhatsappPayload(whatsapp, code, this.options.templateName)),
    });

    if (!response.ok) {
      // Le numéro n'apparaît pas dans l'erreur : seul un statut est journalisé.
      throw new AppError('INTERNAL_ERROR', 'Envoi WhatsApp refusé', {
        status: response.status,
      });
    }
  }
}

export type OtpSenderConfig =
  | { provider: 'console' }
  | { provider: 'whatsapp'; baseUrl?: string; token?: string; templateName: string };

export function createOtpSender(config: OtpSenderConfig): OtpSender {
  if (config.provider === 'console') {
    return new ConsoleOtpSender();
  }
  if (!config.baseUrl || !config.token) {
    throw new AppError(
      'INTERNAL_ERROR',
      'OTP_PROVIDER=whatsapp exige WHATSAPP_OTP_URL et WHATSAPP_OTP_TOKEN',
    );
  }
  return new WhatsappOtpSender({
    baseUrl: config.baseUrl,
    token: config.token,
    templateName: config.templateName,
  });
}
