import type { Metadata } from 'next';

import { PlansScreen } from '../../../features/money/plans-screen';

export const metadata: Metadata = { title: 'Abonnement' };

export default function BillingPage() {
  return <PlansScreen />;
}
