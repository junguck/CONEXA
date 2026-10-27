import type { Metadata } from 'next';

import { AccountsTable } from '../../features/accounts/accounts-table';
import { ACCOUNT_REQUESTS } from '../../shell/fixtures';
import { ConsoleHeading } from '@conexa/ui';

export const metadata: Metadata = { title: 'Comptes à valider' };

export default function ValidationPage() {
  const pending = ACCOUNT_REQUESTS.filter((request) => request.state === 'pending').length;

  return (
    <div className="flex flex-col gap-5">
      <ConsoleHeading
        title="Comptes à valider"
        aside={
          <span className="font-mono text-xs uppercase tracking-[.08em] text-muted">
            {pending} demandes en attente
          </span>
        }
      />
      <AccountsTable />
    </div>
  );
}
