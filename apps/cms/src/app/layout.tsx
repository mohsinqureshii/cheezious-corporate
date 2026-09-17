import type { Metadata, Viewport } from 'next';

import '@/styles/globals.css';

/**
 * CMS root layout.
 *
 * The CMS is an internal tool: never indexed, never framed, always English and
 * left-to-right regardless of which locale the editor is working on — the
 * content has a language, the tool does not.
 */
export const metadata: Metadata = {
  title: { default: 'Cheezious CMS', template: '%s | Cheezious CMS' },
  description: 'Content management for the Cheezious corporate platform.',
  robots: { index: false, follow: false, nocache: true },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  themeColor: '#161616',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" dir="ltr">
      <body>{children}</body>
    </html>
  );
}
