import type { Metadata } from 'next';
import type { ReactNode } from 'react';

import './globals.css';

export const metadata: Metadata = {
  title: {
    default: 'Roventra | Pet-care business software, beautifully connected',
    template: '%s | Roventra',
  },
  description:
    'A modern website, booking experience, and operating platform for boarding, daycare, and grooming businesses.',
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
