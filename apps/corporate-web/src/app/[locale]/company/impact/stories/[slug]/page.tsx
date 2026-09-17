import { isLocale, type Locale } from '@cheezious/config';
import { buildArticle, buildBreadcrumbList, serializeJsonLd } from '@cheezious/seo';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { PlaceholderBadge } from '@/components/blocks/primitives';
import { ArticleLayout } from '@/components/editorial/ArticleLayout';
import { getImpactStory, getSettings, type MediaImage } from '@/lib/content';
import { buildRouteSeo, siteUrl } from '@/lib/seo';
import { mediaUrl } from '@/lib/urls';

/**
 * One impact story.
 *
 * Read as an article, because that is what it is: an account of a programme,
 * with a pillar for context and a year for provenance. The year matters more
 * here than on a newsroom story — an impact claim without a date is a claim
 * about the present, and it should not silently become one.
 */

export const revalidate = 600;

interface RouteParams {
  locale: string;
  slug: string;
}

const PATH = (locale: string, slug: string) => `/${locale}/company/impact/stories/${slug}`;

export async function generateMetadata({
  params,
}: {
  params: Promise<RouteParams>;
}): Promise<Metadata> {
  const { locale: localeParam, slug } = await params;
  if (!isLocale(localeParam)) return {};

  const locale = localeParam;
  const result = await getImpactStory(locale, slug);
  if (!result) return { title: 'Story not found', robots: { index: false, follow: false } };

  const { story } = result;
  const settings = await getSettings(locale).catch(() => ({}) as Record<string, unknown>);
  const image = story.image as { storageKey: string } | null;
  const pillar = story.pillar as { name: string } | null;

  return buildRouteSeo({
    locale,
    settings,
    path: PATH(locale, slug),
    title: (story.seoTitle as string) ?? (story.title as string),
    description:
      (story.seoDescription as string) ??
      (story.excerpt as string) ??
      `An account of Cheezious work${pillar ? ` on ${pillar.name.toLowerCase()}` : ''}.`,
    imageUrl: image ? (mediaUrl(image.storageKey) ?? undefined) : undefined,
    type: 'article',
    publishedTime: (story.publishedAt as string) ?? null,
    alternates: Object.fromEntries(
      Object.entries(result.alternates ?? {}).map(([code, value]) => [code, PATH(code, value)]),
    ) as Partial<Record<Locale, string>>,
  });
}

export default async function ImpactStoryPage({ params }: { params: Promise<RouteParams> }) {
  const { locale: localeParam, slug } = await params;
  if (!isLocale(localeParam)) notFound();

  const locale: Locale = localeParam;
  const result = await getImpactStory(locale, slug);
  if (!result) notFound();

  const { story } = result;
  const settings = await getSettings(locale).catch(() => ({}) as Record<string, unknown>);
  const image = (story.image ?? null) as MediaImage | null;
  const pillar = story.pillar as { name: string; slug: string } | null;
  const url = `${siteUrl()}${PATH(locale, slug)}`;

  const structuredData = serializeJsonLd([
    buildArticle({
      headline: story.title as string,
      description: (story.excerpt as string) ?? undefined,
      url,
      imageUrl: image ? (mediaUrl(image.storageKey) ?? undefined) : undefined,
      publishedAt: (story.publishedAt as string) ?? null,
      publisherName: (settings['site.name'] as string) ?? 'Cheezious',
      isNews: false,
      section: pillar?.name,
    }),
    buildBreadcrumbList([
      { name: 'Impact', url: `${siteUrl()}/${locale}/company/impact` },
      { name: story.title as string, url },
    ]),
  ]);

  return (
    <>
      {structuredData ? (
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: structuredData }} />
      ) : null}

      <ArticleLayout
        locale={locale}
        eyebrow={
          [pillar?.name, story.year ? String(story.year) : null].filter(Boolean).join(' · ') || null
        }
        headline={story.title as string}
        standfirst={(story.excerpt as string) ?? null}
        dateline={(story.location as string) ?? null}
        publishedAt={(story.publishedAt as string) ?? null}
        heroImage={image}
        body={(story.body as string) ?? null}
        breadcrumb={[
          { label: 'Impact', href: `/${locale}/company/impact` },
          { label: 'Stories', href: `/${locale}/company/impact/stories` },
          { label: story.title as string },
        ]}
      >
        {story.isDemoContent ? (
          // Demonstration content is labelled wherever it is read, not only in
          // the listing that led here. A reader arriving from search sees the
          // page, not the listing.
          <p className="mt-10">
            <PlaceholderBadge />
          </p>
        ) : null}
      </ArticleLayout>
    </>
  );
}
