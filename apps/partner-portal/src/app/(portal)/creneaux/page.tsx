import { ConsoleHeading } from '@conexa/ui';
import type { Metadata } from 'next';

import { ServiceSlots } from '../../../features/slots/service-slots';

export const metadata: Metadata = { title: 'Créneaux' };

export default function SlotsPage() {
  return (
    <div className="flex flex-col gap-5">
      <ConsoleHeading title="Créneaux de service" />
      <ServiceSlots />
    </div>
  );
}
