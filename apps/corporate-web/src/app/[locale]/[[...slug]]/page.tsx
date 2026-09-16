import { isLocale, type Locale } from '@cheezious/config';
import {
  buildBreadcrumbList,
  buildFaqPage,
  buildOrganization,
  buildWebSite,
  serializeJsonLd,
  type JsonLd,
} from '@cheezious/seo';
import type { Metadata } from 'next';
import { notFound, permanentRedirect, redirect } from 'next/navigation';

import { BlockRenderer } from '@/components/blocks/BlockRenderer';
import { Breadcrumbs } from '@/components/shell/Breadcrumbs';
import { getPage, getPagePaths, getSettings, type MediaImage } from '@/lib/content';
import { collectPageImages, resolvePageReferences } from '@/lib/references';
import { buildPageSeo, siteUrl } from '@/lib/seo';

/**
 * The corporate site's page route.
 *
 * Every content page — roughly a hundred of them — is served here from the CMS.
 * Nothing about the information architecture is hardcoded in the file system, so
 * Corporate Communications adding a page is a publish, not a deployment.
 *
 * Statically generated at build time and revalidated on publish, which is what
 * keeps a deep corporate site fast without going stale.
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

function pathFromSlug(slug: string[] | undefined): string {
  return slug && slug.length > 0 ? `/${slug.join('/')}` : '/';
}

export async function generateMetadata({ params }: { params: Promise<RouteParams> }): Promise<Metadata> {
  const { locale: localeParam, slug } = await params;
  if (!isLocale(localeParam)) return {};

  const locale = localeParam;
  const path = pathFromSlug(slug);

  const response = await getPage(locale, path);
  const page = response?.page;
  if (!page) return { title: 'Page not found', robots: { index: false, follow: false } };

  const settings = await getSettings(locale).catch(() => ({}) as Record<string, unknown>);
  return buildPageSeo(page, locale, settings);
}

export default async function CorporatePage({
  params,
  searchParams,
}: {
  params: Promise<RouteParams>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { locale: localeParam, slug } = await params;
  if (!isLocale(localeParam)) notFound();

  const locale: Locale = localeParam;
  const path = pathFromSlug(slug);
  const query = await searchParams;

  // A preview token renders the working copy rather than what is published.
  // Uncacheable by construction, so an editor's draft can never be served to a
  // visitor from a shared cache.
  const previewToken = typeof query.preview === 'string' ? query.preview : undefined;

  const response = await getPage(locale, path, { previewToken });

  if (response?.redirect) {
    const destination = `/${locale}${response.redirect.destination}`;
    // 301 vs 302 is honoured: a permanent move should be cached by the browser
    // and consolidated by search engines.
    if (response.redirect.statusCode === 301) permanentRedirect(destination);
    redirect(destination);
  }

  const page = response?.page;
  if (!page) notFound();

  const [images, pathById, settings] = await Promise.all([
    collectPageImages(page),
    resolvePageReferences(page, locale),
    getSettings(locale).catch(() => ({}) as Record<string, unknown>),
  ]);

  const structuredData = buildStructuredData(page, locale, settings, images);

  // The hero owns the page's visual opening; an overlay hero needs the header
  // to start transparent, which is signalled by the first block's type.
  const firstBlock = page.blocks[0];
  const hasOverlayHero =
    firstBlock?.blockKey === 'HeroEditorial' ||
    firstBlock?.blockKey === 'HeroMedia' ||
    firstBlock?.blockKey === 'HeroVideo';

  return (
    <>
      {structuredData ? (
        <script
          type="application/ld+json"
          // Serialised with `<` escaped, so content cannot break out of the tag.
          dangerouslySetInnerHTML={{ __html: structuredData }}
        />
      ) : null}

      {response?.isPreview ? <PreviewBanner locale={locale} /> : null}

      {/*
        Breadcrumbs matter most on the deep pages, which are exactly the ones
        with a full-bleed hero. Rather than dropping them there, they are placed
        directly beneath the hero so the opening stays intact and the trail is
        still the first thing after it.
      */}
      {!hasOverlayHero ? <Breadcrumbs page={page} locale={locale} pathById={pathById} /> : null}

      <BlockRenderer
        blocks={page.blocks}
        locale={locale}
        images={images}
        pathById={pathById}
        afterFirstBlock={
          hasOverlayHero ? <Breadcrumbs page={page} locale={locale} pathById={pathById} /> : null
        }
      />
    </>
  );
}

/** A standing reminder that what is on screen is not what the public sees. */
function PreviewBanner({ locale }: { locale: Locale }) {
  return (
    <div className="sticky top-[var(--header-height)] z-sticky bg-signal-warning px-gutter py-2.5 text-center">
      <p className="text-body-sm font-semibold text-white">
        Preview — this shows unpublished content and is not visible to the public.{' '}
        <a href={`/${locale}/api/preview/exit`} className="underline underline-offset-2">
          Exit preview
        </a>
      </p>
    </div>
  );
}

/**
 * Structured data for a page.
 *
 * The organisation and website nodes are emitted on the corporate home page
 * only — repeating them on every page is noise. Breadcrumbs are emitted wherever
 * the page has real ancestry, and FAQ markup only where an editor has explicitly
 * confirmed the content is a genuine question-and-answer list.
 */
function buildStructuredData(
  page: { path: string; title: string; summary: string | null; parent: { path: string; title: string; navLabel: string | null } | null; blocks: Array<{ blockKey: string; data: Record<string, unknown> }> },
  locale: Locale,
  settings: Record<string, unknown>,
  images: Map<string, MediaImage>,
): string | null {
  const nodes: Array<JsonLd | null> = [];
  const origin = siteUrl();
  const siteName = (settings['site.name'] as string) ?? 'Cheezious Corporate';

  if (page.path === '/company') {
    const social = (settings['social.links'] as Array<{ url: string }> | undefined) ?? [];
    nodes.push(
      buildOrganization({
        name: 'Cheezious',
        url: `${origin}/${locale}/company`,
        description: (settings['site.defaultDescription'] as string) ?? undefined,
        sameAs: social.map((link) => link.url),
        addressCountry: 'PK',
        ...(settings['contact.corporateEmail'] ? { contactEmail: settings['contact.corporateEmail'] as string } : {}),
      }),
      buildWebSite({
        name: siteName,
        url: `${origin}/${locale}`,
        searchUrlTemplate: `${origin}/${locale}/search?q={search_term_string}`,
      }),
    );
  }

  // Breadcrumbs from the page hierarchy. Omitted for top-level pages, where a
  // single-item breadcrumb conveys nothing.
  const crumbs: Array<{ name: string; url: string }> = [
    { name: siteName, url: `${origin}/${locale}/company` },
  ];
  if (page.parent && page.parent.path !== '/company') {
    crumbs.push({
      name: page.parent.navLabel ?? page.parent.title,
      url: `${origin}/${locale}${page.parent.path}`,
    });
  }
  if (page.path !== '/company') {
    crumbs.push({ name: page.title, url: `${origin}/${locale}${page.path}` });
  }
  nodes.push(buildBreadcrumbList(crumbs));

  // FAQ markup is opt-in per block. Marking every accordion as an FAQ is
  // structured-data abuse and risks a manual action.
  const faqBlock = page.blocks.find(
    (block) => block.blockKey === 'FAQ' && block.data.emitStructuredData === true,
  );
  if (faqBlock) {
    const items = (faqBlock.data.items as Array<{ question: string; answer: string }>) ?? [];
    nodes.push(buildFaqPage(items));
  }

  void images;
  return serializeJsonLd(nodes);
}
