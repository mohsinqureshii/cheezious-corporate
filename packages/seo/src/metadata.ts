/**
 * SEO metadata resolution.
 *
 * Every public page resolves its metadata through `resolveSeo`. There is no code
 * path that renders a page without a title, a description, a canonical URL and
 * hreflang alternates — where an editor has not supplied a value, a sensible
 * default is derived from the content itself rather than left blank.
 */

export const LOCALES = ['en', 'ur'] as const;
export type SeoLocale = (typeof LOCALES)[number];

/** Search engines truncate around these lengths; we warn rather than silently cut titles. */
export const SEO_LIMITS = {
  titleMax: 60,
  titleHardMax: 70,
  descriptionMin: 70,
  descriptionMax: 160,
  descriptionHardMax: 200,
  ogImageWidth: 1200,
  ogImageHeight: 630,
} as const;

export interface SeoInput {
  /** Editor-supplied overrides. Any field left empty falls back to a derived value. */
  title?: string | null;
  description?: string | null;
  canonicalUrl?: string | null;
  noindex?: boolean | null;
  nofollow?: boolean | null;
  ogTitle?: string | null;
  ogDescription?: string | null;
  ogImageUrl?: string | null;
  ogImageAlt?: string | null;
  twitterCard?: string | null;
  keywords?: string[];
  structuredData?: unknown;
}

export interface SeoContext {
  /** Absolute origin, e.g. https://corporate.cheezious.com — never a trailing slash. */
  siteUrl: string;
  /** Locale-prefixed path of the current page, e.g. /en/company/leadership. */
  path: string;
  locale: SeoLocale;
  /** Path per locale for hreflang alternates. Missing locales are omitted. */
  alternates?: Partial<Record<SeoLocale, string>>;
  /** Fallbacks derived from the content when the editor supplied nothing. */
  fallbackTitle: string;
  fallbackDescription?: string;
  fallbackImageUrl?: string;
  fallbackImageAlt?: string;
  /** Site-wide suffix, e.g. "Cheezious Corporate". */
  siteName: string;
  /** Set on staging and preview deployments to keep them out of search results. */
  forceNoindex?: boolean;
  publishedTime?: Date | string | null;
  modifiedTime?: Date | string | null;
  type?: 'website' | 'article' | 'profile';
}

export interface ResolvedSeo {
  title: string;
  /** Title including the site-name suffix, as rendered in <title>. */
  fullTitle: string;
  description: string;
  canonical: string;
  robots: string;
  openGraph: {
    title: string;
    description: string;
    url: string;
    siteName: string;
    locale: string;
    type: string;
    images: Array<{ url: string; width: number; height: number; alt: string }>;
    publishedTime?: string;
    modifiedTime?: string;
  };
  twitter: {
    card: string;
    title: string;
    description: string;
    images: string[];
  };
  alternates: {
    canonical: string;
    languages: Record<string, string>;
  };
  keywords?: string[];
}

const OG_LOCALE: Record<SeoLocale, string> = { en: 'en_PK', ur: 'ur_PK' };

/** Join an origin and a path into an absolute, normalised URL. */
export function absoluteUrl(siteUrl: string, path: string): string {
  const origin = siteUrl.replace(/\/+$/, '');
  if (!path || path === '/') return `${origin}/`;
  const normalised = path.startsWith('/') ? path : `/${path}`;
  return `${origin}${normalised.replace(/\/+$/, '')}`;
}

/** Collapse whitespace and trim a value the editor may have pasted. */
function clean(value: string | null | undefined): string | undefined {
  const trimmed = value?.replace(/\s+/g, ' ').trim();
  return trimmed ? trimmed : undefined;
}

/**
 * Truncate a description on a word boundary.
 *
 * A description cut mid-word reads as broken in a search result, so the cut is
 * moved back to the previous space whenever that does not lose too much text.
 */
export function truncateForSeo(input: string, maxLength: number): string {
  const text = input.replace(/\s+/g, ' ').trim();
  if (text.length <= maxLength) return text;
  const cut = text.slice(0, maxLength - 1);
  const lastSpace = cut.lastIndexOf(' ');
  const base = lastSpace > maxLength * 0.6 ? cut.slice(0, lastSpace) : cut;
  return `${base.replace(/[\s,.;:—-]+$/, '')}…`;
}

export function resolveSeo(input: SeoInput, context: SeoContext): ResolvedSeo {
  const title = clean(input.title) ?? clean(context.fallbackTitle) ?? context.siteName;

  const description =
    clean(input.description) ??
    clean(context.fallbackDescription) ??
    `${title} — ${context.siteName}.`;

  const canonical = clean(input.canonicalUrl) ?? absoluteUrl(context.siteUrl, context.path);

  // A staging deployment, an explicit editor choice, or a nofollow flag all feed
  // one robots directive so there is a single place this can go wrong.
  const noindex = context.forceNoindex === true || input.noindex === true;
  const nofollow = input.nofollow === true;
  const robots = [noindex ? 'noindex' : 'index', nofollow ? 'nofollow' : 'follow'].join(', ');

  const imageUrl = clean(input.ogImageUrl) ?? clean(context.fallbackImageUrl);
  const imageAlt = clean(input.ogImageAlt) ?? clean(context.fallbackImageAlt) ?? title;

  const languages: Record<string, string> = {};
  for (const locale of LOCALES) {
    const path = context.alternates?.[locale];
    if (path) languages[locale === 'en' ? 'en-PK' : 'ur-PK'] = absoluteUrl(context.siteUrl, path);
  }
  // x-default points at the English variant, which is the canonical corporate language.
  const englishAlternate = context.alternates?.en;
  if (englishAlternate) languages['x-default'] = absoluteUrl(context.siteUrl, englishAlternate);

  const fullTitle = title === context.siteName ? title : `${title} | ${context.siteName}`;

  return {
    title,
    fullTitle,
    description: truncateForSeo(description, SEO_LIMITS.descriptionHardMax),
    canonical,
    robots,
    openGraph: {
      title: clean(input.ogTitle) ?? title,
      description: truncateForSeo(
        clean(input.ogDescription) ?? description,
        SEO_LIMITS.descriptionHardMax,
      ),
      url: canonical,
      siteName: context.siteName,
      locale: OG_LOCALE[context.locale],
      type: context.type ?? 'website',
      images: imageUrl
        ? [
            {
              url: imageUrl,
              width: SEO_LIMITS.ogImageWidth,
              height: SEO_LIMITS.ogImageHeight,
              alt: imageAlt,
            },
          ]
        : [],
      ...(context.publishedTime
        ? { publishedTime: new Date(context.publishedTime).toISOString() }
        : {}),
      ...(context.modifiedTime
        ? { modifiedTime: new Date(context.modifiedTime).toISOString() }
        : {}),
    },
    twitter: {
      card: clean(input.twitterCard) ?? 'summary_large_image',
      title: clean(input.ogTitle) ?? title,
      description: truncateForSeo(
        clean(input.ogDescription) ?? description,
        SEO_LIMITS.descriptionHardMax,
      ),
      images: imageUrl ? [imageUrl] : [],
    },
    alternates: { canonical, languages },
    ...(input.keywords && input.keywords.length > 0 ? { keywords: input.keywords } : {}),
  };
}

export interface SeoQualityIssue {
  field: 'title' | 'description' | 'ogImage' | 'canonical';
  severity: 'warning' | 'error';
  message: string;
}

/**
 * Editorial SEO feedback.
 *
 * Surfaced live in the CMS inspector and aggregated into the content-health
 * dashboard, so problems are caught while writing rather than discovered in a
 * quarterly audit.
 */
export function assessSeoQuality(
  resolved: ResolvedSeo,
  options: { requireOgImage?: boolean } = {},
): SeoQualityIssue[] {
  const issues: SeoQualityIssue[] = [];

  if (resolved.title.length > SEO_LIMITS.titleHardMax) {
    issues.push({
      field: 'title',
      severity: 'warning',
      message: `The title is ${resolved.title.length} characters. Search results usually cut off around ${SEO_LIMITS.titleMax}.`,
    });
  }
  if (resolved.title.length < 15) {
    issues.push({
      field: 'title',
      severity: 'warning',
      message: 'The title is very short. Add more context.',
    });
  }

  if (resolved.description.length < SEO_LIMITS.descriptionMin) {
    issues.push({
      field: 'description',
      severity: 'warning',
      message: `The description is ${resolved.description.length} characters. Aim for ${SEO_LIMITS.descriptionMin}–${SEO_LIMITS.descriptionMax}.`,
    });
  }
  if (resolved.description.length > SEO_LIMITS.descriptionMax) {
    issues.push({
      field: 'description',
      severity: 'warning',
      message: `The description is ${resolved.description.length} characters and will be truncated. Aim for ${SEO_LIMITS.descriptionMax} or fewer.`,
    });
  }

  if (options.requireOgImage !== false && resolved.openGraph.images.length === 0) {
    issues.push({
      field: 'ogImage',
      severity: 'warning',
      message: 'No social sharing image. Links to this page will appear without a preview.',
    });
  }

  if (!/^https?:\/\//.test(resolved.canonical)) {
    issues.push({
      field: 'canonical',
      severity: 'error',
      message: 'The canonical URL must be absolute.',
    });
  }

  return issues;
}

/**
 * Derive a description from body content when the editor has not written one.
 * Better a relevant first paragraph than an empty meta description.
 */
export function deriveDescription(text: string, maxLength = SEO_LIMITS.descriptionMax): string {
  const plain = text
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/\s+/g, ' ')
    .trim();
  return truncateForSeo(plain, maxLength);
}
