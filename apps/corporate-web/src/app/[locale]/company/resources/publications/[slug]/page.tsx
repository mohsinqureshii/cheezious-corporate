import { isLocale, type Locale } from '@cheezious/config';
import { buildBreadcrumbList, buildReport, serializeJsonLd } from '@cheezious/seo';
import { formatFileSize } from '@cheezious/utilities';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';

import { BlockImage, Section, SectionHeader } from '@/components/blocks/primitives';
import { getReport, getSettings } from '@/lib/content';
import { buildRouteSeo, siteUrl } from '@/lib/seo';
import { mediaUrl } from '@/lib/urls';

/**
 * One publication.
 *
 * A report is a document, not an article, so this page is a record rather than
 * a read: what the document is, when it was published, and the files it
 * consists of. The page exists so the document has an address that can be
 * linked, cited and indexed — which a direct link to a file in object storage
 * cannot be, because it changes whenever the file is replaced.
 */

export const revalidate = 600;

interface RouteParams {
  locale: string;
  slug: string;
}

const PATH = (locale: string, slug: string) => `/${locale}/company/resources/publications/${slug}`;

function describe(report: Record<string, unknown>): string {
  const description = report.description as string | null;
  if (description) return description;
  const year = report.year as number | undefined;
  return year
    ? `A Cheezious corporate publication from ${year}.`
    : 'A Cheezious corporate publication.';
}

export async function generateMetadata({
  params,
}: {
  params: Promise<RouteParams>;
}): Promise<Metadata> {
  const { locale: localeParam, slug } = await params;
  if (!isLocale(localeParam)) return {};

  const locale = localeParam;
  const result = await getReport(locale, slug);
  if (!result) {
    return { title: 'Publication not found', robots: { index: false, follow: false } };
  }

  const { report } = result;
  const settings = await getSettings(locale).catch(() => ({}) as Record<string, unknown>);
  const cover = report.cover as { storageKey: string } | null;

  return buildRouteSeo({
    locale,
    settings,
    path: PATH(locale, slug),
    title: (report.seoTitle as string) ?? (report.title as string),
    description: (report.seoDescription as string) ?? describe(report),
    imageUrl: cover ? (mediaUrl(cover.storageKey) ?? undefined) : undefined,
    publishedTime: (report.publicationDate as string) ?? null,
    modifiedTime: (report.updatedAt as string) ?? null,
    alternates: Object.fromEntries(
      Object.entries(result.alternates).map(([code, value]) => [code, PATH(code, value)]),
    ) as Partial<Record<Locale, string>>,
  });
}

export default async function PublicationPage({ params }: { params: Promise<RouteParams> }) {
  const { locale: localeParam, slug } = await params;
  if (!isLocale(localeParam)) notFound();

  const locale: Locale = localeParam;
  const result = await getReport(locale, slug);
  if (!result) notFound();

  const { report, related } = result;
  const settings = await getSettings(locale).catch(() => ({}) as Record<string, unknown>);
  const cover = report.cover as { storageKey: string; altText?: string | null } | null;
  const category = report.category as { name: string; slug: string } | null;
  const files = (report.files ?? []) as Array<{
    label: string | null;
    locale: string | null;
    asset: {
      id: string;
      storageKey: string;
      mimeType: string | null;
      byteSize: number | null;
      originalName: string | null;
    };
  }>;
  const url = `${siteUrl()}${PATH(locale, slug)}`;
  const primary = files[0];

  const structuredData = serializeJsonLd([
    buildReport({
      name: report.title as string,
      url,
      description: describe(report),
      datePublished: (report.publicationDate as string) ?? null,
      fileUrl: primary ? (mediaUrl(primary.asset.storageKey) ?? undefined) : undefined,
      fileFormat: primary?.asset.mimeType ?? undefined,
      publisherName: (settings['site.name'] as string) ?? 'Cheezious',
    }),
    buildBreadcrumbList([
      { name: 'Company', url: `${siteUrl()}/${locale}/company` },
      { name: 'Publications', url: `${siteUrl()}/${locale}/company/resources/publications` },
      { name: report.title as string, url },
    ]),
  ]);

  return (
    <>
      {structuredData ? (
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: structuredData }} />
      ) : null}

      <Section width="standard" spacing="compact">
        <nav aria-label="Breadcrumb" className="mb-10">
          <ol className="flex flex-wrap items-center gap-2 text-body-xs uppercase tracking-widest text-ink-faint">
            <li>
              <Link
                href={`/${locale}/company`}
                className="text-ink-faint no-underline hover:text-ink"
              >
                Company
              </Link>
            </li>
            <li aria-hidden="true">/</li>
            <li>
              <Link
                href={`/${locale}/company/resources/publications`}
                className="text-ink-faint no-underline hover:text-ink"
              >
                Publications
              </Link>
            </li>
            <li aria-hidden="true">/</li>
            <li className="text-ink">{report.title as string}</li>
          </ol>
        </nav>

        <div className="grid gap-x-gutter gap-y-12 lg:grid-cols-12">
          {/* The cover is the document's identity; it leads on wide screens and
              follows the text on narrow ones, where a portrait image first would
              push the title below the fold. */}
          <div className="order-2 lg:order-1 lg:col-span-4">
            <div className="border border-ink-line bg-paper-raised">
              <BlockImage
                image={cover as never}
                sizes="(max-width: 1024px) 60vw, 30vw"
                aspectRatio="4:5"
                reveal={false}
              />
            </div>
          </div>

          <div className="order-1 lg:order-2 lg:col-span-7 lg:col-start-6">
            <p className="eyebrow text-ink-muted">
              {[category?.name, String(report.year ?? '')].filter(Boolean).join(' · ')}
            </p>
            <h1 className="mt-4 text-display-md text-ink">{report.title as string}</h1>
            {report.description ? (
              <p className="mt-6 max-w-prose text-body-lg text-ink-soft">
                {report.description as string}
              </p>
            ) : null}

            <dl className="mt-10 grid gap-6 border-t border-ink-line pt-8 sm:grid-cols-2">
              <div>
                <dt className="eyebrow text-ink-faint">Type</dt>
                <dd className="mt-2 text-body-md capitalize text-ink">
                  {String(report.type ?? '')
                    .replace(/_/g, ' ')
                    .toLowerCase()}
                </dd>
              </div>
              {report.publicationDate ? (
                <div>
                  <dt className="eyebrow text-ink-faint">Published</dt>
                  <dd className="mt-2 text-body-md text-ink">
                    <time dateTime={String(report.publicationDate)}>
                      {new Date(String(report.publicationDate)).toLocaleDateString(
                        locale === 'ur' ? 'ur-PK' : 'en-PK',
                        { year: 'numeric', month: 'long', day: 'numeric' },
                      )}
                    </time>
                  </dd>
                </div>
              ) : null}
            </dl>

            <div className="mt-10">
              <h2 className="text-heading-sm text-ink">Download</h2>
              {files.length > 0 ? (
                <ul className="mt-4 divide-y divide-ink-line border-y border-ink-line">
                  {files.map((file) => {
                    const href = mediaUrl(file.asset.storageKey);
                    const label = file.label ?? file.asset.originalName ?? 'Document';
                    return (
                      <li key={file.asset.id} className="py-4">
                        {href ? (
                          <a
                            href={href}
                            className="flex flex-wrap items-baseline justify-between gap-3 text-ink no-underline hover:text-brand-deep"
                            // The file is a document to keep, not a page to visit.
                            download
                          >
                            <span className="text-body-md">{label}</span>
                            <span className="text-body-xs uppercase tracking-widest text-ink-faint">
                              {[
                                file.asset.mimeType?.split('/').pop()?.toUpperCase(),
                                file.asset.byteSize ? formatFileSize(file.asset.byteSize) : null,
                              ]
                                .filter(Boolean)
                                .join(' · ')}
                            </span>
                          </a>
                        ) : (
                          <span className="text-body-md text-ink-muted">{label}</span>
                        )}
                      </li>
                    );
                  })}
                </ul>
              ) : (
                // Said plainly rather than hidden: a publication listed without a
                // file is a content gap somebody needs to close, and pretending
                // the section does not exist hides it from them too.
                <p className="mt-4 text-body-sm text-ink-muted">
                  No file has been attached to this publication yet.
                </p>
              )}
            </div>
          </div>
        </div>
      </Section>

      {related.length > 0 ? (
        <Section tone="muted" width="standard">
          <SectionHeader eyebrow="Also available" heading="Related publications" />
          <ul className="mt-10 grid gap-x-gutter gap-y-10 sm:grid-cols-2 lg:grid-cols-3">
            {related.map((item) => {
              const itemCover = item.cover as { storageKey: string } | null;
              return (
                <li key={item.id as string} className="group">
                  <Link
                    href={PATH(locale, item.slug as string)}
                    className="block text-ink no-underline"
                  >
                    <div className="overflow-hidden border border-ink-line bg-paper-raised">
                      <BlockImage
                        image={itemCover as never}
                        sizes="(max-width: 640px) 50vw, 25vw"
                        aspectRatio="4:5"
                        reveal={false}
                        className="transition-transform duration-slow ease-editorial group-hover:scale-[1.02]"
                      />
                    </div>
                    <p className="eyebrow mt-4 text-ink-muted">{String(item.year ?? '')}</p>
                    <h3 className="mt-2 text-heading-sm text-ink transition-colors duration-quick group-hover:text-brand-deep">
                      {item.title as string}
                    </h3>
                  </Link>
                </li>
              );
            })}
          </ul>
        </Section>
      ) : null}
    </>
  );
}
