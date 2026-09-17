import 'server-only';

import { LOCALES, type Locale } from '@cheezious/config';
import { deriveDescription, resolveSeo, type SeoInput } from '@cheezious/seo';
import type { Metadata } from 'next';

import { mediaUrl } from './api';
import type { CorporatePage } from './content';

/**
 * SEO for Next.js.
 *
 * Bridges `@cheezious/seo` (which is framework-agnostic and unit tested) to
 * Next's Metadata API. Every public route in the site resolves its metadata
 * through one of the helpers here, so there is no page that can ship without a
 * title, description, canonical URL and hreflang alternates.
 */

export function siteUrl(): string {
  return (process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000').replace(/\/+$/, '');
}

/**
 * Staging and preview deployments emit noindex site-wide.
 *
 * This exists because the single most damaging SEO mistake a corporate site can
 * make is letting a staging copy get indexed and compete with production.
 */
function forceNoindex(): boolean {
  return process.env.NEXT_PUBLIC_SEO_NOINDEX === '1';
}

export interface BuildSeoOptions {
  /** Locale-prefixed paths for alternates. */
  alternates?: Partial<Record<Locale, string>>;
  publishedTime?: Date | string | null;
  modifiedTime?: Date | string | null;
  type?: 'website' | 'article' | 'profile';
  fallbackImageUrl?: string;
}

/** Convert resolved SEO into a Next Metadata object. */
export function toNextMetadata(
  input: SeoInput,
  context: {
    locale: Locale;
    path: string;
    fallbackTitle: string;
    fallbackDescription?: string;
    fallbackImageUrl?: string;
    siteName: string;
    alternates?: Partial<Record<Locale, string>>;
    publishedTime?: Date | string | null;
    modifiedTime?: Date | string | null;
    type?: 'website' | 'article' | 'profile';
  },
): Metadata {
  const resolved = resolveSeo(input, {
    siteUrl: siteUrl(),
    path: context.path,
    locale: context.locale,
    alternates: context.alternates,
    fallbackTitle: context.fallbackTitle,
    fallbackDescription: context.fallbackDescription,
    fallbackImageUrl: context.fallbackImageUrl,
    siteName: context.siteName,
    forceNoindex: forceNoindex(),
    publishedTime: context.publishedTime,
    modifiedTime: context.modifiedTime,
    type: context.type,
  });

  const [noindexDirective, nofollowDirective] = resolved.robots.split(', ');

  return {
    // `absolute` because the resolver already applied the site-name suffix.
    // Passing a bare string here would let the root layout's title template
    // apply it a second time ("Cheezious Corporate | Cheezious Corporate").
    title: { absolute: resolved.fullTitle },
    description: resolved.description,
    ...(resolved.keywords ? { keywords: resolved.keywords } : {}),

    alternates: {
      canonical: resolved.alternates.canonical,
      languages: resolved.alternates.languages,
    },

    robots: {
      index: noindexDirective === 'index',
      follow: nofollowDirective === 'follow',
      googleBot: {
        index: noindexDirective === 'index',
        follow: nofollowDirective === 'follow',
        // Allow rich previews in search results, which matters for a newsroom.
        'max-image-preview': 'large',
        'max-snippet': -1,
        'max-video-preview': -1,
      },
    },

    openGraph: {
      title: resolved.openGraph.title,
      description: resolved.openGraph.description,
      url: resolved.openGraph.url,
      siteName: resolved.openGraph.siteName,
      locale: resolved.openGraph.locale,
      type: resolved.openGraph.type as 'website' | 'article',
      images: resolved.openGraph.images,
      ...(resolved.openGraph.publishedTime
        ? { publishedTime: resolved.openGraph.publishedTime }
        : {}),
      ...(resolved.openGraph.modifiedTime ? { modifiedTime: resolved.openGraph.modifiedTime } : {}),
    },

    twitter: {
      card: resolved.twitter.card as 'summary_large_image',
      title: resolved.twitter.title,
      description: resolved.twitter.description,
      images: resolved.twitter.images,
    },
  };
}

/** Metadata for a CMS-managed page. */
export function buildPageSeo(
  page: CorporatePage,
  locale: Locale,
  settings: Record<string, unknown>,
): Metadata {
  const siteName = (settings['site.name'] as string) ?? 'Cheezious Corporate';

  // Alternates come from published translations only: offering hreflang to a
  // page that does not exist is worse than offering none.
  const alternates: Partial<Record<Locale, string>> = {};
  for (const candidate of LOCALES) {
    const path = page.alternates[candidate];
    if (path) alternates[candidate] = `/${candidate}${path}`;
  }
  if (!alternates[locale]) alternates[locale] = `/${locale}${page.path}`;

  const ogImage = page.seo?.ogImage;
  // Without a per-page image, links to this page would share with no preview at
  // all. The site-wide default is used instead, managed in the CMS.
  const defaultOgImageKey = settings['seo.defaultOgImageKey'] as string | undefined;
  const fallbackImageUrl = defaultOgImageKey
    ? (mediaUrl(defaultOgImageKey) ?? undefined)
    : undefined;

  const fallbackDescription =
    page.summary ??
    (page.seo?.description ? undefined : deriveDescription(extractIntroText(page))) ??
    (settings['site.defaultDescription'] as string | undefined);

  return toNextMetadata(
    {
      title: page.seo?.title,
      description: page.seo?.description,
      canonicalUrl: page.seo?.canonicalUrl,
      noindex: page.seo?.noindex,
      nofollow: page.seo?.nofollow,
      ogTitle: page.seo?.ogTitle,
      ogDescription: page.seo?.ogDescription,
      ogImageUrl: ogImage ? mediaUrl(ogImage.storageKey) : undefined,
      ogImageAlt: ogImage?.altText ?? undefined,
      twitterCard: page.seo?.twitterCard,
      keywords: page.seo?.keywords,
    },
    {
      locale,
      path: `/${locale}${page.path}`,
      fallbackTitle: page.title,
      fallbackDescription,
      fallbackImageUrl,
      siteName,
      alternates,
      modifiedTime: page.updatedAt,
      publishedTime: page.publishedAt,
      type: 'website',
    },
  );
}

/**
 * Derive a description from a page's own content when the editor has not
 * written one — a relevant first paragraph beats an empty meta description.
 */
function extractIntroText(page: CorporatePage): string {
  for (const block of page.blocks) {
    const candidate =
      (block.data.standfirst as string) ??
      (block.data.statement as string) ??
      (block.data.intro as string) ??
      (block.data.body as string);
    if (typeof candidate === 'string' && candidate.length > 40) return candidate;
  }
  return page.summary ?? page.title;
}

/** Metadata for a collection or index route that is not a CMS page. */
export function buildRouteSeo(options: {
  locale: Locale;
  path: string;
  title: string;
  description: string;
  siteName?: string;
  imageUrl?: string;
  noindex?: boolean;
  type?: 'website' | 'article';
  publishedTime?: Date | string | null;
  modifiedTime?: Date | string | null;
  alternates?: Partial<Record<Locale, string>>;
  /**
   * Site settings, so a route without its own image still shares with the
   * site-wide one. Without this, a story with no hero image would be shared as
   * a bare link — which is most of what a newsroom link is worth.
   */
  settings?: Record<string, unknown>;
}): Metadata {
  const settings = options.settings ?? {};
  const defaultOgImageKey = settings['seo.defaultOgImageKey'] as string | undefined;
  const fallbackImageUrl =
    options.imageUrl ??
    (defaultOgImageKey ? (mediaUrl(defaultOgImageKey) ?? undefined) : undefined);

  return toNextMetadata(
    {
      title: options.title,
      description: options.description,
      ogImageUrl: options.imageUrl,
      noindex: options.noindex,
    },
    {
      locale: options.locale,
      path: options.path,
      fallbackTitle: options.title,
      fallbackDescription: options.description,
      fallbackImageUrl,
      siteName: options.siteName ?? (settings['site.name'] as string) ?? 'Cheezious Corporate',
      alternates: options.alternates ?? { [options.locale]: options.path },
      type: options.type ?? 'website',
      publishedTime: options.publishedTime,
      modifiedTime: options.modifiedTime,
    },
  );
}
