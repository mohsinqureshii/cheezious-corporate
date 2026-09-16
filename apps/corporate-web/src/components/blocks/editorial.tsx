import Link from 'next/link';

import type { MediaImage } from '@/lib/content';

import type { BlockContext } from './heroes';
import {
  ActionLink,
  BlockImage,
  ImageCaption,
  RichText,
  resolveLink,
  Section,
  SectionHeader,
  type Tone,
} from './primitives';

/** Editorial composition blocks: text, split layouts, quotes and accordions. */

type BlockData = Record<string, unknown>;

function image(context: BlockContext, ref: unknown): MediaImage | null {
  const assetId = (ref as { assetId?: string } | undefined)?.assetId;
  return assetId ? (context.images.get(assetId) ?? null) : null;
}

export function RichTextBlock({ data, context: _context }: { data: BlockData; context: BlockContext }) {
  const tone = (data.tone as Tone) ?? 'light';

  return (
    <Section tone={tone} spacing={(data.spacing as never) ?? 'standard'} width={(data.width as never) ?? 'narrow'}>
      <SectionHeader
        eyebrow={data.eyebrow as string}
        heading={data.heading as string}
        intro={data.intro as string}
        tone={tone}
        align={(data.align as never) ?? 'start'}
      />
      {typeof data.body === 'string' && data.body ? (
        <RichText html={data.body} className={tone === 'dark' ? 'text-paper/80' : ''} />
      ) : null}
    </Section>
  );
}

export function TwoColumnText({ data, context: _context }: { data: BlockData; context: BlockContext }) {
  const tone = (data.tone as Tone) ?? 'light';

  return (
    <Section tone={tone} spacing={(data.spacing as never) ?? 'standard'} width="standard">
      <SectionHeader eyebrow={data.eyebrow as string} heading={data.heading as string} intro={data.intro as string} tone={tone} />
      <div className="grid gap-x-gutter gap-y-8 md:grid-cols-2">
        {typeof data.left === 'string' ? <RichText html={data.left} /> : null}
        {typeof data.right === 'string' ? <RichText html={data.right} /> : null}
      </div>
    </Section>
  );
}

export function ThreeColumnEditorial({ data, context }: { data: BlockData; context: BlockContext }) {
  const tone = (data.tone as Tone) ?? 'light';
  const columns = (data.columns as Array<Record<string, unknown>>) ?? [];

  return (
    <Section tone={tone} spacing={(data.spacing as never) ?? 'standard'} width="standard">
      <SectionHeader eyebrow={data.eyebrow as string} heading={data.heading as string} intro={data.intro as string} tone={tone} />
      <div
        className={[
          'grid gap-x-gutter gap-y-10',
          columns.length === 3 ? 'md:grid-cols-3' : 'md:grid-cols-2',
        ].join(' ')}
      >
        {columns.map((column, index) => {
          const link = resolveLink(column.link as never, context.locale, context.pathById);
          return (
            <div key={index}>
              {column.heading ? (
                <h3 className={['text-heading-md', tone === 'dark' ? 'text-paper' : 'text-ink'].join(' ')}>
                  {String(column.heading)}
                </h3>
              ) : null}
              {typeof column.body === 'string' ? <RichText html={column.body} className="mt-4" /> : null}
              {link ? <div className="mt-5">{<ActionLink link={link} variant="ghost" tone={tone} />}</div> : null}
            </div>
          );
        })}
      </div>
    </Section>
  );
}

/**
 * Editorial split: copy beside photography.
 *
 * The workhorse of a corporate site. `overlapGrid` lets the image break out of
 * the column so the composition is asymmetric rather than two equal boxes, which
 * is most of what separates an editorial layout from a template.
 */
export function EditorialSplit({ data, context }: { data: BlockData; context: BlockContext }) {
  const tone = (data.tone as Tone) ?? 'light';
  const media = image(context, data.image);
  const mediaOnLeft = data.mediaPosition === 'left';
  const overlap = data.overlapGrid === true;

  const links = ((data.links as Array<Record<string, unknown>>) ?? [])
    .map((link) => resolveLink(link as never, context.locale, context.pathById))
    .filter((link): link is NonNullable<typeof link> => Boolean(link));

  return (
    <Section tone={tone} spacing={(data.spacing as never) ?? 'standard'} width="standard">
      <div className="grid items-center gap-x-gutter gap-y-12 lg:grid-cols-12">
        <div
          className={[
            'lg:col-span-5',
            mediaOnLeft ? 'lg:order-2 lg:col-start-8' : 'lg:order-1',
          ].join(' ')}
        >
          {data.eyebrow ? (
            <p className={['eyebrow', tone === 'dark' ? 'text-paper/60' : 'text-ink-muted'].join(' ')}>
              {String(data.eyebrow)}
            </p>
          ) : null}
          {data.heading ? (
            <h2 className={['mt-4 text-display-sm', tone === 'dark' ? 'text-paper' : 'text-ink'].join(' ')}>
              {String(data.heading)}
            </h2>
          ) : null}
          {typeof data.body === 'string' && data.body ? (
            <RichText html={data.body} className={['mt-6', tone === 'dark' ? 'text-paper/80' : ''].join(' ')} />
          ) : null}
          {links.length > 0 ? (
            <div className="mt-8 flex flex-wrap gap-x-8 gap-y-3">
              {links.map((link, index) => (
                <ActionLink key={index} link={link} variant="ghost" tone={tone} />
              ))}
            </div>
          ) : null}
        </div>

        <figure
          className={[
            'lg:col-span-6',
            mediaOnLeft ? 'lg:order-1 lg:col-start-1' : 'lg:order-2 lg:col-start-7',
            // Breaking the gutter is what makes the layout read as editorial
            // rather than as two cards side by side.
            overlap ? 'lg:-me-gutter' : '',
          ].join(' ')}
        >
          <BlockImage
            image={media}
            alt={(data.image as { altText?: string } | undefined)?.altText}
            sizes="(max-width: 1024px) 100vw, 50vw"
            aspectRatio={(data.aspectRatio as string) ?? '4:5'}
          />
          <ImageCaption image={media} tone={tone} />
        </figure>
      </div>
    </Section>
  );
}

export function FullBleedImage({ data, context }: { data: BlockData; context: BlockContext }) {
  const media = image(context, data.image);

  return (
    <section className="relative bg-ink">
      <BlockImage
        image={media}
        sizes="100vw"
        aspectRatio={(data.aspectRatio as string) ?? '21:9'}
        className="w-full"
      />
      {data.overlayHeading ? (
        <div className="absolute inset-0 flex items-end bg-gradient-to-t from-ink/80 to-transparent">
          <div className="container-wide pb-12 lg:pb-20">
            <h2 className="max-w-3xl text-display-sm text-paper">{String(data.overlayHeading)}</h2>
            {data.overlayBody ? (
              <p className="mt-4 max-w-prose text-body-lg text-paper/80">{String(data.overlayBody)}</p>
            ) : null}
          </div>
        </div>
      ) : null}
      {data.caption ? (
        <div className="container-wide py-4">
          <p className="text-body-xs text-ink-faint">{String(data.caption)}</p>
        </div>
      ) : null}
    </section>
  );
}

/**
 * Pulled quote.
 *
 * Set at display size in a constrained measure. No decorative quotation marks:
 * the scale and the whitespace do the work.
 */
export function QuoteBlock({ data, context }: { data: BlockData; context: BlockContext }) {
  const tone = (data.tone as Tone) ?? 'light';
  const quote = (data.quote as Record<string, unknown>) ?? {};
  const portrait = image(context, quote.portrait);
  const isDark = tone === 'dark';

  return (
    <Section tone={tone} spacing={(data.spacing as never) ?? 'standard'} width="standard">
      <figure className="mx-auto max-w-4xl">
        <blockquote>
          <p className={['text-display-sm', isDark ? 'text-paper' : 'text-ink'].join(' ')}>
            {String(quote.text ?? '')}
          </p>
        </blockquote>
        {quote.attribution ? (
          <figcaption className="mt-8 flex items-center gap-4">
            {portrait ? (
              <BlockImage image={portrait} sizes="56px" aspectRatio="1:1" className="w-14 shrink-0 rounded-full" reveal={false} />
            ) : null}
            <div>
              <p className={['text-body-sm font-semibold', isDark ? 'text-paper' : 'text-ink'].join(' ')}>
                {String(quote.attribution)}
              </p>
              {quote.role ? (
                <p className={['text-body-sm', isDark ? 'text-paper/60' : 'text-ink-muted'].join(' ')}>
                  {String(quote.role)}
                </p>
              ) : null}
            </div>
          </figcaption>
        ) : null}
      </figure>
    </Section>
  );
}

/**
 * Accordion / FAQ.
 *
 * Built on native `<details>` and `<summary>`: keyboard operable, searchable by
 * the browser's find-in-page, and functional without JavaScript — all of which a
 * custom div-based accordion typically gives up.
 */
export function Accordion({ data, context: _context }: { data: BlockData; context: BlockContext }) {
  const tone = (data.tone as Tone) ?? 'light';
  const items = (data.items as Array<{ question: string; answer: string }>) ?? [];
  const allowMultiple = data.allowMultiple === true;
  const groupName = allowMultiple ? undefined : `accordion-${String(data.heading ?? 'group')}`;

  return (
    <Section tone={tone} spacing={(data.spacing as never) ?? 'standard'} width="narrow">
      <SectionHeader eyebrow={data.eyebrow as string} heading={data.heading as string} intro={data.intro as string} tone={tone} />
      <div className="border-t border-ink-line">
        {items.map((item, index) => (
          <details key={index} name={groupName} className="group border-b border-ink-line">
            <summary
              className="flex cursor-pointer list-none items-start justify-between gap-6 py-5
                         text-heading-sm text-ink transition-colors duration-quick hover:text-brand-deep
                         [&::-webkit-details-marker]:hidden"
            >
              {item.question}
              <svg
                width="16"
                height="16"
                viewBox="0 0 16 16"
                fill="none"
                aria-hidden="true"
                className="mt-1 shrink-0 text-ink-muted transition-transform duration-quick group-open:rotate-45"
              >
                <path d="M8 2v12M2 8h12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
            </summary>
            <div className="pb-6 pe-10">
              <RichText html={item.answer} />
            </div>
          </details>
        ))}
      </div>
    </Section>
  );
}

export function Spacer({ data }: { data: BlockData; context: BlockContext }) {
  const size = (data.size as string) ?? 'medium';
  const height = size === 'small' ? 'h-10' : size === 'large' ? 'h-24' : 'h-16';

  return (
    <div className={['container-standard', height, 'flex items-center'].join(' ')}>
      {data.showRule === true ? <hr className="rule w-full" /> : null}
    </div>
  );
}

/** Related content: derived links back into the site. */
export function RelatedContent({
  data,
  context,
  related,
}: {
  data: BlockData;
  context: BlockContext;
  related?: Array<{ title: string; href: string; eyebrow?: string; summary?: string }>;
}) {
  const tone = (data.tone as Tone) ?? 'light';
  const items = related ?? [];

  // Nothing to relate to is a normal outcome on a leaf page; render nothing
  // rather than an empty heading.
  if (items.length === 0) return null;

  return (
    <Section tone={tone} spacing="compact" width={(data.width as never) ?? 'standard'}>
      <SectionHeader heading={(data.heading as string) ?? 'Related'} tone={tone} />
      <ul className="grid gap-x-gutter gap-y-6 sm:grid-cols-2 lg:grid-cols-4">
        {items.slice(0, 4).map((item) => (
          <li key={item.href} className="border-t border-ink-line pt-5">
            {item.eyebrow ? <p className="eyebrow">{item.eyebrow}</p> : null}
            <Link
              href={item.href}
              className="mt-2 block text-heading-sm text-ink no-underline transition-colors duration-quick hover:text-brand-deep"
            >
              {item.title}
            </Link>
            {item.summary ? <p className="mt-2 line-clamp-2 text-body-sm text-ink-muted">{item.summary}</p> : null}
          </li>
        ))}
      </ul>
    </Section>
  );
}

export { RichText };
