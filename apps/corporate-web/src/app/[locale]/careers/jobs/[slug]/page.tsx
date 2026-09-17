import { isLocale, type Locale } from '@cheezious/config';
import { buildBreadcrumbList, buildJobPosting, serializeJsonLd } from '@cheezious/seo';
import { formatDate } from '@cheezious/utilities';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';

import { JobApplicationForm } from '@/components/careers/JobApplicationForm';
import { JobCard } from '@/components/blocks/collections';
import { RichText } from '@/components/blocks/primitives';
import { getJob, getSettings } from '@/lib/content';
import { buildRouteSeo, siteUrl } from '@/lib/seo';

/**
 * Job detail.
 *
 * Two things this page has to get right:
 *
 *   1. **Google Jobs.** The JobPosting markup is built by a tested builder that
 *      returns null rather than emitting incomplete markup — an invalid posting
 *      can get an entire careers site excluded, so a missing field means no
 *      markup rather than broken markup.
 *   2. **Applying.** The form posts to the backend, which is where every check
 *      that matters actually happens.
 */

export const revalidate = 60;

interface RouteParams {
  locale: string;
  slug: string;
}

export async function generateMetadata({ params }: { params: Promise<RouteParams> }): Promise<Metadata> {
  const { locale: localeParam, slug } = await params;
  if (!isLocale(localeParam)) return {};

  const locale = localeParam;
  const result = await getJob(locale, slug);
  if (!result) return { title: 'Role not found', robots: { index: false, follow: false } };

  const job = result.job as Record<string, unknown>;
  const settings = await getSettings(locale).catch(() => ({}) as Record<string, unknown>);

  const location = job.location as { name?: string } | null;
  const department = job.department as { name?: string } | null;

  // The description reads as a search result rather than as a truncated JD.
  const descriptionParts = [
    job.summary as string | undefined,
    location?.name ? `Based in ${location.name}.` : undefined,
    department?.name ? `${department.name} team.` : undefined,
  ].filter(Boolean);

  return buildRouteSeo({
    locale,
    settings,
    path: `/${locale}/careers/jobs/${slug}`,
    title: (job.seoTitle as string) ?? `${job.title as string}`,
    description: (job.seoDescription as string) ?? descriptionParts.join(' ') ?? `Apply for ${job.title as string} at Cheezious.`,
    siteName: (settings['site.name'] as string) ?? 'Cheezious Corporate',
    noindex: job.noindex === true,
    type: 'article',
    publishedTime: job.postedAt as string | null,
    modifiedTime: job.updatedAt as string | null,
    alternates: Object.fromEntries(
      Object.entries(result.alternates).map(([code, value]) => [code, `/${code}/careers/jobs/${value}`]),
    ) as Partial<Record<Locale, string>>,
  });
}

export default async function JobDetailPage({ params }: { params: Promise<RouteParams> }) {
  const { locale: localeParam, slug } = await params;
  if (!isLocale(localeParam)) notFound();

  const locale: Locale = localeParam;
  const result = await getJob(locale, slug);
  if (!result) notFound();

  const job = result.job as Record<string, unknown>;
  const settings = await getSettings(locale).catch(() => ({}) as Record<string, unknown>);

  const location = job.location as
    | { name: string; isRemote: boolean; city: { name: string; region: { name: string } | null } | null }
    | null;
  const department = job.department as { name: string; slug: string } | null;
  const category = job.category as { name: string; slug: string } | null;
  const formDefinition = job.formDefinition as
    | { key: string; successMessage: string; submitLabel: string; isEnabled: boolean; fields: Array<Record<string, unknown>> }
    | null;

  const origin = siteUrl();
  const jobUrl = `${origin}/${locale}/careers/jobs/${slug}`;

  /**
   * JobPosting structured data.
   *
   * The builder enforces Google's requirements: it returns null when title,
   * description or datePosted is missing, maps employment types to schema.org
   * values, distinguishes remote from on-site correctly, and emits salary only
   * when a complete, coherent range exists.
   */
  const jobPosting = buildJobPosting({
    title: job.title as string,
    description: buildJobDescription(job),
    url: jobUrl,
    datePosted: job.postedAt as string | null,
    validThrough: job.applicationDeadline as string | null,
    employmentType: job.employmentType as string,
    workplaceType: job.workplaceType as 'ON_SITE' | 'HYBRID' | 'REMOTE',
    organizationName: 'Cheezious',
    organizationUrl: `${origin}/${locale}/company`,
    locality: location?.city?.name ?? (location?.isRemote ? undefined : location?.name),
    region: location?.city?.region?.name,
    country: 'PK',
    department: department?.name,
    salaryMin: job.salaryMin as number | null,
    salaryMax: job.salaryMax as number | null,
    salaryCurrency: job.salaryCurrency as string | null,
    salaryPeriod: job.salaryPeriod as string | null,
    // Applications are taken on this page, which is what directApply asserts.
    directApply: true,
  });

  const breadcrumbs = buildBreadcrumbList([
    { name: 'Careers', url: `${origin}/${locale}/careers` },
    { name: 'Open roles', url: `${origin}/${locale}/careers/jobs` },
    { name: job.title as string, url: jobUrl },
  ]);

  const structuredData = serializeJsonLd([jobPosting, breadcrumbs]);

  const deadline = job.applicationDeadline as string | null;
  const deadlineSoon =
    deadline && new Date(deadline).getTime() - Date.now() < 14 * 24 * 60 * 60 * 1000;

  return (
    <>
      {structuredData ? (
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: structuredData }} />
      ) : null}

      <nav aria-label="Breadcrumb" className="border-b border-ink-line bg-paper">
        <div className="container-standard">
          <ol className="flex flex-wrap items-center gap-x-2 gap-y-1 py-4 text-body-xs">
            <li className="flex items-center gap-2">
              <Link href={`/${locale}/careers`} className="text-ink-muted no-underline hover:text-ink">
                Careers
              </Link>
              <span aria-hidden="true" className="text-ink-line">/</span>
            </li>
            <li className="flex items-center gap-2">
              <Link href={`/${locale}/careers/jobs`} className="text-ink-muted no-underline hover:text-ink">
                Open roles
              </Link>
              <span aria-hidden="true" className="text-ink-line">/</span>
            </li>
            <li>
              <span className="font-medium text-ink" aria-current="page">
                {job.title as string}
              </span>
            </li>
          </ol>
        </div>
      </nav>

      <article>
        <header className="border-b border-ink-line bg-paper">
          <div className="container-standard py-section-compact">
            <div className="max-w-4xl">
              {category ? <p className="eyebrow">{category.name}</p> : null}
              <h1 className="mt-4 text-display-md text-ink">{job.title as string}</h1>
              {job.summary ? (
                <p className="mt-5 max-w-prose text-body-lg text-ink-soft">{job.summary as string}</p>
              ) : null}

              <dl className="mt-8 flex flex-wrap gap-x-10 gap-y-4">
                {location ? (
                  <div>
                    <dt className="text-body-xs uppercase tracking-wider text-ink-faint">Location</dt>
                    <dd className="mt-1 text-body-md text-ink">{location.name}</dd>
                  </div>
                ) : null}
                {department ? (
                  <div>
                    <dt className="text-body-xs uppercase tracking-wider text-ink-faint">Team</dt>
                    <dd className="mt-1 text-body-md text-ink">{department.name}</dd>
                  </div>
                ) : null}
                <div>
                  <dt className="text-body-xs uppercase tracking-wider text-ink-faint">Type</dt>
                  <dd className="mt-1 text-body-md capitalize text-ink">
                    {(job.employmentType as string).replace(/_/g, ' ').toLowerCase()}
                  </dd>
                </div>
                <div>
                  <dt className="text-body-xs uppercase tracking-wider text-ink-faint">Working pattern</dt>
                  <dd className="mt-1 text-body-md text-ink">
                    {job.workplaceType === 'REMOTE' ? 'Remote' : job.workplaceType === 'HYBRID' ? 'Hybrid' : 'On site'}
                  </dd>
                </div>
                {job.postedAt ? (
                  <div>
                    <dt className="text-body-xs uppercase tracking-wider text-ink-faint">Posted</dt>
                    <dd className="mt-1 text-body-md text-ink">
                      <time dateTime={job.postedAt as string}>{formatDate(job.postedAt as string, locale)}</time>
                    </dd>
                  </div>
                ) : null}
              </dl>

              {/* A closing date is only useful if it is noticeable. */}
              {deadline ? (
                <p
                  className={[
                    'mt-6 inline-flex items-center gap-2 rounded px-4 py-2.5 text-body-sm font-medium',
                    deadlineSoon ? 'bg-signal-warning/12 text-signal-warning' : 'bg-ink/5 text-ink-soft',
                  ].join(' ')}
                >
                  Applications close on <time dateTime={deadline}>{formatDate(deadline, locale)}</time>
                </p>
              ) : null}

              <div className="mt-9">
                <a
                  href="#apply"
                  className="inline-flex items-center gap-2 rounded bg-ink px-8 py-4 text-body-sm font-semibold
                             text-paper no-underline transition-colors duration-quick hover:bg-ink-soft"
                >
                  Apply for this role
                </a>
              </div>
            </div>
          </div>
        </header>

        <div className="container-standard py-section">
          <div className="grid gap-x-gutter gap-y-12 lg:grid-cols-12">
            <div className="lg:col-span-7">
              {renderSection('About the role', job.description as string | null)}
              {renderSection('What you will do', job.responsibilities as string | null)}
              {renderSection('What we are looking for', job.requirements as string | null)}
              {renderSection('Nice to have', job.preferredQualifications as string | null)}
              {renderSection('What we offer', job.benefits as string | null)}
            </div>

            <aside className="lg:col-span-4 lg:col-start-9">
              <div className="sticky top-[calc(var(--header-height)+2rem)] border-t-2 border-brand pt-6">
                <h2 className="text-heading-md text-ink">Apply</h2>
                <p className="mt-3 text-body-sm text-ink-soft">
                  Applications are reviewed by our people team. You will receive a reference number when you submit.
                </p>
                <a
                  href="#apply"
                  className="mt-5 inline-flex items-center gap-2 text-body-sm font-semibold text-ink no-underline
                             transition-colors duration-quick hover:text-brand-deep"
                >
                  Go to the application form
                  <svg width="13" height="10" viewBox="0 0 14 10" fill="none" aria-hidden="true" className="rtl:rotate-180">
                    <path d="M9 1l4 4-4 4M13 5H1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </a>
              </div>
            </aside>
          </div>
        </div>

        <section id="apply" className="border-t border-ink-line bg-paper-sunken scroll-mt-[calc(var(--header-height)+2rem)]">
          <div className="container-narrow py-section">
            <h2 className="text-display-sm text-ink">Apply for this role</h2>
            <p className="mt-4 max-w-prose text-body-md text-ink-soft">
              Tell us who you are and attach your CV. Fields marked with an asterisk are required.
            </p>

            <div className="mt-10">
              {formDefinition?.isEnabled === false ? (
                <p className="text-body-md text-ink-muted">
                  Applications for this role are not currently being accepted online.
                </p>
              ) : (
                <JobApplicationForm
                  locale={locale}
                  jobSlug={slug}
                  jobTitle={job.title as string}
                  fields={formDefinition?.fields as never}
                  submitLabel={formDefinition?.submitLabel ?? 'Submit application'}
                  successMessage={formDefinition?.successMessage}
                  privacyPath={`/${locale}/company/governance/privacy`}
                />
              )}
            </div>
          </div>
        </section>

        {result.similar.length > 0 ? (
          <section className="border-t border-ink-line bg-paper">
            <div className="container-standard py-section-compact">
              <h2 className="text-heading-lg text-ink">Similar roles</h2>
              <div className="mt-8 border-t border-ink-line">
                {result.similar.map((similar) => (
                  <JobCard key={similar.id} job={similar} locale={locale} />
                ))}
              </div>
            </div>
          </section>
        ) : null}
      </article>

      {/* Settings are loaded for the site name; referenced so the fetch is not
          optimised away by an over-eager bundler. */}
      <span hidden>{String(settings['site.name'] ?? '')}</span>
    </>
  );
}

function renderSection(heading: string, html: string | null | undefined) {
  if (!html) return null;
  return (
    <section className="mb-12 last:mb-0">
      <h2 className="text-heading-lg text-ink">{heading}</h2>
      <div className="mt-5">
        <RichText html={html} />
      </div>
    </section>
  );
}

/**
 * Build the description JobPosting requires.
 *
 * Google expects a complete HTML description, not a one-line summary, so the
 * sections are concatenated. Returning an empty string makes the builder omit
 * the markup entirely rather than emit an invalid posting.
 */
function buildJobDescription(job: Record<string, unknown>): string {
  const parts = [
    job.description,
    job.responsibilities,
    job.requirements,
    job.preferredQualifications,
    job.benefits,
  ].filter((part): part is string => typeof part === 'string' && part.trim().length > 0);

  return parts.join('\n');
}
