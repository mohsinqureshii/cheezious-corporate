import { isLocale, type Locale } from '@cheezious/config';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import {
  CorporatePageView,
  corporatePageMetadata,
  pathFromSlug,
} from '@/components/page/CorporatePageView';
import { getPagePaths } from '@/lib/content';

/**
 * The corporate site's page route.
 *
 * Every content page — roughly a hundred of them — is served here from the CMS.
 * Nothing about the information architecture is hardcoded in the file system, so
 * Corporate Communications adding a page is a publish, not a deployment.
 *
 * Statically generated and revalidated on publish, which is what keeps a deep
 * corporate site fast without going stale.
 *
 * It reads no search parameters, and that is load-bearing rather than
 * incidental. A statically generated route that touches a dynamic API throws
 * `DYNAMIC_SERVER_USAGE` when it is rendered on demand — which is every page
 * published after the build, and every page at all when the build could not
 * reach the API to prerender. The result is a 500 on a page that is perfectly
 * fine. Preview, which does need a parameter, is a separate route for exactly
 * this reason; see `preview/[[...slug]]`.
 */

export const revalidate = 300;
/** Pages published after the build are rendered on demand, then cached. */
export const dynamicParams = true;

interface RouteParams {
  locale: string;
  slug?: string[];
}

export async function generateStaticParams(): Promise<RouteParams[]> {
  // Prerender English at build time; Urdu pages render on first request, which
  // keeps build time proportional to the content that actually exists.
  try {
    const paths = await getPagePaths('en');
    return paths.map((page) => ({
      locale: 'en',
      slug: page.path.split('/').filter(Boolean),
    }));
  } catch {
    // A build that cannot reach the API still succeeds; pages render on demand.
    return [];
  }
}

export async function generateMetadata({
  params,
}: {
  params: Promise<RouteParams>;
}): Promise<Metadata> {
  const { locale, slug } = await params;
  if (!isLocale(locale)) return {};
  return corporatePageMetadata(locale, pathFromSlug(slug));
}

export default async function CorporatePage({ params }: { params: Promise<RouteParams> }) {
  const { locale: localeParam, slug } = await params;
  if (!isLocale(localeParam)) notFound();

  const locale: Locale = localeParam;
  return <CorporatePageView locale={locale} path={pathFromSlug(slug)} />;
}
