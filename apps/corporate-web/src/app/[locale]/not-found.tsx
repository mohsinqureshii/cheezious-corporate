import Link from 'next/link';

/**
 * 404.
 *
 * Corporate in tone, not playful: someone who lands here may be a journalist on
 * deadline or a supplier following a stale link, and a joke about pizza does not
 * help either of them. The job is to get them where they were going.
 */
export default function NotFound() {
  const destinations = [
    { label: 'Company', description: 'About Cheezious, leadership and our footprint', href: '/en/company' },
    { label: 'Newsroom', description: 'Company news, press releases and stories', href: '/en/company/newsroom' },
    { label: 'Careers', description: 'Open roles across the business', href: '/en/careers' },
    { label: 'Partners', description: 'Suppliers, real estate and partnerships', href: '/en/company/partners' },
    { label: 'Contact', description: 'Reach the right team', href: '/en/company/contact' },
  ];

  return (
    <div className="container-standard py-section-generous">
      <div className="max-w-3xl">
        <p className="eyebrow">Error 404</p>
        <h1 className="mt-5 text-display-md text-ink">This page could not be found</h1>
        <p className="mt-6 max-w-prose text-body-lg text-ink-soft">
          The page may have moved, or the link may be out of date. If you followed a link from another site, it
          may be pointing at an address we no longer use.
        </p>

        <form action="/en/search" method="get" className="mt-10 flex max-w-xl gap-3">
          <label htmlFor="notfound-search" className="sr-only">
            Search the corporate site
          </label>
          <input
            id="notfound-search"
            name="q"
            type="search"
            placeholder="Search for a page, role or announcement"
            className="w-full rounded border border-ink-line bg-paper-raised px-4 py-3 text-body-md
                       text-ink placeholder:text-ink-faint focus:border-ink"
          />
          <button
            type="submit"
            className="shrink-0 rounded bg-ink px-6 py-3 text-body-sm font-semibold text-paper
                       transition-colors duration-quick hover:bg-ink-soft"
          >
            Search
          </button>
        </form>
      </div>

      <div className="mt-16 border-t border-ink-line pt-10">
        <h2 className="text-heading-md text-ink">Or continue from here</h2>
        <ul className="mt-6 grid gap-x-gutter gap-y-6 sm:grid-cols-2 lg:grid-cols-3">
          {destinations.map((destination) => (
            <li key={destination.href} className="border-t border-ink-line pt-4">
              <Link
                href={destination.href}
                className="text-heading-sm text-ink no-underline transition-colors duration-quick hover:text-brand-deep"
              >
                {destination.label}
              </Link>
              <p className="mt-1.5 text-body-sm text-ink-muted">{destination.description}</p>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
