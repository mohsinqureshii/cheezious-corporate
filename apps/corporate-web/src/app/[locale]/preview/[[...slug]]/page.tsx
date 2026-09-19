import { isLocale, type Locale } from '@cheezious/config';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { CorporatePageView, pathFromSlug } from '@/components/page/CorporatePageView';

/**
 * Preview: a page as it will be, not as it is.
 *
 * A separate route from the public one, for two reasons that both matter.
 *
 * It is uncacheable by construction. A preview shows unpublished content and is
 * authorised by a token belonging to one editor, so it must never enter a shared
 * cache or an ISR entry that a visitor could then be served. Being its own
 * always-dynamic route makes that structural rather than a rule to remember.
 *
 * And it keeps the token out of the public route. Reading a search parameter
 * makes a render dynamic, which a statically generated route may not be — the
 * whole site returned 500 for exactly that reason when nothing had been
 * prerendered. Preview owns the parameter; the public route owns the cache.
 *
 * robots.txt disallows every preview path, and the metadata below refuses
 * indexing regardless of what the draft itself asks for.
 */

export const dynamic = 'force-dynamic';

interface RouteParams {
  locale: string;
  slug?: string[];
}

export function generateMetadata(): Metadata {
  return { robots: { index: false, follow: false } };
}

export default async function PreviewPage({
  params,
  searchParams,
}: {
  params: Promise<RouteParams>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { locale: localeParam, slug } = await params;
  if (!isLocale(localeParam)) notFound();

  const locale: Locale = localeParam;
  const query = await searchParams;
  const previewToken = typeof query.preview === 'string' ? query.preview : undefined;

  // Without a token this is not a preview, and serving the published page here
  // would put a second, uncached copy of it at a second URL.
  if (!previewToken) notFound();

  return (
    <CorporatePageView locale={locale} path={pathFromSlug(slug)} previewToken={previewToken} />
  );
}
