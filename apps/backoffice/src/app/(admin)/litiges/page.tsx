import { ConsoleHeading } from '@conexa/ui';
import type { Metadata } from 'next';

import { DisputesBoard } from '../../../features/disputes/disputes-board';
import { DISPUTES } from '../../../shell/fixtures';

export const metadata: Metadata = { title: 'Litiges ouverts' };

export default function DisputesPage() {
  const urgent = DISPUTES.filter((dispute) => dispute.urgent).length;

  return (
    <div className="flex flex-col gap-5">
      <ConsoleHeading
        title="Litiges ouverts"
        aside={
          <span className="font-mono text-xs uppercase tracking-[.08em] text-muted">
            {DISPUTES.length} à traiter{urgent > 0 ? ` · ${urgent} urgent` : ''}
          </span>
        }
      />
      <DisputesBoard />
    </div>
  );
}
