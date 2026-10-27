import type { AccountStatus } from '@conexa/contracts';
import { AppError, validationError } from '@conexa/errors';

/** Un compte `pending`, suspendu, banni ou supprimé n'utilise pas l'application. */
export function assertCanUseApp(status: AccountStatus | 'deleted'): void {
  if (status === 'pending') {
    throw new AppError('ACCOUNT_PENDING', 'Compte en attente de validation');
  }
  if (status === 'suspended' || status === 'banned') {
    throw new AppError('ACCOUNT_SUSPENDED', 'Compte suspendu');
  }
  if (status === 'deleted') {
    throw validationError('Compte supprimé');
  }
}
