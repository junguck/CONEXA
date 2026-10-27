import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';

import './globals.css';

export const metadata: Metadata = {
  applicationName: 'Convexa',
  title: {
    default: 'Back-office Convexa',
    template: '%s · Back-office Convexa',
  },
  description: 'Validation des comptes, litiges et flux financiers du campus.',
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#07070A',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="fr">
      <body>{children}</body>
    </html>
  );
}
