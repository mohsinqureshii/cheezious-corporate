import { isLocale, type Locale } from '@cheezious/config';
import { buildArticle, buildBreadcrumbList, serializeJsonLd } from '@cheezious/seo';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';

import { ArticleLayout } from '@/components/editorial/ArticleLayout';
import { Section, SectionHeader } from '@/components/blocks/primitives';
import { getPressRelease, getSettings } from '@/lib/content';
import { mediaUrl } from '@/lib/urls';
import { buildRouteSeo, siteUrl } from '@/lib/seo';
import type { MediaImage } from '@/lib/content';

/**
 * A press release.
 *
 * Written for journalists, so three things are treated as load-bearing: the
 * dateline, the media contact, and the attachments. A release that makes a
 * reporter hunt for who to call is a release that does not get written up.
 *
 * Marked up as a NewsArticle, and only ever offering attachments that have been
 * cleared for public download — the API filters those, and this page shows what
 * it is given rather than deciding for itself.
 */

export const revalidate = 300;

interface RouteParams {
  locale: string;
  slug: string;
}

interface Attachment {
  label: string | null;
  asset: { id: string; storageKey: string; originalName: string; mimeType: string; byteSize: number };
}

interface PressRelease {
  id: string;
  headline: string;
  slug: string;
  summary: string | null;
  body: string | null;
  dateline: string | null;
  publishedAt: string | null;
  updatedAt: string | null;
  noindex: boolean;
  seoTitle: string | null;
  seoDescription: string | null;
  category: { name: string; slug: string } | null;
  image: MediaImage | null;
  mediaContact: { name: string; role: string | null; email: string | null; phone: string | null } | null;
  attachments: Attachment[];
}

export async function generateMetadata({ params }: { params: Promise<RouteParams> }): Promise<Metadata> {
  const { locale: localeParam, slug } = await params;
  if (!isLocale(localeParam)) return {};

  const locale = localeParam;
  const result = await getPressRelease(locale, slug);
  if (!result) return { title: 'Press release not found', robots: { index: false, follow: false } };

  const release = result.pressRelease as unknown as PressRelease;
  const settings = await getSettings(locale).catch(() => ({}) as Record<string, unknown>);

  return buildRouteSeo({
    locale,
    path: `/${locale}/company/newsroom/press-releases/${slug}`,
    title: release.seoTitle ?? release.headline,
    description: release.seoDescription ?? release.summary ?? 'A press release from Cheezious.',
    siteName: (settings['site.name'] as string) ?? 'Cheezious Corporate',
    imageUrl: release.image ? (mediaUrl(release.image.storageKey) ?? undefined) : undefined,
    noindex: release.noindex,
    type: 'article',
    publishedTime: release.publishedAt,
    modifiedTime: release.updatedAt,
    alternates: Object.fromEntries(
      Object.entries(result.alternates).map(([code, value]) => [
        code,
        `/${code}/company/newsroom/press-releases/${value}`,
      ]),
    ) as Partial<Record<Locale, string>>,
  });
}

export default async function PressReleasePage({ params }: { params: Promise<RouteParams> }) {
  const { locale: localeParam, slug } = await params;
  if (!isLocale(localeParam)) notFound();

  const locale: Locale = localeParam;
  const result = await getPressRelease(locale, slug);
  if (!result) notFound();

  const release = result.pressRelease as unknown as PressRelease;
  const settings = await getSettings(locale).catch(() => ({}) as Record<string, unknown>);
  const url = `${siteUrl()}/${locale}/company/newsroom/press-releases/${slug}`;

  const structuredData = serializeJsonLd([
    buildArticle({
      headline: release.headline,
      description: release.summary ?? undefined,
      url,
      imageUrl: release.image ? (mediaUrl(release.image.storageKey) ?? undefined) : undefined,
      publishedAt: release.publishedAt,
      modifiedAt: release.updatedAt,
      publisherName: (settings['site.name'] as string) ?? 'Cheezious',
      isNews: true,
      section: release.category?.name,
    }),
    buildBreadcrumbList([
      { name: 'Company', url: `${siteUrl()}/${locale}/company` },
      { name: 'Newsroom', url: `${siteUrl()}/${locale}/company/newsroom` },
      { name: 'Press releases', url: `${siteUrl()}/${locale}/company/newsroom/press-releases` },
      { name: release.headline, url },
    ]),
  ]);

  return (
    <>
      {structuredData ? (
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: structuredData }} />
      ) : null}

      <ArticleLayout
        locale={locale}
        eyebrow={release.category?.name ?? 'Press release'}
        headline={release.headline}
        standfirst={release.summary}
        dateline={release.dateline}
        publishedAt={release.publishedAt}
        updatedAt={release.updatedAt}
        heroImage={release.image}
        body={release.body}
        breadcrumb={[
          { label: 'Company', href: `/${locale}/company` },
          { label: 'Newsroom', href: `/${locale}/company/newsroom` },
          { label: 'Press releases', href: `/${locale}/company/newsroom/press-releases` },
          { label: release.headline },
        ]}
      >
        {release.attachments.length > 0 ? (
          <Section width="narrow" spacing="compact">
            <SectionHeader eyebrow="For media" heading="Attachments" headingLevel={3} />
            <ul className="mt-6 divide-y divide-rule">
              {release.attachments.map((attachment) => {
                const href = mediaUrl(attachment.asset.storageKey);
                if (!href) return null;
                return (
                  <li key={attachment.asset.id} className="flex flex-wrap items-baseline justify-between gap-4 py-4">
                    <a href={href} className="text-body-md text-ink no-underline underline-offset-4 hover:underline" download>
                      {attachment.label ?? attachment.asset.originalName}
                    </a>
                    <span className="text-body-xs uppercase tracking-widest text-ink-faint">
                      {attachment.asset.mimeType.split('/')[1]} · {formatBytes(attachment.asset.byteSize)}
                    </span>
                  </li>
                );
              })}
            </ul>
          </Section>
        ) : null}

        {release.mediaContact ? (
          <Section tone="muted" width="narrow" spacing="compact">
            <SectionHeader eyebrow="Media enquiries" heading={release.mediaContact.name} headingLevel={3} />
            {release.mediaContact.role ? (
              <p className="mt-2 text-body-sm text-ink-muted">{release.mediaContact.role}</p>
            ) : null}
            <p className="mt-4 flex flex-wrap gap-x-6 gap-y-1 text-body-sm">
              {release.mediaContact.email ? (
                <a href={`mailto:${release.mediaContact.email}`} className="text-ink underline underline-offset-4">
                  {release.mediaContact.email}
                </a>
              ) : null}
              {release.mediaContact.phone ? (
                <a href={`tel:${release.mediaContact.phone.replace(/\s+/g, '')}`} className="text-ink underline underline-offset-4">
                  {release.mediaContact.phone}
                </a>
              ) : null}
            </p>
          </Section>
        ) : (
          <Section width="narrow" spacing="compact">
            <p className="text-body-sm text-ink-muted">
              For media enquiries, see the{' '}
              <Link href={`/${locale}/company/newsroom/media-contacts`} className="text-ink underline underline-offset-4">
                press office
              </Link>
              .
            </p>
          </Section>
        )}
      </ArticleLayout>
    </>
  );
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
