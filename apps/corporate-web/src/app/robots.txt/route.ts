import { renderRobotsTxt } from '@cheezious/seo';

import { siteUrl } from '@/lib/seo';

/**
 * robots.txt
 *
 * On a non-production deployment this disallows everything. The single most
 * damaging SEO mistake a corporate site can make is letting a staging copy get
 * indexed and compete with production for its own brand terms.
 */
/**
 * Rendered per request, cached at the edge.
 *
 * Prerendering this at build time would freeze the site's own origin into it,
 * and on a platform that assigns the domain after the build that origin is
 * wrong. The `Cache-Control` below still keeps the work off the origin, and
 * the data this reads is cached and tag-invalidated independently.
 */
export const dynamic = 'force-dynamic';

export function GET(): Response {
  const isNonProduction = process.env.NEXT_PUBLIC_SEO_NOINDEX === '1';

  const body = renderRobotsTxt({
    siteUrl: siteUrl(),
    disallowAll: isNonProduction,
    sitemapPaths: ['/sitemap.xml'],
  });

  return new Response(body, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'public, max-age=0, s-maxage=3600',
    },
  });
}
