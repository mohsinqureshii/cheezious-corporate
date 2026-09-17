import Link from 'next/link';

import type { JobSummary } from '@/lib/content';

import { JobCard } from './collections';
import type { BlockContext } from './heroes';
import { PlaceholderBadge, Section, SectionHeader, type Tone } from './primitives';

/** Impact metrics and job search — the two blocks with the most data logic. */

type BlockData = Record<string, unknown>;

interface ImpactMetricValue {
  year: number;
  value: number;
  note: string | null;
  isDemoContent: boolean;
}

interface ImpactMetric {
  id: string;
  key: string;
  name: string;
  unit: string | null;
  prefix: string | null;
  suffix: string | null;
  description: string | null;
  methodology: string | null;
  targetValue: number | null;
  targetYear: number | null;
  values: ImpactMetricValue[];
}

interface ImpactPillar {
  id: string;
  key: string;
  name: string;
  slug: string;
  summary: string | null;
  description: string | null;
  icon: string | null;
  metrics: ImpactMetric[];
}

/** Format a metric value with its editor-supplied prefix and suffix. */
function formatMetric(metric: ImpactMetric, value: number, locale: string): string {
  const formatted = value.toLocaleString(locale === 'ur' ? 'ur-PK' : 'en-PK', {
    maximumFractionDigits: value < 10 ? 1 : 0,
  });
  return `${metric.prefix ?? ''}${formatted}${metric.suffix ?? ''}`;
}

export function ImpactPillars({
  data,
  context,
  pillars = [],
}: {
  data: BlockData;
  context: BlockContext;
  pillars?: ImpactPillar[];
}) {
  const tone = (data.tone as Tone) ?? 'light';
  if (pillars.length === 0) return null;

  const isDark = tone === 'dark';
  const showMetrics = data.showMetrics !== false;
  const isEditorial = data.layout === 'editorial';

  return (
    <Section tone={tone} spacing={(data.spacing as never) ?? 'standard'} width="standard">
      <SectionHeader
        eyebrow={data.eyebrow as string}
        heading={data.heading as string}
        intro={data.intro as string}
        tone={tone}
      />

      <div
        className={[
          isEditorial
            ? 'border-t border-ink-line'
            : 'grid gap-x-gutter gap-y-10 sm:grid-cols-2 lg:grid-cols-4',
        ].join(' ')}
      >
        {pillars.map((pillar) => {
          // Only metrics that carry an approved value are shown at all.
          const withValues = pillar.metrics.filter((metric) => metric.values.length > 0);

          if (isEditorial) {
            return (
              <div
                key={pillar.id}
                className="grid gap-x-gutter gap-y-4 border-b border-ink-line py-8 lg:grid-cols-12"
              >
                <div className="lg:col-span-4">
                  <h3 className={['text-heading-lg', isDark ? 'text-paper' : 'text-ink'].join(' ')}>
                    <Link
                      href={`/${context.locale}/company/impact/${pillar.slug}`}
                      className="no-underline transition-colors duration-quick hover:text-brand-deep"
                    >
                      {pillar.name}
                    </Link>
                  </h3>
                  {pillar.summary ? (
                    <p
                      className={[
                        'mt-2 text-body-sm',
                        isDark ? 'text-paper/65' : 'text-ink-muted',
                      ].join(' ')}
                    >
                      {pillar.summary}
                    </p>
                  ) : null}
                </div>

                <div className="lg:col-span-8">
                  {showMetrics && withValues.length > 0 ? (
                    <dl className="grid gap-x-gutter gap-y-6 sm:grid-cols-3">
                      {withValues.slice(0, 3).map((metric) => {
                        const latest = metric.values[0];
                        if (!latest) return null;
                        return (
                          <div key={metric.id}>
                            <dd
                              className={[
                                'text-stat-lg tabular-nums',
                                isDark ? 'text-paper' : 'text-ink',
                              ].join(' ')}
                            >
                              {formatMetric(metric, latest.value, context.locale)}
                            </dd>
                            <dt
                              className={[
                                'mt-2 text-body-sm',
                                isDark ? 'text-paper/65' : 'text-ink-muted',
                              ].join(' ')}
                            >
                              {metric.name}
                              {latest.isDemoContent ? <PlaceholderBadge tone={tone} /> : null}
                            </dt>
                          </div>
                        );
                      })}
                    </dl>
                  ) : (
                    /*
                      Stated plainly rather than papered over with an invented
                      figure. A pillar with no approved data is a fact about the
                      reporting, and the site says so.
                    */
                    <p
                      className={['text-body-sm', isDark ? 'text-paper/50' : 'text-ink-faint'].join(
                        ' ',
                      )}
                    >
                      Measures for this pillar have not yet been published.
                    </p>
                  )}
                </div>
              </div>
            );
          }

          return (
            <div key={pillar.id} className="border-t-2 border-brand pt-5">
              <h3 className={['text-heading-md', isDark ? 'text-paper' : 'text-ink'].join(' ')}>
                <Link
                  href={`/${context.locale}/company/impact/${pillar.slug}`}
                  className="no-underline transition-colors duration-quick hover:text-brand-deep"
                >
                  {pillar.name}
                </Link>
              </h3>
              {pillar.summary ? (
                <p
                  className={['mt-3 text-body-sm', isDark ? 'text-paper/70' : 'text-ink-soft'].join(
                    ' ',
                  )}
                >
                  {pillar.summary}
                </p>
              ) : null}

              {showMetrics && withValues.length > 0 ? (
                <dl className="mt-5 space-y-3">
                  {withValues.slice(0, 2).map((metric) => {
                    const latest = metric.values[0];
                    if (!latest) return null;
                    return (
                      <div key={metric.id} className="flex items-baseline justify-between gap-3">
                        <dt
                          className={[
                            'text-body-sm',
                            isDark ? 'text-paper/65' : 'text-ink-muted',
                          ].join(' ')}
                        >
                          {metric.name}
                        </dt>
                        <dd
                          className={[
                            'text-body-md font-semibold tabular-nums',
                            isDark ? 'text-paper' : 'text-ink',
                          ].join(' ')}
                        >
                          {formatMetric(metric, latest.value, context.locale)}
                        </dd>
                      </div>
                    );
                  })}
                </dl>
              ) : null}
            </div>
          );
        })}
      </div>
    </Section>
  );
}

/**
 * Impact metrics with progress against target.
 *
 * Progress is only drawn where both an approved current value and an approved
 * target exist. A half-known metric shows its value without a bar rather than
 * implying a trajectory that has not been set.
 */
export function ImpactMetrics({
  data,
  context,
  pillars = [],
}: {
  data: BlockData;
  context: BlockContext;
  pillars?: ImpactPillar[];
}) {
  const tone = (data.tone as Tone) ?? 'light';
  const metrics = pillars.flatMap((pillar) =>
    pillar.metrics
      .filter((metric) => metric.values.length > 0)
      .map((metric) => ({ ...metric, pillarName: pillar.name })),
  );

  if (metrics.length === 0) {
    return (
      <Section tone={tone} spacing="compact" width="standard">
        <SectionHeader heading={data.heading as string} tone={tone} />
        <p className="max-w-prose text-body-md text-ink-muted">
          Impact measures appear here once figures have been approved and published. Nothing is
          shown until then.
        </p>
      </Section>
    );
  }

  const isDark = tone === 'dark';
  const columns = (data.columns as string) ?? '3';
  const showTargets = data.showTargets !== false;

  return (
    <Section tone={tone} spacing={(data.spacing as never) ?? 'standard'} width="standard">
      <SectionHeader
        eyebrow={data.eyebrow as string}
        heading={data.heading as string}
        intro={data.intro as string}
        tone={tone}
      />

      <dl
        className={[
          'grid gap-x-gutter gap-y-12',
          columns === '2'
            ? 'sm:grid-cols-2'
            : columns === '4'
              ? 'sm:grid-cols-2 lg:grid-cols-4'
              : 'sm:grid-cols-2 lg:grid-cols-3',
        ].join(' ')}
      >
        {metrics.map((metric) => {
          const latest = metric.values[0];
          if (!latest) return null;

          const hasTarget = showTargets && metric.targetValue !== null && metric.targetValue > 0;
          const progress = hasTarget
            ? Math.min(100, (latest.value / metric.targetValue!) * 100)
            : null;

          return (
            <div key={metric.id}>
              <dd
                className={['text-stat-lg tabular-nums', isDark ? 'text-paper' : 'text-ink'].join(
                  ' ',
                )}
              >
                {formatMetric(metric, latest.value, context.locale)}
              </dd>
              <dt
                className={[
                  'mt-2 text-body-sm font-medium',
                  isDark ? 'text-paper/70' : 'text-ink-muted',
                ].join(' ')}
              >
                {metric.name}
                {latest.isDemoContent ? <PlaceholderBadge tone={tone} /> : null}
              </dt>

              <p
                className={['mt-1 text-body-xs', isDark ? 'text-paper/45' : 'text-ink-faint'].join(
                  ' ',
                )}
              >
                {latest.year} · {metric.pillarName}
              </p>

              {progress !== null ? (
                <div className="mt-4">
                  <div
                    className={[
                      'h-1 w-full overflow-hidden',
                      isDark ? 'bg-paper/15' : 'bg-ink/8',
                    ].join(' ')}
                    role="progressbar"
                    aria-valuenow={Math.round(progress)}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-label={`${metric.name}: ${Math.round(progress)}% of target`}
                  >
                    <div className="h-full bg-brand" style={{ width: `${progress}%` }} />
                  </div>
                  <p
                    className={[
                      'mt-2 text-body-xs',
                      isDark ? 'text-paper/50' : 'text-ink-faint',
                    ].join(' ')}
                  >
                    {Math.round(progress)}% of{' '}
                    {formatMetric(metric, metric.targetValue!, context.locale)} target
                    {metric.targetYear ? ` by ${metric.targetYear}` : ''}
                  </p>
                </div>
              ) : null}

              {/* Methodology is surfaced, not buried: a figure without one is
                  not a measure, it is a claim. */}
              {metric.methodology && data.showMethodology !== false ? (
                <details className="mt-3">
                  <summary
                    className={[
                      'cursor-pointer text-body-xs underline underline-offset-2',
                      isDark ? 'text-paper/50' : 'text-ink-faint',
                    ].join(' ')}
                  >
                    How this is measured
                  </summary>
                  <p
                    className={[
                      'mt-2 text-body-xs',
                      isDark ? 'text-paper/60' : 'text-ink-muted',
                    ].join(' ')}
                  >
                    {metric.methodology}
                  </p>
                </details>
              ) : null}
            </div>
          );
        })}
      </dl>
    </Section>
  );
}

/**
 * Job search block.
 *
 * Server-rendered so roles are indexable and load without JavaScript; filtering
 * is a progressive enhancement layered on top via the careers page.
 */
export function JobSearchBlock({
  data,
  context,
  jobs = [],
  total = 0,
}: {
  data: BlockData;
  context: BlockContext;
  jobs?: JobSummary[];
  total?: number;
}) {
  const tone = (data.tone as Tone) ?? 'light';

  if (jobs.length === 0) {
    return (
      <Section tone={tone} spacing="compact" width="standard">
        <SectionHeader heading={(data.heading as string) ?? 'Open roles'} tone={tone} />
        <div className="border-t border-ink-line pt-8">
          <p className="text-body-lg text-ink">
            There are no open roles matching this area right now.
          </p>
          <p className="mt-2 max-w-prose text-body-sm text-ink-muted">
            New roles are posted here as they open. In the meantime you can browse every open role
            across the business.
          </p>
          <Link
            href={`/${context.locale}/careers/jobs`}
            className="mt-6 inline-flex items-center gap-2 rounded bg-ink px-6 py-3.5 text-body-sm font-semibold
                       text-paper no-underline transition-colors duration-quick hover:bg-ink-soft"
          >
            See all open roles
            <svg
              width="13"
              height="10"
              viewBox="0 0 14 10"
              fill="none"
              aria-hidden="true"
              className="rtl:rotate-180"
            >
              <path
                d="M9 1l4 4-4 4M13 5H1"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </Link>
        </div>
      </Section>
    );
  }

  return (
    <Section tone={tone} spacing={(data.spacing as never) ?? 'standard'} width="standard">
      <SectionHeader
        eyebrow={data.eyebrow as string}
        heading={(data.heading as string) ?? 'Open roles'}
        intro={data.intro as string}
        tone={tone}
        action={
          <p className="text-body-sm text-ink-muted">
            {total} open {total === 1 ? 'role' : 'roles'}
          </p>
        }
      />

      <div className="border-t border-ink-line">
        {jobs.map((job) => (
          <JobCard key={job.id} job={job} locale={context.locale} />
        ))}
      </div>

      {total > jobs.length ? (
        <div className="mt-10">
          <Link
            href={`/${context.locale}/careers/jobs`}
            className="inline-flex items-center gap-2 text-body-sm font-semibold text-ink no-underline
                       transition-colors duration-quick hover:text-brand-deep"
          >
            See all {total} open roles
            <svg
              width="13"
              height="10"
              viewBox="0 0 14 10"
              fill="none"
              aria-hidden="true"
              className="rtl:rotate-180"
            >
              <path
                d="M9 1l4 4-4 4M13 5H1"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </Link>
        </div>
      ) : null}
    </Section>
  );
}
