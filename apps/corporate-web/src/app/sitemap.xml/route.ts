import { LOCALES, type Locale } from '@cheezious/config';
import { renderSitemap, SITEMAP_DEFAULTS, type SitemapEntry } from '@cheezious/seo';

import { getJobs, getPagePaths, getPressReleases, getStories } from '@/lib/content';
import { siteUrl } from '@/lib/seo';

/**
 * XML sitemap.
 *
 * Built from what is actually published, per locale, with hreflang alternates
 * inline so search engines associate the English and Urdu variants of each page
 * rather than treating them as duplicates.
 *
 * Priorities and change frequencies are derived from content type: the newsroom
 * and open roles change daily and say so; a policy archive does not.
 */

export const revalidate = 3600;

export async function GET(): Promise<Response> {
  const origin = siteUrl();
  const entries: SitemapEntry[] = [];

  // A sitemap that cannot be built is better served empty than as a 500, which
  // search engines treat as a fetch error against the whole site.
  const safely = async (label: string, run: () => Promise<void>): Promise<void> => {
    try {
      await run();
    } catch (error) {
      console.error(`[sitemap] failed to include ${label}:`, error);
    }
  };

  for (const locale of LOCALES) {
    await safely(`pages (${locale})`, async () => {
      const paths = await getPagePaths(locale);

      // Group by translation set so every URL can declare its alternates.
      const byGroup = new Map<string, Partial<Record<Locale, string>>>();
      for (const page of paths) {
        const group = byGroup.get(page.translationGroupId) ?? {};
        group[locale] = `/${locale}${page.path}`;
        byGroup.set(page.translationGroupId, group);
      }

      for (const page of paths) {
        if (page.excludeFromSitemap) continue;

        // `standard` is the floor: an unrecognised page type still gets a
        // sensible priority rather than none.
        const defaults =
          (page.path === '/company'
            ? SITEMAP_DEFAULTS.home
            : page.type === 'SECTION_INDEX' || page.type === 'LANDING'
              ? SITEMAP_DEFAULTS.sectionIndex
              : SITEMAP_DEFAULTS.standard) ?? { priority: 0.5, changeFrequency: 'monthly' as const };

        entries.push({
          path: `/${locale}${page.path}`,
          locale,
          lastModified: page.updatedAt,
          changeFrequency: defaults.changeFrequency,
          priority: defaults.priority,
          alternates: byGroup.get(page.translationGroupId),
        });
      }
    });

    await safely(`stories (${locale})`, async () => {
      const { items } = await getStories(locale, { pageSize: 50 });
      for (const story of items) {
        entries.push({
          path: `/${locale}/company/newsroom/stories/${story.slug}`,
          locale,
          lastModified: story.publishedAt,
          ...SITEMAP_DEFAULTS.article,
        });
      }
    });

    await safely(`press releases (${locale})`, async () => {
      const { items } = await getPressReleases(locale, { pageSize: 50 });
      for (const release of items as Array<{ slug: string; publishedAt: string | null }>) {
        entries.push({
          path: `/${locale}/company/newsroom/press-releases/${release.slug}`,
          locale,
          lastModified: release.publishedAt,
          ...SITEMAP_DEFAULTS.pressRelease,
        });
      }
    });

    await safely(`jobs (${locale})`, async () => {
      const { items } = await getJobs(locale, { pageSize: 50 });
      for (const job of items) {
        // Open roles are crawled daily: a job that has closed should leave the
        // index quickly, and a new one should appear quickly.
        entries.push({
          path: `/${locale}/careers/jobs/${job.slug}`,
          locale,
          lastModified: job.postedAt,
          ...SITEMAP_DEFAULTS.job,
        });
      }
    });
  }

  return new Response(renderSitemap(entries, origin), {
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      'Cache-Control': 'public, max-age=0, s-maxage=3600, stale-while-revalidate=86400',
    },
  });
}
