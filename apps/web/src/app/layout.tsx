import type { Metadata } from 'next';
import type { ReactNode } from 'react';

import { CookieConsent } from '../components/cookie-consent';

import './globals.css';

export const metadata: Metadata = {
  title: {
    default: 'Roventra | Pet-care business software, beautifully connected',
    template: '%s | Roventra',
  },
  description:
    'A modern website, booking experience, and operating platform for boarding, daycare, and grooming businesses.',
  icons: {
    icon: [
      {
        url: '/brand/roventra-logo-kit/roventra-favicon-32.png',
        sizes: '32x32',
        type: 'image/png',
      },
      {
        url: '/brand/roventra-logo-kit/roventra-favicon-64.png',
        sizes: '64x64',
        type: 'image/png',
      },
      {
        url: '/brand/roventra-logo-kit/roventra-favicon-192.png',
        sizes: '192x192',
        type: 'image/png',
      },
      {
        url: '/brand/roventra-logo-kit/roventra-favicon-512.png',
        sizes: '512x512',
        type: 'image/png',
      },
    ],
    apple: [
      {
        url: '/brand/roventra-logo-kit/roventra-favicon-192.png',
        sizes: '192x192',
        type: 'image/png',
      },
    ],
    shortcut: '/brand/roventra-logo-kit/roventra-favicon-32.png',
  },
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="en">
      <body>
        {children}
        <CookieConsent />
      </body>
    </html>
  );
}
