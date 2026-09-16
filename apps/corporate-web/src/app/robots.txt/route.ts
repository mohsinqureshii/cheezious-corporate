import { renderRobotsTxt } from '@cheezious/seo';

import { siteUrl } from '@/lib/seo';

/**
 * robots.txt
 *
 * On a non-production deployment this disallows everything. The single most
 * damaging SEO mistake a corporate site can make is letting a staging copy get
 * indexed and compete with production for its own brand terms.
 */
export const revalidate = 3600;

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
