import pino, { type Logger, type LoggerOptions } from 'pino';

/** Champs qui ne doivent jamais apparaître en clair dans un journal (STACK.md §6 et §8). */
export const REDACTED_PATHS = [
  'req.headers.authorization',
  'req.headers.cookie',
  'headers.authorization',
  'headers.cookie',
  'phone',
  'phone_msisdn',
  'whatsapp',
  'matricule',
  'code',
  'password',
  'token',
  'access_token',
  'refresh_token',
  '*.phone',
  '*.phone_msisdn',
  '*.whatsapp',
  '*.matricule',
  '*.code',
  '*.password',
  '*.token',
  '*.access_token',
  '*.refresh_token',
] as const;

export function createLogger(name: string, options: { level?: string } = {}): Logger {
  const level = options.level ?? process.env.LOG_LEVEL ?? 'info';
  const config: LoggerOptions = {
    name,
    level,
    base: { service: name },
    redact: { paths: [...REDACTED_PATHS], censor: '[masqué]' },
  };
  return pino(config);
}

/** Masque un numéro WhatsApp comme le fait l'API : « +237 6** *** **12 ». */
export function maskPhone(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  const tail = digits.slice(-2).padStart(2, '*');
  return `+237 6** *** **${tail}`;
}

/** Masque un matricule : garde les deux premiers et deux derniers caractères. */
export function maskMatricule(matricule: string): string {
  if (matricule.length <= 4) {
    return '*'.repeat(matricule.length);
  }
  return `${matricule.slice(0, 2)}${'*'.repeat(matricule.length - 4)}${matricule.slice(-2)}`;
}
