import { isLocale, type Locale } from '@cheezious/config';
import { buildBreadcrumbList, serializeJsonLd } from '@cheezious/seo';
import { formatDate } from '@cheezious/utilities';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';

import { RichText, Section, SectionHeader } from '@/components/blocks/primitives';
import { getPolicy, getSettings } from '@/lib/content';
import { mediaUrl } from '@/lib/urls';
import { buildRouteSeo, siteUrl } from '@/lib/seo';

/**
 * A published policy.
 *
 * A policy is a document with a version and an effective date, not an article,
 * so both are shown at the top rather than buried: a reader needs to know which
 * version they are looking at before they read a word of it.
 *
 * The version history is shown when it exists, because superseded versions are
 * the part people come here to check.
 */

export const revalidate = 600;

interface RouteParams {
  locale: string;
  slug: string;
}

interface Policy {
  id: string;
  title: string;
  slug: string;
  summary: string | null;
  body: string | null;
  version: string;
  effectiveDate: string | null;
  reviewDate: string | null;
  ownerLabel: string | null;
  seoTitle: string | null;
  seoDescription: string | null;
  isDemoContent?: boolean;
  category: { name: string; slug: string } | null;
  document: { id: string; storageKey: string; originalName: string; mimeType: string; byteSize: number } | null;
  versions: Array<{
    version: string;
    effectiveDate: string | null;
    supersededAt: string | null;
    summaryOfChanges: string | null;
  }>;
}

export async function generateMetadata({ params }: { params: Promise<RouteParams> }): Promise<Metadata> {
  const { locale: localeParam, slug } = await params;
  if (!isLocale(localeParam)) return {};

  const locale = localeParam;
  const result = await getPolicy(locale, slug);
  if (!result) return { title: 'Policy not found', robots: { index: false, follow: false } };

  const policy = result.policy as unknown as Policy;
  const settings = await getSettings(locale).catch(() => ({}) as Record<string, unknown>);

  return buildRouteSeo({
    locale,
    path: `/${locale}/company/governance/policies/${slug}`,
    title: policy.seoTitle ?? policy.title,
    description:
      policy.seoDescription ?? policy.summary ?? `${policy.title}, version ${policy.version}, from Cheezious.`,
    siteName: (settings['site.name'] as string) ?? 'Cheezious Corporate',
    type: 'article',
    publishedTime: policy.effectiveDate,
    alternates: Object.fromEntries(
      Object.entries(result.alternates).map(([code, value]) => [
        code,
        `/${code}/company/governance/policies/${value}`,
      ]),
    ) as Partial<Record<Locale, string>>,
  });
}

export default async function PolicyPage({ params }: { params: Promise<RouteParams> }) {
  const { locale: localeParam, slug } = await params;
  if (!isLocale(localeParam)) notFound();

  const locale: Locale = localeParam;
  const result = await getPolicy(locale, slug);
  if (!result) notFound();

  const policy = result.policy as unknown as Policy;
  const url = `${siteUrl()}/${locale}/company/governance/policies/${slug}`;
  const documentHref = policy.document ? mediaUrl(policy.document.storageKey) : null;

  const structuredData = serializeJsonLd([
    buildBreadcrumbList([
      { name: 'Company', url: `${siteUrl()}/${locale}/company` },
      { name: 'Governance', url: `${siteUrl()}/${locale}/company/governance` },
      { name: 'Policies', url: `${siteUrl()}/${locale}/company/governance/policies` },
      { name: policy.title, url },
    ]),
  ]);

  return (
    <>
      {structuredData ? (
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: structuredData }} />
      ) : null}

      <Section width="narrow" spacing="compact">
        <nav aria-label="Breadcrumb" className="mb-8">
          <ol className="flex flex-wrap items-center gap-2 text-body-xs uppercase tracking-widest text-ink-faint">
            <li>
              <Link href={`/${locale}/company/governance`} className="no-underline hover:text-ink">
                Governance
              </Link>
            </li>
            <li aria-hidden="true">/</li>
            <li>
              <Link href={`/${locale}/company/governance/policies`} className="no-underline hover:text-ink">
                Policies
              </Link>
            </li>
            <li aria-hidden="true">/</li>
            <li aria-current="page">{policy.title}</li>
          </ol>
        </nav>

        {policy.category ? (
          <p className="text-body-xs uppercase tracking-widest text-accent-ink">{policy.category.name}</p>
        ) : null}

        <h1 className="mt-4 text-display-sm text-ink">{policy.title}</h1>
        {policy.summary ? <p className="mt-6 text-body-lg text-ink-muted">{policy.summary}</p> : null}

        <dl className="mt-10 grid gap-6 border-y border-rule py-6 sm:grid-cols-3">
          <div>
            <dt className="text-body-xs uppercase tracking-widest text-ink-faint">Version</dt>
            <dd className="mt-1 text-body-md text-ink">{policy.version}</dd>
          </div>
          <div>
            <dt className="text-body-xs uppercase tracking-widest text-ink-faint">Effective from</dt>
            <dd className="mt-1 text-body-md text-ink">
              {policy.effectiveDate ? (
                <time dateTime={policy.effectiveDate}>
                  {formatDate(policy.effectiveDate, locale, { dateStyle: 'long' })}
                </time>
              ) : (
                'Not stated'
              )}
            </dd>
          </div>
          <div>
            <dt className="text-body-xs uppercase tracking-widest text-ink-faint">Owned by</dt>
            <dd className="mt-1 text-body-md text-ink">{policy.ownerLabel ?? 'Not stated'}</dd>
          </div>
        </dl>

        {documentHref ? (
          <p className="mt-6">
            <a href={documentHref} download className="text-body-sm uppercase tracking-widest text-ink no-underline hover:text-accent-ink">
              Download the signed document
            </a>
          </p>
        ) : null}
      </Section>

      {policy.body ? (
        <Section width="narrow" spacing="standard">
          <RichText html={policy.body} className="prose-editorial" />
        </Section>
      ) : null}

      {policy.versions.length > 0 ? (
        <Section tone="muted" width="narrow" spacing="compact">
          <SectionHeader eyebrow="History" heading="Previous versions" headingLevel={2} />
          <ul className="mt-6 divide-y divide-rule">
            {policy.versions.map((version) => (
              <li key={version.version} className="py-4">
                <p className="text-body-md text-ink">
                  Version {version.version}
                  {version.effectiveDate ? (
                    <>
                      {' · '}
                      <time dateTime={version.effectiveDate}>
                        {formatDate(version.effectiveDate, locale, { dateStyle: 'medium' })}
                      </time>
                    </>
                  ) : null}
                  {version.supersededAt ? (
                    <span className="text-ink-faint">
                      {' · superseded '}
                      <time dateTime={version.supersededAt}>
                        {formatDate(version.supersededAt, locale, { dateStyle: 'medium' })}
                      </time>
                    </span>
                  ) : null}
                </p>
                {version.summaryOfChanges ? (
                  <p className="mt-1 text-body-sm text-ink-muted">{version.summaryOfChanges}</p>
                ) : null}
              </li>
            ))}
          </ul>
        </Section>
      ) : null}
    </>
  );
}
