'use client';

import { useEffect } from 'react';

/**
 * Error boundary.
 *
 * Shows a plain, non-technical message and a way forward. A stack trace never
 * reaches a visitor: the digest is shown instead, which is the identifier
 * support needs to find the real error in the logs.
 */
export default function ErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('[corporate-web] render error:', error);
  }, [error]);

  return (
    <div className="container-standard py-section-generous">
      <div className="max-w-2xl">
        <p className="eyebrow">Something went wrong</p>
        <h1 className="mt-5 text-display-sm text-ink">This page could not be displayed</h1>
        <p className="mt-6 text-body-lg text-ink-soft">
          The problem has been logged. Try again in a moment, or continue from the homepage.
        </p>

        <div className="mt-10 flex flex-wrap gap-4">
          <button
            type="button"
            onClick={reset}
            className="rounded bg-ink px-7 py-3.5 text-body-sm font-semibold text-paper
                       transition-colors duration-quick hover:bg-ink-soft"
          >
            Try again
          </button>
          <a
            href="/en/company"
            className="rounded border border-ink px-7 py-3.5 text-body-sm font-semibold text-ink
                       no-underline transition-colors duration-quick hover:bg-ink hover:text-paper"
          >
            Go to the homepage
          </a>
        </div>

        {error.digest ? (
          <p className="mt-10 text-body-xs text-ink-faint">
            Reference: <code className="font-mono">{error.digest}</code>
          </p>
        ) : null}
      </div>
    </div>
  );
}
