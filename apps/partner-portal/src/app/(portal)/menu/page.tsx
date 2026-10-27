import { ConsoleHeading } from '@conexa/ui';
import type { Metadata } from 'next';

import { MenuEditor } from '../../../features/menu/menu-editor';

export const metadata: Metadata = { title: 'Menu duo' };

export default function MenuPage() {
  return (
    <div className="flex flex-col gap-5">
      <ConsoleHeading title="Menu duo" />
      <MenuEditor />
    </div>
  );
}
