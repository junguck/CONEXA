import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';

import { Providers } from '../shell/providers';

import './globals.css';

export const metadata: Metadata = {
  applicationName: 'Convexa',
  title: {
    default: 'Convexa : le campus en un geste',
    template: '%s · Convexa',
  },
  description:
    'Football inter-équipes, rencontres au restaurant, talents et services entre étudiants.',
  manifest: '/manifest.webmanifest',
  icons: {
    icon: [
      { url: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
      { url: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
    apple: [{ url: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' }],
  },
  appleWebApp: {
    capable: true,
    title: 'Convexa',
    statusBarStyle: 'black-translucent',
  },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: '#07070A',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="fr">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
