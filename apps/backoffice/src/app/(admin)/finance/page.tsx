import { ConsoleHeading } from '@conexa/ui';
import type { Metadata } from 'next';

import { FinanceLedger } from '../../../features/finance/finance-ledger';

export const metadata: Metadata = { title: 'Flux financiers' };

export default function FinancePage() {
  return (
    <div className="flex flex-col gap-5">
      <ConsoleHeading title="Flux financiers" />
      <FinanceLedger />
    </div>
  );
}
