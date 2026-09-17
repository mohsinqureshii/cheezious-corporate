import { LOCALES, type Locale } from '@cheezious/config';
import { renderSitemap, SITEMAP_DEFAULTS, type SitemapEntry } from '@cheezious/seo';

import { getSitemap, type SitemapEntryRecord } from '@/lib/content';
import { siteUrl } from '@/lib/seo';

/**
 * XML sitemap.
 *
 * Built from everything that is actually published, per locale, with hreflang
 * alternates inline so search engines associate the English and Urdu variants
 * of a page rather than treating them as duplicates.
 *
 * It reads a dedicated endpoint rather than the listing endpoints, which cap
 * their page size for presentation reasons — using those here would silently
 * truncate the sitemap at fifty stories, and nobody would notice until the
 * fifty-first stopped being indexed.
 *
 * Priorities and change frequencies come from content type: the newsroom and
 * open roles change daily and say so; a policy archive does not.
 */

export const revalidate = 3600;

/** URL builders per collection, so a path is written once. */
const PATHS = {
  stories: (locale: string, slug: string) => `/${locale}/company/newsroom/stories/${slug}`,
  pressReleases: (locale: string, slug: string) =>
    `/${locale}/company/newsroom/press-releases/${slug}`,
  people: (locale: string, slug: string) => `/${locale}/company/leadership/${slug}`,
  policies: (locale: string, slug: string) => `/${locale}/company/governance/policies/${slug}`,
  jobs: (locale: string, slug: string) => `/${locale}/careers/jobs/${slug}`,
  reports: (locale: string, slug: string) => `/${locale}/company/resources/publications/${slug}`,
  impactStories: (locale: string, slug: string) => `/${locale}/company/impact/stories/${slug}`,
  employeeStories: (locale: string, slug: string) => `/${locale}/company/people/stories/${slug}`,
} as const;

const DEFAULTS = {
  stories: SITEMAP_DEFAULTS.article,
  pressReleases: SITEMAP_DEFAULTS.pressRelease,
  people: SITEMAP_DEFAULTS.person,
  policies: SITEMAP_DEFAULTS.policy,
  jobs: SITEMAP_DEFAULTS.job,
  reports: SITEMAP_DEFAULTS.report,
  impactStories: SITEMAP_DEFAULTS.article,
  employeeStories: SITEMAP_DEFAULTS.article,
} as const;

type Collection = keyof typeof PATHS;

export async function GET(): Promise<Response> {
  const origin = siteUrl();
  const entries: SitemapEntry[] = [];

  // Alternates are grouped across locales, so the English and Urdu passes have
  // to be collected before any entry is written.
  const byLocale = new Map<Locale, Awaited<ReturnType<typeof getSitemap>>>();

  for (const locale of LOCALES) {
    try {
      byLocale.set(locale, await getSitemap(locale));
    } catch (error) {
      // A sitemap that cannot be built is better served partial than as a 500,
      // which search engines treat as a fetch error against the whole site.
      console.error(`[sitemap] could not load ${locale}:`, error);
    }
  }

  // --- Pages --------------------------------------------------------------
  const pageAlternates = new Map<string, Partial<Record<Locale, string>>>();
  for (const [locale, payload] of byLocale) {
    for (const page of payload.pages) {
      const group = pageAlternates.get(page.translationGroupId) ?? {};
      group[locale] = `/${locale}${page.path}`;
      pageAlternates.set(page.translationGroupId, group);
    }
  }

  for (const [locale, payload] of byLocale) {
    for (const page of payload.pages) {
      const defaults = (page.path === '/company'
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
        alternates: pageAlternates.get(page.translationGroupId),
      });
    }
  }

  // --- Collections ---------------------------------------------------------
  for (const collection of Object.keys(PATHS) as Collection[]) {
    const alternates = new Map<string, Partial<Record<Locale, string>>>();

    for (const [locale, payload] of byLocale) {
      for (const record of payload[collection] as SitemapEntryRecord[]) {
        const group = alternates.get(record.translationGroupId) ?? {};
        group[locale] = PATHS[collection](locale, record.slug);
        alternates.set(record.translationGroupId, group);
      }
    }

    for (const [locale, payload] of byLocale) {
      for (const record of payload[collection] as SitemapEntryRecord[]) {
        const defaults = DEFAULTS[collection] ?? {
          priority: 0.5,
          changeFrequency: 'monthly' as const,
        };

        entries.push({
          path: PATHS[collection](locale, record.slug),
          locale,
          lastModified:
            record.updatedAt ??
            record.publishedAt ??
            record.postedAt ??
            record.publicationDate ??
            null,
          changeFrequency: defaults.changeFrequency,
          priority: defaults.priority,
          alternates: alternates.get(record.translationGroupId),
        });
      }
    }
  }

  return new Response(renderSitemap(entries, origin), {
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      'Cache-Control': 'public, max-age=0, s-maxage=3600, stale-while-revalidate=86400',
    },
  });
}
