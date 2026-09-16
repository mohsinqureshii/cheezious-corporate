import type { Locale } from '@cheezious/config';
import Link from 'next/link';

import type { CorporatePage } from '@/lib/content';

/**
 * Breadcrumbs.
 *
 * A corporate site this deep needs them: without a trail, a visitor who lands on
 * "Food Safety" from a search result has no idea it sits under Food & Quality.
 *
 * Rendered as an ordered list inside a labelled nav, with the current page
 * marked `aria-current` and the separators hidden from assistive technology.
 */
export function Breadcrumbs({
  page,
  locale,
  pathById: _pathById,
}: {
  page: CorporatePage;
  locale: Locale;
  pathById: Map<string, string>;
}) {
  // The corporate home page is the root; a breadcrumb to itself is noise.
  if (page.path === '/company') return null;

  const trail: Array<{ label: string; href?: string }> = [
    { label: 'Company', href: `/${locale}/company` },
  ];

  if (page.parent && page.parent.path !== '/company') {
    trail.push({
      label: page.parent.navLabel ?? page.parent.title,
      href: `/${locale}${page.parent.path}`,
    });
  }

  trail.push({ label: page.navLabel ?? page.title });

  return (
    <nav aria-label="Breadcrumb" className="border-b border-ink-line bg-paper">
      <div className="container-standard">
        <ol className="flex flex-wrap items-center gap-x-2 gap-y-1 py-4 text-body-xs">
          {trail.map((crumb, index) => {
            const isLast = index === trail.length - 1;
            return (
              <li key={`${crumb.label}-${index}`} className="flex items-center gap-2">
                {crumb.href && !isLast ? (
                  <Link
                    href={crumb.href}
                    className="text-ink-muted no-underline transition-colors duration-quick hover:text-ink"
                  >
                    {crumb.label}
                  </Link>
                ) : (
                  <span className="font-medium text-ink" aria-current="page">
                    {crumb.label}
                  </span>
                )}
                {!isLast ? (
                  <span aria-hidden="true" className="text-ink-line rtl:rotate-180">
                    /
                  </span>
                ) : null}
              </li>
            );
          })}
        </ol>
      </div>
    </nav>
  );
}
