import type { MediaImage } from '@/lib/content';

import { CountUp } from './CountUp';
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
 * Data blocks: statistics, pillars, process flows, timeline and the corporate
 * footprint.
 *
 * The rule running through all of them: a figure with no approved value is not
 * rendered as a zero, a dash pretending to be data, or an invented number. It is
 * either omitted, or shown explicitly labelled as a placeholder. A corporate
 * site that quietly fabricates a restaurant count to fill a grid is worse than
 * one with an empty grid.
 */

type BlockData = Record<string, unknown>;

interface Statistic {
  value: string;
  prefix?: string;
  suffix?: string;
  label: string;
  description?: string;
  isPlaceholder?: boolean;
  animate?: boolean;
}

function image(context: BlockContext, ref: unknown): MediaImage | null {
  const assetId = (ref as { assetId?: string } | undefined)?.assetId;
  return assetId ? (context.images.get(assetId) ?? null) : null;
}

/** A single statistic. Count-up only runs for a genuine numeric value. */
function Stat({
  statistic,
  tone,
  size = 'lg',
}: {
  statistic: Statistic;
  tone: Tone;
  size?: 'lg' | 'xl';
}) {
  const isDark = tone === 'dark';
  const isAccent = tone === 'accent';
  const numeric = Number(statistic.value.replace(/[^0-9.]/g, ''));
  const canAnimate =
    statistic.animate !== false &&
    !statistic.isPlaceholder &&
    Number.isFinite(numeric) &&
    numeric > 0;

  return (
    <div>
      <p
        className={[
          size === 'xl' ? 'text-stat-xl' : 'text-stat-lg',
          'tabular-nums',
          isDark ? 'text-paper' : isAccent ? 'text-brand-ink' : 'text-ink',
          statistic.isPlaceholder ? 'opacity-50' : '',
        ].join(' ')}
      >
        {statistic.prefix ? (
          <span className="text-[0.55em] align-top">{statistic.prefix}</span>
        ) : null}
        {canAnimate ? <CountUp value={numeric} display={statistic.value} /> : statistic.value}
        {statistic.suffix ? (
          <span className="text-[0.55em] align-top">{statistic.suffix}</span>
        ) : null}
      </p>
      <p
        className={[
          'mt-3 text-body-sm font-medium',
          isDark ? 'text-paper/70' : isAccent ? 'text-brand-ink/70' : 'text-ink-muted',
        ].join(' ')}
      >
        {statistic.label}
        {statistic.isPlaceholder ? <PlaceholderBadge tone={tone} /> : null}
      </p>
      {statistic.description ? (
        <p className={['mt-2 text-body-xs', isDark ? 'text-paper/50' : 'text-ink-faint'].join(' ')}>
          {statistic.description}
        </p>
      ) : null}
    </div>
  );
}

export function KPIGrid({ data, context: _context }: { data: BlockData; context: BlockContext }) {
  const tone = (data.tone as Tone) ?? 'light';
  const statistics = (data.statistics as Statistic[]) ?? [];
  const columns = (data.columns as string) ?? '3';

  const columnClass =
    columns === '2'
      ? 'sm:grid-cols-2'
      : columns === '4'
        ? 'sm:grid-cols-2 lg:grid-cols-4'
        : 'sm:grid-cols-2 lg:grid-cols-3';

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
          'grid gap-x-gutter gap-y-12',
          columnClass,
          // Hairline dividers between columns rather than card borders: the
          // structure reads as a table of figures, not a row of tiles.
          data.showDividers !== false ? 'divide-ink-line sm:divide-x rtl:sm:divide-x-reverse' : '',
        ].join(' ')}
      >
        {statistics.map((statistic, index) => (
          <div key={index} className={data.showDividers !== false ? 'sm:ps-8 sm:first:ps-0' : ''}>
            <Stat statistic={statistic} tone={tone} />
          </div>
        ))}
      </div>
    </Section>
  );
}

export function KPIBand({ data, context: _context }: { data: BlockData; context: BlockContext }) {
  const tone = (data.tone as Tone) ?? 'dark';
  const statistics = (data.statistics as Statistic[]) ?? [];

  return (
    <Section tone={tone} spacing="compact" width="wide">
      <SectionHeader
        eyebrow={data.eyebrow as string}
        heading={data.heading as string}
        tone={tone}
      />
      <div className="grid gap-x-gutter gap-y-10 sm:grid-cols-2 lg:grid-cols-4">
        {statistics.map((statistic, index) => (
          <Stat key={index} statistic={statistic} tone={tone} size="xl" />
        ))}
      </div>
    </Section>
  );
}

export function KPIEditorial({ data, context }: { data: BlockData; context: BlockContext }) {
  const tone = (data.tone as Tone) ?? 'light';
  const statistic = data.statistic as Statistic | undefined;
  const link = resolveLink(data.link as never, context.locale, context.pathById);

  if (!statistic) return null;

  return (
    <Section tone={tone} spacing={(data.spacing as never) ?? 'standard'} width="standard">
      <div className="grid items-center gap-x-gutter gap-y-8 lg:grid-cols-12">
        <div className="lg:col-span-5">
          <Stat statistic={statistic} tone={tone} size="xl" />
        </div>
        <div className="lg:col-span-6 lg:col-start-7">
          {data.heading ? (
            <h2
              className={['text-display-sm', tone === 'dark' ? 'text-paper' : 'text-ink'].join(' ')}
            >
              {String(data.heading)}
            </h2>
          ) : null}
          {data.body ? (
            <p
              className={[
                'mt-5 text-body-lg',
                tone === 'dark' ? 'text-paper/75' : 'text-ink-soft',
              ].join(' ')}
            >
              {String(data.body)}
            </p>
          ) : null}
          {link ? (
            <div className="mt-7">{<ActionLink link={link} variant="ghost" tone={tone} />}</div>
          ) : null}
        </div>
      </div>
    </Section>
  );
}

interface Pillar {
  title: string;
  description?: string;
  icon?: string;
  image?: { assetId?: string };
  link?: Record<string, unknown>;
}

export function BusinessPillars({ data, context }: { data: BlockData; context: BlockContext }) {
  const tone = (data.tone as Tone) ?? 'light';
  const pillars = (data.pillars as Pillar[]) ?? [];
  const layout = (data.layout as string) ?? 'grid';

  if (layout === 'editorial') {
    return (
      <Section tone={tone} spacing={(data.spacing as never) ?? 'standard'} width="standard">
        <SectionHeader
          eyebrow={data.eyebrow as string}
          heading={data.heading as string}
          intro={data.intro as string}
          tone={tone}
        />
        <div className="border-t border-ink-line">
          {pillars.map((pillar, index) => {
            const link = resolveLink(pillar.link as never, context.locale, context.pathById);
            return (
              <div
                key={index}
                className="grid gap-x-gutter gap-y-3 border-b border-ink-line py-8 lg:grid-cols-12 lg:items-baseline"
              >
                <p className="text-body-xs tabular-nums text-ink-faint lg:col-span-1">
                  {String(index + 1).padStart(2, '0')}
                </p>
                <h3 className="text-heading-lg text-ink lg:col-span-4">{pillar.title}</h3>
                {pillar.description ? (
                  <p className="text-body-md text-ink-soft lg:col-span-5">{pillar.description}</p>
                ) : null}
                {link ? (
                  <div className="lg:col-span-2 lg:text-end">
                    <ActionLink link={link} variant="ghost" tone={tone} />
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      </Section>
    );
  }

  return (
    <Section tone={tone} spacing={(data.spacing as never) ?? 'standard'} width="standard">
      <SectionHeader
        eyebrow={data.eyebrow as string}
        heading={data.heading as string}
        intro={data.intro as string}
        tone={tone}
      />
      <div className="grid gap-x-gutter gap-y-10 sm:grid-cols-2 lg:grid-cols-3">
        {pillars.map((pillar, index) => {
          const media = image(context, pillar.image);
          const link = resolveLink(pillar.link as never, context.locale, context.pathById);

          return (
            <div key={index} className="border-t border-ink-line pt-6">
              {media ? (
                <BlockImage
                  image={media}
                  sizes="(max-width: 640px) 100vw, 33vw"
                  aspectRatio="3:2"
                  className="mb-6"
                />
              ) : null}
              <h3
                className={['text-heading-md', tone === 'dark' ? 'text-paper' : 'text-ink'].join(
                  ' ',
                )}
              >
                {pillar.title}
              </h3>
              {pillar.description ? (
                <p
                  className={[
                    'mt-3 text-body-sm',
                    tone === 'dark' ? 'text-paper/70' : 'text-ink-soft',
                  ].join(' ')}
                >
                  {pillar.description}
                </p>
              ) : null}
              {link ? (
                <div className="mt-5">{<ActionLink link={link} variant="ghost" tone={tone} />}</div>
              ) : null}
            </div>
          );
        })}
      </div>
    </Section>
  );
}

/**
 * Operations flow.
 *
 * Rendered as an ordered list so the sequence is conveyed structurally, not only
 * by the arrows — which a screen reader would not announce.
 */
export function OperationsFlow({
  data,
  context: _context,
}: {
  data: BlockData;
  context: BlockContext;
}) {
  const tone = (data.tone as Tone) ?? 'light';
  const steps = (data.steps as Array<{ label: string; description?: string }>) ?? [];
  const isVertical = data.orientation === 'vertical';
  const isDark = tone === 'dark';

  return (
    <Section tone={tone} spacing={(data.spacing as never) ?? 'standard'} width="standard">
      <SectionHeader
        eyebrow={data.eyebrow as string}
        heading={data.heading as string}
        intro={data.intro as string}
        tone={tone}
      />
      <ol
        className={[
          'grid gap-6',
          isVertical ? 'grid-cols-1' : 'sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6',
        ].join(' ')}
      >
        {steps.map((step, index) => (
          <li key={index} className="relative">
            <div
              className={[
                'flex h-8 w-8 items-center justify-center rounded-full text-body-xs font-semibold tabular-nums',
                isDark ? 'bg-paper/12 text-paper' : 'bg-ink/6 text-ink',
              ].join(' ')}
            >
              {index + 1}
            </div>
            <h3 className={['mt-4 text-heading-sm', isDark ? 'text-paper' : 'text-ink'].join(' ')}>
              {step.label}
            </h3>
            {step.description ? (
              <p
                className={['mt-2 text-body-sm', isDark ? 'text-paper/65' : 'text-ink-muted'].join(
                  ' ',
                )}
              >
                {step.description}
              </p>
            ) : null}
            {/* Connector line, hidden from assistive technology and on the last step. */}
            {index < steps.length - 1 && !isVertical ? (
              <span
                aria-hidden="true"
                className={[
                  'absolute start-10 top-4 hidden h-px w-[calc(100%-2.5rem)] xl:block',
                  isDark ? 'bg-paper/15' : 'bg-ink-line',
                ].join(' ')}
              />
            ) : null}
          </li>
        ))}
      </ol>
    </Section>
  );
}

interface TimelineEvent {
  id: string;
  year: number;
  headline: string;
  description?: string | null;
  category?: string | null;
  location?: string | null;
  isDemoContent?: boolean;
  media?: MediaImage | null;
}

/**
 * Corporate timeline.
 *
 * Presented as a vertical editorial sequence with the year set large, rather
 * than as a wall of text. Events flagged as demo content are visibly labelled,
 * because a fabricated founding date on a corporate site is a real problem.
 */
export function Timeline({
  data,
  context: _context,
  events = [],
}: {
  data: BlockData;
  context: BlockContext;
  events?: TimelineEvent[];
}) {
  const tone = (data.tone as Tone) ?? 'light';
  const limit = typeof data.limit === 'number' ? data.limit : undefined;
  const shown = limit ? events.slice(0, limit) : events;
  const isDark = tone === 'dark';

  if (shown.length === 0) return null;

  return (
    <Section tone={tone} spacing={(data.spacing as never) ?? 'standard'} width="standard">
      <SectionHeader
        eyebrow={data.eyebrow as string}
        heading={data.heading as string}
        intro={data.intro as string}
        tone={tone}
      />
      <ol className="border-t border-ink-line">
        {shown.map((event) => (
          <li
            key={event.id}
            className="grid gap-x-gutter gap-y-4 border-b border-ink-line py-10 lg:grid-cols-12"
          >
            <div className="lg:col-span-3">
              <p
                className={[
                  'text-display-sm tabular-nums',
                  isDark ? 'text-paper' : 'text-ink',
                  event.isDemoContent ? 'opacity-50' : '',
                ].join(' ')}
              >
                {event.year}
              </p>
              {event.category ? <p className="eyebrow mt-2">{event.category}</p> : null}
            </div>

            <div
              className={[
                'lg:col-span-5',
                event.media && data.showMedia !== false ? '' : 'lg:col-span-8',
              ].join(' ')}
            >
              <h3 className={['text-heading-lg', isDark ? 'text-paper' : 'text-ink'].join(' ')}>
                {event.headline}
                {event.isDemoContent ? <PlaceholderBadge tone={tone} /> : null}
              </h3>
              {event.description ? (
                <p
                  className={[
                    'mt-3 max-w-prose text-body-md',
                    isDark ? 'text-paper/70' : 'text-ink-soft',
                  ].join(' ')}
                >
                  {event.description}
                </p>
              ) : null}
              {event.location ? (
                <p
                  className={[
                    'mt-3 text-body-sm',
                    isDark ? 'text-paper/50' : 'text-ink-faint',
                  ].join(' ')}
                >
                  {event.location}
                </p>
              ) : null}
            </div>

            {event.media && data.showMedia !== false ? (
              <div className="lg:col-span-4">
                <BlockImage
                  image={event.media}
                  sizes="(max-width: 1024px) 100vw, 33vw"
                  aspectRatio="3:2"
                />
              </div>
            ) : null}
          </li>
        ))}
      </ol>
    </Section>
  );
}

interface FootprintCity {
  id: string;
  name: string;
  slug: string;
  latitude: number | null;
  longitude: number | null;
  summary: string | null;
  restaurantCount: number | null;
  teamMemberCount: number | null;
  firstOpeningYear: number | null;
  facilityNote: string | null;
  isDemoContent: boolean;
  corporateLocations: Array<{ id: string; name: string; kind: string; summary: string | null }>;
}

interface FootprintRegion {
  id: string;
  name: string;
  slug: string;
  kind: string;
  summary: string | null;
  cities: FootprintCity[];
}

/**
 * Corporate footprint.
 *
 * Business presence by region and city — not a consumer restaurant locator.
 *
 * Presented as a structured list rather than only an interactive map: a map is a
 * poor primary interface for a keyboard or screen-reader user, and this data is
 * genuinely tabular. Metrics appear only where a value has been approved; a city
 * with no approved figures still lists, it simply shows no numbers.
 */
export function PakistanFootprint({
  data,
  context: _context,
  regions = [],
}: {
  data: BlockData;
  context: BlockContext;
  regions?: FootprintRegion[];
}) {
  const tone = (data.tone as Tone) ?? 'light';
  const metrics = (data.metrics as string[]) ?? ['restaurants'];
  const isDark = tone === 'dark';

  if (regions.length === 0) return null;

  const totalCities = regions.reduce((sum, region) => sum + region.cities.length, 0);

  return (
    <Section tone={tone} spacing={(data.spacing as never) ?? 'standard'} width="standard">
      <SectionHeader
        eyebrow={data.eyebrow as string}
        heading={data.heading as string}
        intro={data.intro as string}
        tone={tone}
        action={
          <p className={['text-body-sm', isDark ? 'text-paper/60' : 'text-ink-muted'].join(' ')}>
            {regions.length} regions · {totalCities} cities
          </p>
        }
      />

      <div className="grid gap-x-gutter gap-y-12 lg:grid-cols-12">
        {regions.map((region) => (
          <div key={region.id} className="lg:col-span-4">
            <h3 className={['text-heading-md', isDark ? 'text-paper' : 'text-ink'].join(' ')}>
              {region.name}
            </h3>
            {region.summary ? (
              <p
                className={['mt-2 text-body-sm', isDark ? 'text-paper/60' : 'text-ink-muted'].join(
                  ' ',
                )}
              >
                {region.summary}
              </p>
            ) : null}

            <ul className="mt-5 border-t border-ink-line">
              {region.cities.map((city) => {
                const figures: Array<{ label: string; value: number }> = [];
                if (metrics.includes('restaurants') && city.restaurantCount !== null) {
                  figures.push({ label: 'restaurants', value: city.restaurantCount });
                }
                if (metrics.includes('teamMembers') && city.teamMemberCount !== null) {
                  figures.push({ label: 'team members', value: city.teamMemberCount });
                }
                if (metrics.includes('firstOpening') && city.firstOpeningYear !== null) {
                  figures.push({ label: 'since', value: city.firstOpeningYear });
                }

                return (
                  <li key={city.id} className="border-b border-ink-line py-3.5">
                    <div className="flex items-baseline justify-between gap-4">
                      <span
                        className={['text-body-md', isDark ? 'text-paper' : 'text-ink'].join(' ')}
                      >
                        {city.name}
                      </span>
                      {figures.length > 0 ? (
                        <span
                          className={[
                            'shrink-0 text-body-sm tabular-nums',
                            isDark ? 'text-paper/60' : 'text-ink-muted',
                          ].join(' ')}
                        >
                          {figures.map((figure) => `${figure.value} ${figure.label}`).join(' · ')}
                        </span>
                      ) : null}
                    </div>

                    {city.corporateLocations.length > 0 ? (
                      <ul className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1">
                        {city.corporateLocations.map((location) => (
                          <li
                            key={location.id}
                            className={[
                              'text-body-xs',
                              isDark ? 'text-paper/45' : 'text-ink-faint',
                            ].join(' ')}
                          >
                            {location.name}
                          </li>
                        ))}
                      </ul>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </div>

      {/*
        Stated rather than left implicit: a visitor comparing this to a public
        restaurant count should know why the numbers may differ.
      */}
      <p
        className={[
          'mt-10 max-w-prose text-body-xs',
          isDark ? 'text-paper/45' : 'text-ink-faint',
        ].join(' ')}
      >
        Figures shown are those approved for publication. Where a figure is not shown, it has not
        yet been confirmed. This is a corporate footprint, not a restaurant locator.
      </p>
    </Section>
  );
}

export { Stat };
