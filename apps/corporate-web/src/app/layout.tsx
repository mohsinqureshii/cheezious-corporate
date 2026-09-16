import type { Metadata, Viewport } from 'next';

import '@/styles/globals.css';

/**
 * Root layout.
 *
 * Owns the document shell. It stays static (no `headers()`, no dynamic APIs) so
 * that all ~100 content pages can be statically generated and served from the
 * edge; the per-locale `lang` and `dir` are applied by the locale layout on a
 * wrapper element, which assistive technology and CSS both honour, and are
 * synchronised onto `<html>` before paint.
 */

export const metadata: Metadata = {
  title: { default: 'Cheezious Corporate', template: '%s | Cheezious Corporate' },
  description: 'Corporate information about Cheezious.',
  // Overridden per page. The restrictive default means a route that somehow
  // ships without metadata cannot be indexed by accident.
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  // Zoom is never capped: limiting it locks out anyone who needs to magnify
  // text, and the layout reflows rather than depending on a fixed scale.
  maximumScale: 5,
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#FBFAF7' },
    { media: '(prefers-color-scheme: dark)', color: '#14140F' },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" dir="ltr" suppressHydrationWarning>
      <body className="min-h-screen bg-paper antialiased">{children}</body>
    </html>
  );
}
