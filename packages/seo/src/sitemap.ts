/**
 * Sitemap and robots generation.
 *
 * The sitemap is built from what is actually published, per locale, with
 * hreflang alternates inline so search engines can associate the English and
 * Urdu variants of every page.
 */

import { absoluteUrl, LOCALES, type SeoLocale } from './metadata';

export type ChangeFrequency =
  'always' | 'hourly' | 'daily' | 'weekly' | 'monthly' | 'yearly' | 'never';

export interface SitemapEntry {
  /** Locale-prefixed path, e.g. /en/company/leadership. */
  path: string;
  locale: SeoLocale;
  lastModified?: Date | string | null;
  changeFrequency?: ChangeFrequency;
  priority?: number;
  /** Paths of the same content in other locales, for hreflang alternates. */
  alternates?: Partial<Record<SeoLocale, string>>;
  images?: Array<{ url: string; title?: string }>;
}

/**
 * Default priorities and change frequencies by section.
 *
 * These are hints, not guarantees, but getting them roughly right means the
 * homepage and newsroom are recrawled promptly while policy archives are not
 * crawled daily for no reason.
 */
export const SITEMAP_DEFAULTS: Record<
  string,
  { priority: number; changeFrequency: ChangeFrequency }
> = {
  home: { priority: 1.0, changeFrequency: 'daily' },
  sectionIndex: { priority: 0.8, changeFrequency: 'weekly' },
  standard: { priority: 0.6, changeFrequency: 'monthly' },
  newsroom: { priority: 0.9, changeFrequency: 'daily' },
  article: { priority: 0.6, changeFrequency: 'monthly' },
  pressRelease: { priority: 0.7, changeFrequency: 'monthly' },
  person: { priority: 0.5, changeFrequency: 'monthly' },
  job: { priority: 0.8, changeFrequency: 'daily' },
  careers: { priority: 0.9, changeFrequency: 'weekly' },
  report: { priority: 0.5, changeFrequency: 'yearly' },
  policy: { priority: 0.4, changeFrequency: 'yearly' },
  legal: { priority: 0.3, changeFrequency: 'yearly' },
};

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function hreflangFor(locale: SeoLocale): string {
  return locale === 'en' ? 'en-PK' : 'ur-PK';
}

/** Render a urlset XML document. A sitemap is capped at 50,000 URLs by protocol. */
export function renderSitemap(entries: SitemapEntry[], siteUrl: string): string {
  const lines: string[] = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"' +
      ' xmlns:xhtml="http://www.w3.org/1999/xhtml"' +
      ' xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">',
  ];

  for (const entry of entries.slice(0, 50_000)) {
    lines.push('  <url>');
    lines.push(`    <loc>${escapeXml(absoluteUrl(siteUrl, entry.path))}</loc>`);

    if (entry.lastModified) {
      lines.push(`    <lastmod>${new Date(entry.lastModified).toISOString()}</lastmod>`);
    }
    if (entry.changeFrequency) lines.push(`    <changefreq>${entry.changeFrequency}</changefreq>`);
    if (typeof entry.priority === 'number') {
      lines.push(`    <priority>${entry.priority.toFixed(1)}</priority>`);
    }

    // Each URL declares alternates for every locale it exists in, including itself.
    if (entry.alternates) {
      for (const locale of LOCALES) {
        const path = entry.alternates[locale];
        if (!path) continue;
        lines.push(
          `    <xhtml:link rel="alternate" hreflang="${hreflangFor(locale)}" href="${escapeXml(
            absoluteUrl(siteUrl, path),
          )}" />`,
        );
      }
      if (entry.alternates.en) {
        lines.push(
          `    <xhtml:link rel="alternate" hreflang="x-default" href="${escapeXml(
            absoluteUrl(siteUrl, entry.alternates.en),
          )}" />`,
        );
      }
    }

    for (const image of entry.images ?? []) {
      lines.push('    <image:image>');
      lines.push(`      <image:loc>${escapeXml(image.url)}</image:loc>`);
      if (image.title) lines.push(`      <image:title>${escapeXml(image.title)}</image:title>`);
      lines.push('    </image:image>');
    }

    lines.push('  </url>');
  }

  lines.push('</urlset>');
  return lines.join('\n');
}

export interface SitemapIndexEntry {
  path: string;
  lastModified?: Date | string | null;
}

/** Render a sitemap index, used once the site outgrows a single sitemap. */
export function renderSitemapIndex(entries: SitemapIndexEntry[], siteUrl: string): string {
  const lines: string[] = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
  ];

  for (const entry of entries) {
    lines.push('  <sitemap>');
    lines.push(`    <loc>${escapeXml(absoluteUrl(siteUrl, entry.path))}</loc>`);
    if (entry.lastModified) {
      lines.push(`    <lastmod>${new Date(entry.lastModified).toISOString()}</lastmod>`);
    }
    lines.push('  </sitemap>');
  }

  lines.push('</sitemapindex>');
  return lines.join('\n');
}

export interface RobotsOptions {
  siteUrl: string;
  /** Staging and preview deployments disallow everything. */
  disallowAll?: boolean;
  sitemapPaths?: string[];
  extraDisallow?: string[];
}

export function renderRobotsTxt(options: RobotsOptions): string {
  const lines: string[] = [];

  if (options.disallowAll) {
    lines.push('# Non-production deployment. Indexing is disabled.');
    lines.push('User-agent: *', 'Disallow: /');
    return `${lines.join('\n')}\n`;
  }

  lines.push('User-agent: *', 'Allow: /');

  // Paths that must never be indexed: preview, search result pages (thin,
  // infinite permutations) and anything under the API.
  const disallow = [
    '/api/',
    '/*/preview',
    '/preview',
    '/*/search?',
    '/search?',
    ...(options.extraDisallow ?? []),
  ];
  for (const path of disallow) lines.push(`Disallow: ${path}`);

  lines.push('');
  for (const sitemap of options.sitemapPaths ?? ['/sitemap.xml']) {
    lines.push(`Sitemap: ${absoluteUrl(options.siteUrl, sitemap)}`);
  }

  return `${lines.join('\n')}\n`;
}
