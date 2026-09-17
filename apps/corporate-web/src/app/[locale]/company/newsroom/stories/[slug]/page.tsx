import { isLocale, type Locale } from '@cheezious/config';
import { buildArticle, buildBreadcrumbList, serializeJsonLd } from '@cheezious/seo';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';

import { StoryCard } from '@/components/blocks/collections';
import { Section, SectionHeader } from '@/components/blocks/primitives';
import { ArticleLayout } from '@/components/editorial/ArticleLayout';
import { getSettings, getStory } from '@/lib/content';
import { buildRouteSeo, siteUrl } from '@/lib/seo';
import { mediaUrl } from '@/lib/urls';

/**
 * A newsroom story.
 *
 * One route for every kind of story — company news, people, expansion — because
 * they differ in their category, not in how they are read. The category is what
 * the eyebrow says and what the listing filters on.
 */

export const revalidate = 300;

interface RouteParams {
  locale: string;
  slug: string;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<RouteParams>;
}): Promise<Metadata> {
  const { locale: localeParam, slug } = await params;
  if (!isLocale(localeParam)) return {};

  const locale = localeParam;
  const result = await getStory(locale, slug);
  if (!result) return { title: 'Story not found', robots: { index: false, follow: false } };

  const { story } = result;
  const settings = await getSettings(locale).catch(() => ({}) as Record<string, unknown>);
  const image = story.heroImage ?? story.thumbnail;

  return buildRouteSeo({
    locale,
    settings,
    path: `/${locale}/company/newsroom/stories/${slug}`,
    title: story.title,
    description: story.excerpt ?? `A story from the Cheezious newsroom.`,
    siteName: (settings['site.name'] as string) ?? 'Cheezious Corporate',
    imageUrl: image ? (mediaUrl(image.storageKey) ?? undefined) : undefined,
    type: 'article',
    publishedTime: story.publishedAt,
    alternates: Object.fromEntries(
      Object.entries(result.alternates).map(([code, value]) => [
        code,
        `/${code}/company/newsroom/stories/${value}`,
      ]),
    ) as Partial<Record<Locale, string>>,
  });
}

export default async function StoryPage({ params }: { params: Promise<RouteParams> }) {
  const { locale: localeParam, slug } = await params;
  if (!isLocale(localeParam)) notFound();

  const locale: Locale = localeParam;
  const result = await getStory(locale, slug);
  if (!result) notFound();

  const { story } = result;
  const settings = await getSettings(locale).catch(() => ({}) as Record<string, unknown>);
  const image = story.heroImage ?? story.thumbnail;
  const url = `${siteUrl()}/${locale}/company/newsroom/stories/${slug}`;

  const structuredData = serializeJsonLd([
    buildArticle({
      headline: story.title,
      description: story.excerpt ?? undefined,
      url,
      imageUrl: image ? (mediaUrl(image.storageKey) ?? undefined) : undefined,
      publishedAt: story.publishedAt,
      authorName: (story as { authorName?: string | null }).authorName ?? undefined,
      publisherName: (settings['site.name'] as string) ?? 'Cheezious',
      // News is a NewsArticle; an evergreen story is an Article. Marking an
      // evergreen piece as news is how a newsroom loses its news treatment.
      isNews: story.kind === 'NEWS',
      section: story.category?.name,
    }),
    buildBreadcrumbList([
      { name: 'Company', url: `${siteUrl()}/${locale}/company` },
      { name: 'Newsroom', url: `${siteUrl()}/${locale}/company/newsroom` },
      { name: story.title, url },
    ]),
  ]);

  return (
    <>
      {structuredData ? (
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: structuredData }} />
      ) : null}

      <ArticleLayout
        locale={locale}
        eyebrow={story.category?.name ?? null}
        headline={story.title}
        standfirst={story.excerpt}
        publishedAt={story.publishedAt}
        byline={(story as { authorName?: string | null }).authorName ?? null}
        readingMinutes={story.readingMinutes}
        heroImage={image}
        body={story.body}
        breadcrumb={[
          { label: 'Company', href: `/${locale}/company` },
          { label: 'Newsroom', href: `/${locale}/company/newsroom` },
          { label: story.title },
        ]}
        related={
          story.related.length > 0 ? (
            <Section tone="muted" width="wide">
              <SectionHeader eyebrow="More from the newsroom" heading="Related stories" />
              <div className="mt-10 grid gap-8 md:grid-cols-3">
                {story.related.map((related) => (
                  <StoryCard key={related.id} story={related} locale={locale} />
                ))}
              </div>
              <p className="mt-10">
                <Link
                  href={`/${locale}/company/newsroom`}
                  className="text-body-sm uppercase tracking-widest text-ink no-underline hover:text-accent-ink"
                >
                  All newsroom
                </Link>
              </p>
            </Section>
          ) : null
        }
      />
    </>
  );
}
