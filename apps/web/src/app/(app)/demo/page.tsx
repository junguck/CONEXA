import type { Metadata } from 'next';

import { DemoScreen } from '../../../features/demo/screen';

export const metadata: Metadata = { title: 'Écran de démonstration' };

export default function DemoPage() {
  return <DemoScreen />;
}
