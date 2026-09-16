import Link from 'next/link';

/**
 * Root 404, for a request that resolves to no locale at all.
 *
 * Corporate in tone: someone who lands here may be a journalist on deadline or a
 * supplier following a stale link, and the job is to get them where they were
 * going, not to be charming about it.
 */
export default function RootNotFound() {
  return (
    <div className="container-standard py-section-generous">
      <p className="eyebrow">Error 404</p>
      <h1 className="mt-5 text-display-md text-ink">This page could not be found</h1>
      <p className="mt-6 max-w-prose text-body-lg text-ink-soft">
        The address may be out of date. Continue from the Cheezious corporate homepage, or search for what you
        were looking for.
      </p>
      <div className="mt-10 flex flex-wrap gap-4">
        <Link
          href="/en/company"
          className="rounded bg-ink px-7 py-3.5 text-body-sm font-semibold text-paper no-underline"
        >
          Go to the homepage
        </Link>
        <Link
          href="/en/search"
          className="rounded border border-ink px-7 py-3.5 text-body-sm font-semibold text-ink no-underline"
        >
          Search
        </Link>
      </div>
    </div>
  );
}
