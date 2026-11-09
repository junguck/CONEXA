import type { Metadata } from 'next';

import { InvoicesScreen } from '../../../../features/money/invoices-screen';

export const metadata: Metadata = { title: 'Factures' };

export default function InvoicesPage() {
  return <InvoicesScreen />;
}
