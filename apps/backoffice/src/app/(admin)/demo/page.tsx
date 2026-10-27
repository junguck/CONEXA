import { ConsoleHeading } from '@conexa/ui';
import type { Metadata } from 'next';

import { DemoScreen } from '../../../features/demo/screen';

export const metadata: Metadata = { title: 'Démo domaine' };

export default function DemoPage() {
  return (
    <div className="flex flex-col gap-5">
      <ConsoleHeading title="Démo domaine" />
      <DemoScreen />
    </div>
  );
}
