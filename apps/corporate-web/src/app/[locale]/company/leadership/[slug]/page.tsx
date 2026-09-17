import { isLocale, type Locale } from '@cheezious/config';
import { buildBreadcrumbList, buildPerson, serializeJsonLd } from '@cheezious/seo';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';

import { StoryCard } from '@/components/blocks/collections';
import { BlockImage, RichText, Section, SectionHeader } from '@/components/blocks/primitives';
import { getPerson, getSettings, type MediaImage, type StorySummary } from '@/lib/content';
import { mediaUrl } from '@/lib/urls';
import { buildRouteSeo, siteUrl } from '@/lib/seo';

/**
 * A leadership profile.
 *
 * Deliberately restrained. A corporate profile page is where invented
 * biography creeps into a site, so this renders exactly what has been entered
 * and approved — no derived tenure, no inferred history, nothing assembled from
 * fragments.
 */

export const revalidate = 600;

interface RouteParams {
  locale: string;
  slug: string;
}

interface Person {
  id: string;
  name: string;
  slug: string;
  role: string;
  roleDetail: string | null;
  shortBio: string | null;
  fullBio: string | null;
  responsibilities: string | null;
  careerBackground: string | null;
  quote: string | null;
  quoteAttribution: string | null;
  linkedinUrl: string | null;
  seoTitle: string | null;
  seoDescription: string | null;
  portrait: MediaImage | null;
  heroImage: MediaImage | null;
  leadershipGroup: { id: string; name: string; slug: string } | null;
  relatedStories: StorySummary[];
}

export async function generateMetadata({ params }: { params: Promise<RouteParams> }): Promise<Metadata> {
  const { locale: localeParam, slug } = await params;
  if (!isLocale(localeParam)) return {};

  const locale = localeParam;
  const result = await getPerson(locale, slug);
  if (!result) return { title: 'Profile not found', robots: { index: false, follow: false } };

  const person = result.person as unknown as Person;
  const settings = await getSettings(locale).catch(() => ({}) as Record<string, unknown>);

  return buildRouteSeo({
    locale,
    path: `/${locale}/company/leadership/${slug}`,
    title: person.seoTitle ?? `${person.name} — ${person.role}`,
    description: person.seoDescription ?? person.shortBio ?? `${person.name}, ${person.role} at Cheezious.`,
    siteName: (settings['site.name'] as string) ?? 'Cheezious Corporate',
    imageUrl: person.portrait ? (mediaUrl(person.portrait.storageKey) ?? undefined) : undefined,
    type: 'article',
    alternates: Object.fromEntries(
      Object.entries(result.alternates).map(([code, value]) => [code, `/${code}/company/leadership/${value}`]),
    ) as Partial<Record<Locale, string>>,
  });
}

export default async function PersonPage({ params }: { params: Promise<RouteParams> }) {
  const { locale: localeParam, slug } = await params;
  if (!isLocale(localeParam)) notFound();

  const locale: Locale = localeParam;
  const result = await getPerson(locale, slug);
  if (!result) notFound();

  const person = result.person as unknown as Person;
  const settings = await getSettings(locale).catch(() => ({}) as Record<string, unknown>);
  const url = `${siteUrl()}/${locale}/company/leadership/${slug}`;

  const structuredData = serializeJsonLd([
    buildPerson({
      name: person.name,
      jobTitle: person.role,
      url,
      imageUrl: person.portrait ? (mediaUrl(person.portrait.storageKey) ?? undefined) : undefined,
      description: person.shortBio ?? undefined,
      sameAs: person.linkedinUrl ? [person.linkedinUrl] : undefined,
      organizationName: (settings['site.name'] as string) ?? 'Cheezious',
    }),
    buildBreadcrumbList([
      { name: 'Company', url: `${siteUrl()}/${locale}/company` },
      { name: 'Leadership', url: `${siteUrl()}/${locale}/company/leadership` },
      { name: person.name, url },
    ]),
  ]);

  const sections = [
    { heading: 'Responsibilities', html: person.responsibilities },
    { heading: 'Background', html: person.careerBackground },
  ].filter((section): section is { heading: string; html: string } => Boolean(section.html));

  return (
    <>
      {structuredData ? (
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: structuredData }} />
      ) : null}

      <Section width="standard" spacing="compact">
        <nav aria-label="Breadcrumb" className="mb-8">
          <ol className="flex flex-wrap items-center gap-2 text-body-xs uppercase tracking-widest text-ink-faint">
            <li>
              <Link href={`/${locale}/company`} className="no-underline hover:text-ink">
                Company
              </Link>
            </li>
            <li aria-hidden="true">/</li>
            <li>
              <Link href={`/${locale}/company/leadership`} className="no-underline hover:text-ink">
                Leadership
              </Link>
            </li>
            <li aria-hidden="true">/</li>
            <li aria-current="page">{person.name}</li>
          </ol>
        </nav>

        <div className="grid gap-12 md:grid-cols-[320px_minmax(0,1fr)] md:items-start">
          <div>
            <BlockImage image={person.portrait} sizes="(min-width: 768px) 320px, 100vw" aspectRatio="4:5" priority />
          </div>

          <div>
            {person.leadershipGroup ? (
              <p className="text-body-xs uppercase tracking-widest text-accent-ink">
                {person.leadershipGroup.name}
              </p>
            ) : null}

            <h1 className="mt-4 text-display-sm text-ink">{person.name}</h1>
            <p className="mt-3 text-body-lg text-ink-muted">{person.role}</p>
            {person.roleDetail ? <p className="mt-1 text-body-sm text-ink-faint">{person.roleDetail}</p> : null}

            {person.shortBio ? <p className="mt-8 text-body-lg text-ink-soft">{person.shortBio}</p> : null}

            {person.linkedinUrl ? (
              <p className="mt-6">
                <a
                  href={person.linkedinUrl}
                  target="_blank"
                  rel="noopener noreferrer me"
                  className="text-body-sm uppercase tracking-widest text-ink no-underline hover:text-accent-ink"
                >
                  LinkedIn
                  <span className="sr-only"> (opens in a new tab)</span>
                </a>
              </p>
            ) : null}
          </div>
        </div>
      </Section>

      {person.fullBio ? (
        <Section width="narrow" spacing="standard">
          <RichText html={person.fullBio} className="prose-editorial" />
        </Section>
      ) : null}

      {sections.map((section) => (
        <Section key={section.heading} width="narrow" spacing="compact">
          <SectionHeader heading={section.heading} headingLevel={2} />
          <div className="mt-6">
            <RichText html={section.html} />
          </div>
        </Section>
      ))}

      {person.quote ? (
        <Section tone="muted" width="narrow">
          <blockquote className="text-display-xs text-ink">
            <p>“{person.quote}”</p>
            {person.quoteAttribution ? (
              <footer className="mt-6 text-body-sm uppercase tracking-widest text-ink-faint">
                {person.quoteAttribution}
              </footer>
            ) : null}
          </blockquote>
        </Section>
      ) : null}

      {person.relatedStories.length > 0 ? (
        <Section width="wide">
          <SectionHeader eyebrow="In the newsroom" heading={`Stories featuring ${person.name.split(' ')[0]}`} />
          <div className="mt-10 grid gap-8 md:grid-cols-3">
            {person.relatedStories.map((story) => (
              <StoryCard key={story.id} story={story} locale={locale} />
            ))}
          </div>
        </Section>
      ) : null}
    </>
  );
}
