import type { Locale } from '@cheezious/config';

import type { MediaImage } from '@/lib/content';

import { ActionLink, BlockImage, RichText, resolveLink, Section, type Tone } from './primitives';

/**
 * Hero blocks.
 *
 * The hero carries the page's h1 and, on overlay heroes, sits behind the
 * transparent header. Two details that are easy to get wrong and expensive when
 * you do: the hero image is the LCP element and so is always `priority`, and
 * light text over a photograph needs a gradient scrim rather than hope, because
 * a bright sky in the top-left corner will otherwise make the headline
 * unreadable.
 */

export interface BlockContext {
  locale: Locale;
  /** Media assets referenced by this page, resolved by the renderer. */
  images: Map<string, MediaImage>;
  /** Page paths by id, so internal links resolve without storing URLs. */
  pathById: Map<string, string>;
  /** True for the first block on the page: enables LCP priority loading. */
  isFirst: boolean;
}

type BlockData = Record<string, unknown>;

function image(context: BlockContext, ref: unknown): MediaImage | null {
  const assetId = (ref as { assetId?: string } | undefined)?.assetId;
  return assetId ? (context.images.get(assetId) ?? null) : null;
}

function altOverride(ref: unknown): string | undefined {
  return (ref as { altText?: string } | undefined)?.altText;
}

export function HeroEditorial({ data, context }: { data: BlockData; context: BlockContext }) {
  const hero = image(context, data.image);
  const tone = (data.tone as Tone) ?? 'dark';
  const isDark = tone === 'dark';

  const primary = resolveLink(data.primaryLink as never, context.locale, context.pathById);
  const secondary = resolveLink(data.secondaryLink as never, context.locale, context.pathById);
  const alignCentre = data.align === 'center';

  // Without an image the hero becomes a typographic opening rather than an
  // empty dark band with nothing behind it.
  if (!hero) {
    return (
      <Section tone={tone} spacing="generous" width="standard">
        <div className={['max-w-4xl', alignCentre ? 'mx-auto text-center' : ''].join(' ')}>
          {data.eyebrow ? (
            <p className={['eyebrow', isDark ? 'text-paper/60' : 'text-ink-muted'].join(' ')}>
              {String(data.eyebrow)}
            </p>
          ) : null}
          <h1 className={['mt-5 text-display-lg', isDark ? 'text-paper' : 'text-ink'].join(' ')}>
            {String(data.headline ?? '')}
          </h1>
          {data.standfirst ? (
            <p
              className={[
                'mt-7 max-w-prose text-body-lg',
                isDark ? 'text-paper/75' : 'text-ink-soft',
                alignCentre ? 'mx-auto' : '',
              ].join(' ')}
            >
              {String(data.standfirst)}
            </p>
          ) : null}
          {primary || secondary ? (
            <div
              className={['mt-10 flex flex-wrap gap-4', alignCentre ? 'justify-center' : ''].join(
                ' ',
              )}
            >
              {primary ? <ActionLink link={primary} tone={tone} /> : null}
              {secondary ? <ActionLink link={secondary} variant="secondary" tone={tone} /> : null}
            </div>
          ) : null}
        </div>
      </Section>
    );
  }

  return (
    <section className="relative isolate bg-ink">
      <div className="absolute inset-0">
        <BlockImage
          image={hero}
          alt={altOverride(data.image)}
          sizes="100vw"
          aspectRatio={(data.aspectRatio as string) ?? '21:9'}
          priority={context.isFirst}
          reveal={false}
          className="h-full w-full [&>img]:object-cover"
        />
        {/*
          Two scrims rather than one: a bottom-up gradient anchors the text, and
          a light overall wash keeps contrast on images that are bright
          throughout. Together they hold WCAG AA on real photographs.
        */}
        <div
          className="absolute inset-0 bg-gradient-to-t from-ink/85 via-ink/45 to-ink/20"
          aria-hidden="true"
        />
        <div className="absolute inset-0 bg-ink/15" aria-hidden="true" />
      </div>

      <div className="container-wide relative">
        {/* Extra top padding clears the transparent header. */}
        <div className="flex min-h-[clamp(28rem,62vh,44rem)] flex-col justify-end pb-16 pt-[calc(var(--header-height)+4rem)] lg:pb-24">
          <div className={['max-w-4xl', alignCentre ? 'mx-auto text-center' : ''].join(' ')}>
            {data.eyebrow ? <p className="eyebrow text-paper/70">{String(data.eyebrow)}</p> : null}
            <h1 className="mt-5 text-display-xl text-paper">{String(data.headline ?? '')}</h1>
            {data.standfirst ? (
              <p
                className={[
                  'mt-7 max-w-prose text-body-lg text-paper/85',
                  alignCentre ? 'mx-auto' : '',
                ].join(' ')}
              >
                {String(data.standfirst)}
              </p>
            ) : null}
            {primary || secondary ? (
              <div
                className={['mt-10 flex flex-wrap gap-4', alignCentre ? 'justify-center' : ''].join(
                  ' ',
                )}
              >
                {primary ? <ActionLink link={primary} tone="dark" /> : null}
                {secondary ? <ActionLink link={secondary} variant="secondary" tone="dark" /> : null}
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </section>
  );
}

export function HeroMedia({ data, context }: { data: BlockData; context: BlockContext }) {
  const hero = image(context, data.image);
  const layout = (data.layout as string) ?? 'overlay';
  const primary = resolveLink(data.primaryLink as never, context.locale, context.pathById);

  if (layout === 'split') {
    return (
      <section className="bg-paper">
        <div className="container-wide">
          <div className="grid items-center gap-x-gutter gap-y-10 pt-[calc(var(--header-height)+3rem)] pb-section-compact lg:grid-cols-2">
            <div>
              {data.eyebrow ? <p className="eyebrow">{String(data.eyebrow)}</p> : null}
              <h1 className="mt-5 text-display-lg text-ink">{String(data.headline ?? '')}</h1>
              {data.standfirst ? (
                <p className="mt-6 max-w-prose text-body-lg text-ink-soft">
                  {String(data.standfirst)}
                </p>
              ) : null}
              {primary ? <div className="mt-9">{<ActionLink link={primary} />}</div> : null}
            </div>
            <BlockImage
              image={hero}
              alt={altOverride(data.image)}
              sizes="(max-width: 1024px) 100vw, 50vw"
              aspectRatio={(data.aspectRatio as string) ?? '3:2'}
              priority={context.isFirst}
            />
          </div>
        </div>
      </section>
    );
  }

  if (layout === 'below') {
    return (
      <section className="bg-paper">
        <div className="container-standard pt-[calc(var(--header-height)+3rem)]">
          <div className="max-w-4xl">
            {data.eyebrow ? <p className="eyebrow">{String(data.eyebrow)}</p> : null}
            <h1 className="mt-5 text-display-lg text-ink">{String(data.headline ?? '')}</h1>
            {data.standfirst ? (
              <p className="mt-6 max-w-prose text-body-lg text-ink-soft">
                {String(data.standfirst)}
              </p>
            ) : null}
          </div>
        </div>
        <div className="container-wide mt-12">
          <BlockImage
            image={hero}
            alt={altOverride(data.image)}
            sizes="100vw"
            aspectRatio={(data.aspectRatio as string) ?? '16:9'}
            priority={context.isFirst}
          />
        </div>
      </section>
    );
  }

  return <HeroEditorial data={{ ...data, tone: 'dark' }} context={context} />;
}

export function HeroVideo({ data, context }: { data: BlockData; context: BlockContext }) {
  const poster = image(context, data.poster);

  /**
   * Video heroes render as a poster image with the video layered over it.
   * The poster is what loads first and what remains for anyone with reduced
   * motion, on a slow connection, or with autoplay blocked — which is why the
   * schema makes it required rather than optional.
   */
  return (
    <section className="relative isolate bg-ink">
      <div className="absolute inset-0">
        <BlockImage
          image={poster}
          sizes="100vw"
          aspectRatio="21:9"
          priority={context.isFirst}
          reveal={false}
          className="h-full w-full"
        />
        {typeof data.videoUrl === 'string' && data.videoUrl ? (
          <video
            className="absolute inset-0 h-full w-full object-cover motion-reduce:hidden"
            autoPlay={data.autoplay !== false}
            loop={data.loop !== false}
            muted
            playsInline
            poster={undefined}
            aria-hidden="true"
          >
            <source src={data.videoUrl} />
          </video>
        ) : null}
        <div
          className="absolute inset-0 bg-gradient-to-t from-ink/85 via-ink/45 to-ink/20"
          aria-hidden="true"
        />
      </div>

      <div className="container-wide relative">
        <div className="flex min-h-[clamp(28rem,62vh,44rem)] flex-col justify-end pb-16 pt-[calc(var(--header-height)+4rem)] lg:pb-24">
          <div className="max-w-4xl">
            {data.eyebrow ? <p className="eyebrow text-paper/70">{String(data.eyebrow)}</p> : null}
            <h1 className="mt-5 text-display-xl text-paper">{String(data.headline ?? '')}</h1>
            {data.standfirst ? (
              <p className="mt-7 max-w-prose text-body-lg text-paper/85">
                {String(data.standfirst)}
              </p>
            ) : null}
          </div>
        </div>
      </div>
    </section>
  );
}

export function HeroMinimal({
  data,
  context: _context,
}: {
  data: BlockData;
  context: BlockContext;
}) {
  const tone = (data.tone as Tone) ?? 'light';
  const isDark = tone === 'dark';

  return (
    <section className={[isDark ? 'bg-ink' : 'bg-paper', 'border-b border-ink-line'].join(' ')}>
      <div className="container-standard pb-section-compact pt-[calc(var(--header-height)+3.5rem)]">
        <div className="max-w-4xl">
          {data.eyebrow ? (
            <p className={['eyebrow', isDark ? 'text-paper/60' : 'text-ink-muted'].join(' ')}>
              {String(data.eyebrow)}
            </p>
          ) : null}
          <h1 className={['mt-5 text-display-md', isDark ? 'text-paper' : 'text-ink'].join(' ')}>
            {String(data.headline ?? '')}
          </h1>
          {data.standfirst ? (
            <p
              className={[
                'mt-6 max-w-prose text-body-lg',
                isDark ? 'text-paper/75' : 'text-ink-soft',
              ].join(' ')}
            >
              {String(data.standfirst)}
            </p>
          ) : null}
        </div>
      </div>
    </section>
  );
}

export function IntroStatement({ data, context }: { data: BlockData; context: BlockContext }) {
  const tone = (data.tone as Tone) ?? 'light';
  const link = resolveLink(data.link as never, context.locale, context.pathById);

  return (
    <Section tone={tone} spacing={(data.spacing as never) ?? 'standard'} width="standard">
      <div className="max-w-4xl">
        {/*
          Set at display size rather than body size: a statement block exists to
          slow the reader down, and that is a typographic decision, not a copy one.
        */}
        <p className={['text-display-sm', tone === 'dark' ? 'text-paper' : 'text-ink'].join(' ')}>
          {String(data.statement ?? '')}
        </p>
        {data.attribution ? (
          <p
            className={[
              'mt-6 text-body-sm',
              tone === 'dark' ? 'text-paper/60' : 'text-ink-muted',
            ].join(' ')}
          >
            {String(data.attribution)}
          </p>
        ) : null}
        {link ? (
          <div className="mt-8">{<ActionLink link={link} variant="ghost" tone={tone} />}</div>
        ) : null}
      </div>
    </Section>
  );
}

export { RichText };
