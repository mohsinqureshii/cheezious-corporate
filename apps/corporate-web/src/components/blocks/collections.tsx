import { formatDate } from '@cheezious/utilities';
import Link from 'next/link';

import type { JobSummary, MediaImage, PersonSummary, StorySummary } from '@/lib/content';

import type { BlockContext } from './heroes';
import {
  ActionLink,
  BlockImage,
  PlaceholderBadge,
  resolveLink,
  Section,
  SectionHeader,
  type Tone,
} from './primitives';

/**
 * Collection blocks.
 *
 * These render live content pulled from the structured modules. They never hold
 * a copy of a headline or an image — an editor curates *which* records appear,
 * and the record supplies everything else, so correcting a story title updates
 * it everywhere it is featured.
 *
 * Every collection handles the empty case explicitly. A newsroom grid with
 * nothing published renders nothing at all rather than a heading followed by a
 * void, because an empty section on a corporate homepage reads as broken.
 */

type BlockData = Record<string, unknown>;

/** Story card. The unit the newsroom is built from. */
export function StoryCard({
  story,
  locale,
  showExcerpt = true,
  priority = false,
}: {
  story: StorySummary;
  locale: string;
  showExcerpt?: boolean;
  priority?: boolean;
}) {
  const href = `/${locale}/company/newsroom/stories/${story.slug}`;
  const image = story.thumbnail ?? story.heroImage;

  return (
    <article className="group">
      <Link href={href} className="block no-underline">
        <div className="overflow-hidden">
          <BlockImage
            image={image}
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
            aspectRatio="3:2"
            priority={priority}
            reveal={false}
            className="transition-transform duration-slow ease-editorial group-hover:scale-[1.03]"
          />
        </div>

        <div className="mt-5">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            {story.category ? <span className="eyebrow">{story.category.name}</span> : null}
            {story.publishedAt ? (
              <time dateTime={story.publishedAt} className="text-body-xs text-ink-faint">
                {formatDate(story.publishedAt, locale)}
              </time>
            ) : null}
          </div>

          <h3 className="mt-2.5 text-heading-md text-ink transition-colors duration-quick group-hover:text-brand-deep">
            {story.title}
          </h3>

          {showExcerpt && story.excerpt ? (
            <p className="mt-2.5 line-clamp-3 text-body-sm text-ink-soft">{story.excerpt}</p>
          ) : null}
        </div>
      </Link>
    </article>
  );
}

export function StoryGrid({
  data,
  context,
  stories = [],
}: {
  data: BlockData;
  context: BlockContext;
  stories?: StorySummary[];
}) {
  const tone = (data.tone as Tone) ?? 'light';
  if (stories.length === 0) return null;

  const columns = (data.columns as string) ?? '3';
  const viewAll = resolveLink(data.viewAllLink as never, context.locale, context.pathById);

  return (
    <Section tone={tone} spacing={(data.spacing as never) ?? 'standard'} width="standard">
      <SectionHeader
        eyebrow={data.eyebrow as string}
        heading={data.heading as string}
        intro={data.intro as string}
        tone={tone}
        action={viewAll ? <ActionLink link={viewAll} variant="ghost" tone={tone} /> : undefined}
      />
      <div
        className={[
          'grid gap-x-gutter gap-y-12',
          columns === '2' ? 'sm:grid-cols-2' : columns === '4' ? 'sm:grid-cols-2 lg:grid-cols-4' : 'sm:grid-cols-2 lg:grid-cols-3',
        ].join(' ')}
      >
        {stories.map((story) => (
          <StoryCard key={story.id} story={story} locale={context.locale} showExcerpt={data.showExcerpt !== false} />
        ))}
      </div>
    </Section>
  );
}

/** A single story at full editorial scale. */
export function StoryFeature({
  data,
  context,
  story,
}: {
  data: BlockData;
  context: BlockContext;
  story?: StorySummary | null;
}) {
  const tone = (data.tone as Tone) ?? 'light';
  if (!story) return null;

  const href = `/${context.locale}/company/newsroom/stories/${story.slug}`;
  const isOverlay = data.layout === 'overlay';

  if (isOverlay && story.heroImage) {
    return (
      <section className="relative isolate bg-ink">
        <BlockImage image={story.heroImage} sizes="100vw" aspectRatio="21:9" />
        <div className="absolute inset-0 flex items-end bg-gradient-to-t from-ink/85 via-ink/40 to-transparent">
          <div className="container-wide pb-12 lg:pb-20">
            <div className="max-w-3xl">
              {story.category ? <p className="eyebrow text-paper/70">{story.category.name}</p> : null}
              <h2 className="mt-4 text-display-md text-paper">
                <Link href={href} className="text-paper no-underline">
                  {story.title}
                </Link>
              </h2>
              {story.excerpt ? <p className="mt-4 max-w-prose text-body-lg text-paper/80">{story.excerpt}</p> : null}
            </div>
          </div>
        </div>
      </section>
    );
  }

  return (
    <Section tone={tone} spacing={(data.spacing as never) ?? 'standard'} width="standard">
      <SectionHeader eyebrow={data.eyebrow as string} heading={data.heading as string} tone={tone} />
      <article className="group grid items-center gap-x-gutter gap-y-8 lg:grid-cols-12">
        <div className="lg:col-span-7">
          <Link href={href} className="block overflow-hidden no-underline">
            <BlockImage
              image={story.heroImage}
              sizes="(max-width: 1024px) 100vw, 58vw"
              aspectRatio="3:2"
              className="transition-transform duration-slow ease-editorial group-hover:scale-[1.02]"
            />
          </Link>
        </div>
        <div className="lg:col-span-5">
          <div className="flex flex-wrap items-center gap-x-3">
            {story.category ? <span className="eyebrow">{story.category.name}</span> : null}
            {story.publishedAt ? (
              <time dateTime={story.publishedAt} className="text-body-xs text-ink-faint">
                {formatDate(story.publishedAt, context.locale)}
              </time>
            ) : null}
          </div>
          <h3 className="mt-3 text-display-sm text-ink">
            <Link href={href} className="text-ink no-underline transition-colors duration-quick group-hover:text-brand-deep">
              {story.title}
            </Link>
          </h3>
          {story.excerpt ? <p className="mt-5 text-body-lg text-ink-soft">{story.excerpt}</p> : null}
          {story.readingMinutes ? (
            <p className="mt-4 text-body-xs text-ink-faint">{story.readingMinutes} min read</p>
          ) : null}
        </div>
      </article>
    </Section>
  );
}

/** Press releases, listed as rows rather than cards — they are documents. */
export function PressReleaseList({
  data,
  context,
  releases = [],
}: {
  data: BlockData;
  context: BlockContext;
  releases?: Array<{ id: string; headline: string; slug: string; summary: string | null; publishedAt: string | null; dateline: string | null }>;
}) {
  const tone = (data.tone as Tone) ?? 'light';
  if (releases.length === 0) return null;

  const viewAll = resolveLink(data.viewAllLink as never, context.locale, context.pathById);

  return (
    <Section tone={tone} spacing={(data.spacing as never) ?? 'standard'} width="standard">
      <SectionHeader
        eyebrow={data.eyebrow as string}
        heading={data.heading as string}
        intro={data.intro as string}
        tone={tone}
        action={viewAll ? <ActionLink link={viewAll} variant="ghost" tone={tone} /> : undefined}
      />
      <ul className="border-t border-ink-line">
        {releases.map((release) => (
          <li key={release.id} className="border-b border-ink-line">
            <Link
              href={`/${context.locale}/company/newsroom/press-releases/${release.slug}`}
              className="group grid gap-x-gutter gap-y-2 py-6 no-underline lg:grid-cols-12 lg:items-baseline"
            >
              {release.publishedAt ? (
                <time dateTime={release.publishedAt} className="text-body-sm tabular-nums text-ink-faint lg:col-span-2">
                  {formatDate(release.publishedAt, context.locale, { year: 'numeric', month: 'short', day: 'numeric' })}
                </time>
              ) : (
                <span className="lg:col-span-2" />
              )}
              <h3 className="text-heading-sm text-ink transition-colors duration-quick group-hover:text-brand-deep lg:col-span-7">
                {release.headline}
              </h3>
              {release.summary ? (
                <p className="line-clamp-2 text-body-sm text-ink-muted lg:col-span-3">{release.summary}</p>
              ) : null}
            </Link>
          </li>
        ))}
      </ul>
    </Section>
  );
}

/**
 * Leadership grid.
 *
 * Portraits at 4:5, which is how people are actually photographed, with the
 * focal point honoured so faces stay in frame.
 */
export function LeadershipGrid({
  data,
  context,
  groups = [],
}: {
  data: BlockData;
  context: BlockContext;
  groups?: Array<{ id: string; name: string; slug: string; summary: string | null; people: PersonSummary[] }>;
}) {
  const tone = (data.tone as Tone) ?? 'light';
  const withPeople = groups.filter((group) => group.people.length > 0);
  if (withPeople.length === 0) return null;

  const columns = (data.columns as string) ?? '3';
  const columnClass =
    columns === '2' ? 'sm:grid-cols-2' : columns === '4' ? 'grid-cols-2 lg:grid-cols-4' : 'sm:grid-cols-2 lg:grid-cols-3';

  return (
    <Section tone={tone} spacing={(data.spacing as never) ?? 'standard'} width="standard">
      <SectionHeader eyebrow={data.eyebrow as string} heading={data.heading as string} intro={data.intro as string} tone={tone} />

      <div className="space-y-16">
        {withPeople.map((group) => (
          <div key={group.id}>
            {withPeople.length > 1 ? (
              <div className="mb-8 border-b border-ink-line pb-4">
                <h3 className={['text-heading-lg', tone === 'dark' ? 'text-paper' : 'text-ink'].join(' ')}>
                  {group.name}
                </h3>
                {group.summary ? <p className="mt-2 max-w-prose text-body-sm text-ink-muted">{group.summary}</p> : null}
              </div>
            ) : null}

            <ul className={['grid gap-x-gutter gap-y-10', columnClass].join(' ')}>
              {group.people.map((person) => {
                const href = `/${context.locale}/company/leadership/${person.slug}`;
                const isPlaceholder = person.name.startsWith('[Placeholder]');

                return (
                  <li key={person.id} className="group">
                    {data.linkToProfiles !== false ? (
                      <Link href={href} className="block no-underline">
                        <PersonCardBody person={person} tone={tone} isPlaceholder={isPlaceholder} showRole={data.showRole !== false} />
                      </Link>
                    ) : (
                      <PersonCardBody person={person} tone={tone} isPlaceholder={isPlaceholder} showRole={data.showRole !== false} />
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </div>
    </Section>
  );
}

function PersonCardBody({
  person,
  tone,
  isPlaceholder,
  showRole,
}: {
  person: PersonSummary;
  tone: Tone;
  isPlaceholder: boolean;
  showRole: boolean;
}) {
  const isDark = tone === 'dark';

  return (
    <>
      <div className="overflow-hidden">
        <BlockImage
          image={person.portrait}
          sizes="(max-width: 640px) 50vw, 25vw"
          aspectRatio="4:5"
          reveal={false}
          className="transition-transform duration-slow ease-editorial group-hover:scale-[1.03]"
        />
      </div>
      <h4 className={['mt-5 text-heading-sm', isDark ? 'text-paper' : 'text-ink'].join(' ')}>
        {person.name.replace('[Placeholder] ', '')}
        {isPlaceholder ? <PlaceholderBadge tone={tone} /> : null}
      </h4>
      {showRole ? (
        <p className={['mt-1 text-body-sm', isDark ? 'text-paper/65' : 'text-ink-muted'].join(' ')}>{person.role}</p>
      ) : null}
    </>
  );
}

/** Job card. Everything a candidate needs to decide whether to click. */
export function JobCard({ job, locale }: { job: JobSummary; locale: string }) {
  const href = `/${locale}/careers/jobs/${job.slug}`;
  const workplaceLabel =
    job.workplaceType === 'REMOTE' ? 'Remote' : job.workplaceType === 'HYBRID' ? 'Hybrid' : 'On site';
  const employmentLabel = job.employmentType.replace(/_/g, ' ').toLowerCase();

  return (
    <article className="group border-b border-ink-line">
      <Link href={href} className="block py-6 no-underline">
        <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2">
          <h3 className="text-heading-md text-ink transition-colors duration-quick group-hover:text-brand-deep">
            {job.title}
          </h3>
          <span className="inline-flex items-center gap-1.5 text-body-sm font-medium text-ink-muted">
            View role
            <svg width="12" height="9" viewBox="0 0 12 9" fill="none" aria-hidden="true" className="rtl:rotate-180">
              <path d="M7.5 1L11 4.5 7.5 8M11 4.5H1" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </span>
        </div>

        {job.summary ? <p className="mt-2 max-w-prose text-body-sm text-ink-soft">{job.summary}</p> : null}

        <ul className="mt-4 flex flex-wrap gap-x-5 gap-y-1.5 text-body-xs text-ink-muted">
          {job.department ? <li>{job.department.name}</li> : null}
          {job.location ? <li>{job.location.name}</li> : null}
          <li className="capitalize">{employmentLabel}</li>
          <li>{workplaceLabel}</li>
          {job.openingsCount && job.openingsCount > 1 ? <li>{job.openingsCount} openings</li> : null}
        </ul>
      </Link>
    </article>
  );
}

export function JobCategories({
  data,
  context,
  categories = [],
}: {
  data: BlockData;
  context: BlockContext;
  categories?: Array<{ id: string; name: string; slug: string; summary: string | null; openRoles: number }>;
}) {
  const tone = (data.tone as Tone) ?? 'light';
  if (categories.length === 0) return null;

  const columns = (data.columns as string) ?? '3';

  return (
    <Section tone={tone} spacing={(data.spacing as never) ?? 'standard'} width="standard">
      <SectionHeader eyebrow={data.eyebrow as string} heading={data.heading as string} intro={data.intro as string} tone={tone} />
      <ul
        className={[
          'grid gap-x-gutter gap-y-8',
          columns === '2' ? 'sm:grid-cols-2' : columns === '4' ? 'sm:grid-cols-2 lg:grid-cols-4' : 'sm:grid-cols-2 lg:grid-cols-3',
        ].join(' ')}
      >
        {categories.map((category) => (
          <li key={category.id} className="border-t border-ink-line pt-5">
            <Link href={`/${context.locale}/careers/${category.slug}`} className="group block no-underline">
              <div className="flex items-baseline justify-between gap-4">
                <h3 className="text-heading-md text-ink transition-colors duration-quick group-hover:text-brand-deep">
                  {category.name}
                </h3>
                {data.showOpenCount !== false ? (
                  <span className="shrink-0 text-body-sm tabular-nums text-ink-muted">
                    {/* An honest zero is better than hiding the category. */}
                    {category.openRoles > 0 ? `${category.openRoles} open` : 'No open roles'}
                  </span>
                ) : null}
              </div>
              {category.summary ? <p className="mt-2 text-body-sm text-ink-soft">{category.summary}</p> : null}
            </Link>
          </li>
        ))}
      </ul>
    </Section>
  );
}

export function CareerPath({ data, context: _context }: { data: BlockData; context: BlockContext }) {
  const tone = (data.tone as Tone) ?? 'light';
  const steps = (data.steps as Array<{ title: string; description?: string; durationLabel?: string }>) ?? [];
  if (steps.length === 0) return null;

  return (
    <Section tone={tone} spacing={(data.spacing as never) ?? 'standard'} width="standard">
      <SectionHeader eyebrow={data.eyebrow as string} heading={data.heading as string} intro={data.intro as string} tone={tone} />
      <ol className="grid gap-x-gutter gap-y-8 sm:grid-cols-2 lg:grid-cols-4">
        {steps.map((step, index) => (
          <li key={index} className="border-t-2 border-brand pt-5">
            {step.durationLabel ? <p className="eyebrow">{step.durationLabel}</p> : null}
            <h3 className="mt-2 text-heading-md text-ink">{step.title}</h3>
            {step.description ? <p className="mt-2 text-body-sm text-ink-soft">{step.description}</p> : null}
          </li>
        ))}
      </ol>
    </Section>
  );
}

/** Reports and publications. Presented as a document centre, not a file listing. */
export function ReportGrid({
  data,
  context,
  reports = [],
}: {
  data: BlockData;
  context: BlockContext;
  reports?: Array<{
    id: string;
    title: string;
    slug: string;
    year: number;
    type: string;
    description: string | null;
    isDemoContent: boolean;
    cover: MediaImage | null;
    files: Array<{ label: string; asset: { storageKey: string; byteSize: number; mimeType: string } }>;
  }>;
}) {
  const tone = (data.tone as Tone) ?? 'light';
  if (reports.length === 0) return null;

  const columns = (data.columns as string) ?? '3';
  const viewAll = resolveLink(data.viewAllLink as never, context.locale, context.pathById);

  return (
    <Section tone={tone} spacing={(data.spacing as never) ?? 'standard'} width="standard">
      <SectionHeader
        eyebrow={data.eyebrow as string}
        heading={data.heading as string}
        intro={data.intro as string}
        tone={tone}
        action={viewAll ? <ActionLink link={viewAll} variant="ghost" tone={tone} /> : undefined}
      />
      <ul
        className={[
          'grid gap-x-gutter gap-y-10',
          columns === '2' ? 'sm:grid-cols-2' : columns === '4' ? 'grid-cols-2 lg:grid-cols-4' : 'sm:grid-cols-2 lg:grid-cols-3',
        ].join(' ')}
      >
        {reports.map((report) => (
          <li key={report.id} className="group">
            <Link href={`/${context.locale}/company/resources/publications`} className="block no-underline">
              {/* Document covers are portrait, matching the page they represent. */}
              <div className="overflow-hidden border border-ink-line bg-paper-raised">
                <BlockImage
                  image={report.cover}
                  sizes="(max-width: 640px) 50vw, 25vw"
                  aspectRatio="4:5"
                  reveal={false}
                  className="transition-transform duration-slow ease-editorial group-hover:scale-[1.02]"
                />
              </div>
              <p className="eyebrow mt-4">
                {report.year} · {report.type.replace(/_/g, ' ').toLowerCase()}
              </p>
              <h3 className="mt-2 text-heading-sm text-ink transition-colors duration-quick group-hover:text-brand-deep">
                {report.title.replace('[Placeholder] ', '')}
                {report.isDemoContent ? <PlaceholderBadge tone={tone} /> : null}
              </h3>
              {report.description ? (
                <p className="mt-2 line-clamp-2 text-body-sm text-ink-muted">{report.description}</p>
              ) : null}
            </Link>
          </li>
        ))}
      </ul>
    </Section>
  );
}

export function PolicyList({
  data,
  context,
  categories = [],
}: {
  data: BlockData;
  context: BlockContext;
  categories?: Array<{
    id: string;
    name: string;
    slug: string;
    summary: string | null;
    policies: Array<{ id: string; title: string; slug: string; summary: string | null; version: string; updatedAt: string; document: { storageKey: string } | null }>;
  }>;
}) {
  const tone = (data.tone as Tone) ?? 'light';
  const withPolicies = categories.filter((category) => category.policies.length > 0);

  // No published policies is the honest state of a new platform: say so rather
  // than rendering an empty list that looks like a loading failure.
  if (withPolicies.length === 0) {
    return (
      <Section tone={tone} spacing="compact" width="standard">
        <SectionHeader heading={data.heading as string} tone={tone} />
        <p className="max-w-prose text-body-md text-ink-muted">
          No policies have been published yet. Policies appear here once they have been approved and published
          through the CMS.
        </p>
      </Section>
    );
  }

  return (
    <Section tone={tone} spacing={(data.spacing as never) ?? 'standard'} width="standard">
      <SectionHeader eyebrow={data.eyebrow as string} heading={data.heading as string} intro={data.intro as string} tone={tone} />
      <div className="space-y-12">
        {withPolicies.map((category) => (
          <div key={category.id}>
            <h3 className="border-b border-ink-line pb-3 text-heading-md text-ink">{category.name}</h3>
            <ul>
              {category.policies.map((policy) => (
                <li key={policy.id} className="border-b border-ink-line">
                  <Link
                    href={`/${context.locale}/company/governance/policies/${policy.slug}`}
                    className="group grid gap-x-gutter gap-y-1 py-5 no-underline lg:grid-cols-12 lg:items-baseline"
                  >
                    <h4 className="text-heading-sm text-ink transition-colors duration-quick group-hover:text-brand-deep lg:col-span-6">
                      {policy.title}
                    </h4>
                    {policy.summary ? (
                      <p className="line-clamp-1 text-body-sm text-ink-muted lg:col-span-4">{policy.summary}</p>
                    ) : (
                      <span className="lg:col-span-4" />
                    )}
                    {data.showLastUpdated !== false ? (
                      <p className="text-body-xs text-ink-faint lg:col-span-2 lg:text-end">
                        v{policy.version} · {formatDate(policy.updatedAt, context.locale, { year: 'numeric', month: 'short' })}
                      </p>
                    ) : null}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </Section>
  );
}
