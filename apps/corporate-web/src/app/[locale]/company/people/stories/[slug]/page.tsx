import { isLocale, type Locale } from '@cheezious/config';
import { buildArticle, buildBreadcrumbList, serializeJsonLd } from '@cheezious/seo';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';

import { PlaceholderBadge, Section, SectionHeader } from '@/components/blocks/primitives';
import { ArticleLayout } from '@/components/editorial/ArticleLayout';
import { getEmployeeStory, getSettings, type MediaImage } from '@/lib/content';
import { buildRouteSeo, siteUrl } from '@/lib/seo';
import { mediaUrl } from '@/lib/urls';

/**
 * One employee story.
 *
 * A career, told as an article with its progression shown as a timeline. The
 * timeline is the point: a careers page that only says "we invest in people"
 * asks to be believed, and one that shows a person going from crew member to
 * area manager over seven years does not have to.
 *
 * Nothing here is published without the colleague's agreement — that rule lives
 * in the CMS and in the placeholder copy the seed writes, not in this file, but
 * it is worth knowing when reading it.
 */

export const revalidate = 600;

interface RouteParams {
  locale: string;
  slug: string;
}

interface CareerMilestone {
  year?: number | string;
  title?: string;
  note?: string;
}

const PATH = (locale: string, slug: string) => `/${locale}/company/people/stories/${slug}`;

export async function generateMetadata({
  params,
}: {
  params: Promise<RouteParams>;
}): Promise<Metadata> {
  const { locale: localeParam, slug } = await params;
  if (!isLocale(localeParam)) return {};

  const locale = localeParam;
  const result = await getEmployeeStory(locale, slug);
  if (!result) return { title: 'Story not found', robots: { index: false, follow: false } };

  const { story } = result;
  const settings = await getSettings(locale).catch(() => ({}) as Record<string, unknown>);
  const image = (story.heroImage ?? story.portrait) as { storageKey: string } | null;
  const role = story.roleLabel as string | null;

  return buildRouteSeo({
    locale,
    settings,
    path: PATH(locale, slug),
    title: (story.seoTitle as string) ?? (story.title as string),
    description:
      (story.seoDescription as string) ??
      (story.excerpt as string) ??
      `A career at Cheezious${role ? `, told by a ${role.toLowerCase()}` : ''}.`,
    imageUrl: image ? (mediaUrl(image.storageKey) ?? undefined) : undefined,
    type: 'article',
    publishedTime: (story.publishedAt as string) ?? null,
    alternates: Object.fromEntries(
      Object.entries(result.alternates ?? {}).map(([code, value]) => [code, PATH(code, value)]),
    ) as Partial<Record<Locale, string>>,
  });
}

export default async function EmployeeStoryPage({ params }: { params: Promise<RouteParams> }) {
  const { locale: localeParam, slug } = await params;
  if (!isLocale(localeParam)) notFound();

  const locale: Locale = localeParam;
  const result = await getEmployeeStory(locale, slug);
  if (!result) notFound();

  const { story } = result;
  const settings = await getSettings(locale).catch(() => ({}) as Record<string, unknown>);
  const image = (story.heroImage ?? story.portrait ?? null) as MediaImage | null;
  const timeline = (
    Array.isArray(story.careerTimeline) ? story.careerTimeline : []
  ) as CareerMilestone[];
  const url = `${siteUrl()}${PATH(locale, slug)}`;

  const attribution = [story.roleLabel, story.departmentLabel, story.locationLabel]
    .filter((value): value is string => typeof value === 'string' && value.length > 0)
    .join(' · ');

  const structuredData = serializeJsonLd([
    buildArticle({
      headline: story.title as string,
      description: (story.excerpt as string) ?? undefined,
      url,
      imageUrl: image ? (mediaUrl(image.storageKey) ?? undefined) : undefined,
      publishedAt: (story.publishedAt as string) ?? null,
      publisherName: (settings['site.name'] as string) ?? 'Cheezious',
      isNews: false,
      section: 'Careers',
    }),
    buildBreadcrumbList([
      { name: 'Our People', url: `${siteUrl()}/${locale}/company/people` },
      { name: 'Employee Stories', url: `${siteUrl()}/${locale}/company/people/stories` },
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
        eyebrow={attribution || 'Careers'}
        headline={story.title as string}
        standfirst={(story.excerpt as string) ?? null}
        publishedAt={(story.publishedAt as string) ?? null}
        byline={(story.personName as string) ?? null}
        heroImage={image}
        body={(story.body as string) ?? null}
        breadcrumb={[
          { label: 'Our People', href: `/${locale}/company/people` },
          { label: 'Employee Stories', href: `/${locale}/company/people/stories` },
          { label: story.title as string },
        ]}
        related={
          <Section tone="muted" width="standard">
            <SectionHeader
              eyebrow="Careers"
              heading="Open roles"
              intro="Every colleague here started with an application."
            />
            <p className="mt-8">
              <Link
                href={`/${locale}/careers/jobs`}
                className="text-body-sm uppercase tracking-widest text-ink no-underline hover:text-brand-deep"
              >
                See what is open
              </Link>
            </p>
          </Section>
        }
      >
        {story.quote ? (
          <blockquote className="mt-12 border-s-2 border-brand ps-6">
            <p className="text-display-sm text-ink">{story.quote as string}</p>
            {story.personName ? (
              <footer className="mt-4 text-body-sm text-ink-muted">
                {story.personName as string}
                {attribution ? `, ${attribution}` : ''}
              </footer>
            ) : null}
          </blockquote>
        ) : null}

        {timeline.length > 0 ? (
          <div className="mt-14">
            <h2 className="text-heading-md text-ink">The path</h2>
            {/* An ordered list, because the order is the meaning. */}
            <ol className="mt-6 border-s border-ink-line">
              {timeline.map((milestone, index) => (
                <li
                  key={`${milestone.year ?? index}-${index}`}
                  className="relative ps-8 pb-8 last:pb-0"
                >
                  <span
                    aria-hidden="true"
                    className="absolute start-0 top-2 h-2 w-2 -translate-x-1/2 rounded-full bg-brand rtl:translate-x-1/2"
                  />
                  {milestone.year ? (
                    <p className="eyebrow text-ink-faint">{String(milestone.year)}</p>
                  ) : null}
                  {milestone.title ? (
                    <p className="mt-1 text-body-lg text-ink">{milestone.title}</p>
                  ) : null}
                  {milestone.note ? (
                    <p className="mt-1 text-body-sm text-ink-muted">{milestone.note}</p>
                  ) : null}
                </li>
              ))}
            </ol>
          </div>
        ) : null}

        {story.isDemoContent ? (
          <p className="mt-10">
            <PlaceholderBadge />
          </p>
        ) : null}
      </ArticleLayout>
    </>
  );
}
