'use client';

import { useEffect } from 'react';

/**
 * Top-level error boundary.
 *
 * Catches failures in the root layout itself, which the per-route error
 * boundaries sit inside and therefore cannot handle. Because it replaces the
 * whole document when it renders, it supplies its own `<html>` and `<body>`, and
 * inlines its styles rather than depending on a stylesheet that may be exactly
 * what failed to load.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('[corporate-web] root error:', error);
  }, [error]);

  return (
    <html lang="en" dir="ltr">
      <body
        style={{
          margin: 0,
          minHeight: '100vh',
          backgroundColor: '#FBFAF7',
          color: '#14140F',
          fontFamily: 'system-ui, -apple-system, Segoe UI, sans-serif',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '2rem',
        }}
      >
        <main style={{ maxWidth: '36rem' }}>
          <p
            style={{
              margin: 0,
              fontSize: '0.75rem',
              fontWeight: 600,
              letterSpacing: '0.14em',
              textTransform: 'uppercase',
              color: '#6B6B61',
            }}
          >
            Something went wrong
          </p>
          <h1 style={{ margin: '1rem 0 0', fontSize: '2rem', lineHeight: 1.1, letterSpacing: '-0.02em' }}>
            This page could not be displayed
          </h1>
          <p style={{ margin: '1.5rem 0 0', fontSize: '1.0625rem', lineHeight: 1.6, color: '#3A3A33' }}>
            The problem has been logged. Try again in a moment, or continue from the homepage.
          </p>

          <div style={{ marginTop: '2.5rem', display: 'flex', flexWrap: 'wrap', gap: '1rem' }}>
            <button
              type="button"
              onClick={reset}
              style={{
                border: 0,
                borderRadius: '3px',
                backgroundColor: '#14140F',
                color: '#FBFAF7',
                padding: '0.875rem 1.75rem',
                fontSize: '0.9375rem',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Try again
            </button>
            <a
              href="/en/company"
              style={{
                borderRadius: '3px',
                border: '1px solid #14140F',
                color: '#14140F',
                padding: '0.875rem 1.75rem',
                fontSize: '0.9375rem',
                fontWeight: 600,
                textDecoration: 'none',
              }}
            >
              Go to the homepage
            </a>
          </div>

          {error.digest ? (
            <p style={{ marginTop: '2.5rem', fontSize: '0.8125rem', color: '#9A9A90' }}>
              Reference: <code>{error.digest}</code>
            </p>
          ) : null}
        </main>
      </body>
    </html>
  );
}
