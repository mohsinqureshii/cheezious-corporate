import Link from 'next/link';

import type { MediaImage } from '@/lib/content';

import { PublicForm } from '../forms/PublicForm';

import type { BlockContext } from './heroes';
import {
  ActionLink,
  BlockImage,
  resolveLink,
  Section,
  SectionHeader,
  type Tone,
} from './primitives';

/** Call-to-action blocks. Each routes to a real business process. */

type BlockData = Record<string, unknown>;

function image(context: BlockContext, ref: unknown): MediaImage | null {
  const assetId = (ref as { assetId?: string } | undefined)?.assetId;
  return assetId ? (context.images.get(assetId) ?? null) : null;
}

export function CTAEditorial({ data, context }: { data: BlockData; context: BlockContext }) {
  const tone = (data.tone as Tone) ?? 'light';
  const media = image(context, data.image);
  const primary = resolveLink(data.primaryLink as never, context.locale, context.pathById);
  const secondary = resolveLink(data.secondaryLink as never, context.locale, context.pathById);

  // A call to action with no destination is not worth rendering.
  if (!primary && !secondary) return null;

  const isDark = tone === 'dark';

  return (
    <Section
      tone={tone}
      spacing={(data.spacing as never) ?? 'standard'}
      width={(data.width as never) ?? 'standard'}
    >
      <div className="grid items-center gap-x-gutter gap-y-10 lg:grid-cols-12">
        <div className={media ? 'lg:col-span-6' : 'lg:col-span-8'}>
          {data.eyebrow ? (
            <p className={['eyebrow', isDark ? 'text-paper/60' : 'text-ink-muted'].join(' ')}>
              {String(data.eyebrow)}
            </p>
          ) : null}
          {data.heading ? (
            <h2 className={['mt-4 text-display-sm', isDark ? 'text-paper' : 'text-ink'].join(' ')}>
              {String(data.heading)}
            </h2>
          ) : null}
          {data.body ? (
            <p
              className={[
                'mt-5 max-w-prose text-body-lg',
                isDark ? 'text-paper/75' : 'text-ink-soft',
              ].join(' ')}
            >
              {String(data.body)}
            </p>
          ) : null}
          <div className="mt-8 flex flex-wrap gap-4">
            {primary ? <ActionLink link={primary} tone={tone} /> : null}
            {secondary ? <ActionLink link={secondary} variant="secondary" tone={tone} /> : null}
          </div>
        </div>

        {media ? (
          <div className="lg:col-span-5 lg:col-start-8">
            <BlockImage image={media} sizes="(max-width: 1024px) 100vw, 40vw" aspectRatio="3:2" />
          </div>
        ) : null}
      </div>
    </Section>
  );
}

/**
 * Full-width call-to-action band.
 *
 * The one place a large area of Cheezious yellow is justified: a single,
 * deliberate action, used sparingly enough that it still carries weight.
 */
export function CTABand({ data, context }: { data: BlockData; context: BlockContext }) {
  const tone = (data.tone as Tone) ?? 'accent';
  const primary = resolveLink(data.primaryLink as never, context.locale, context.pathById);
  const secondary = resolveLink(data.secondaryLink as never, context.locale, context.pathById);

  if (!primary) return null;

  const isAccent = tone === 'accent';
  const isDark = tone === 'dark';

  return (
    <Section tone={tone} spacing="compact" width="standard">
      <div className="flex flex-col items-start gap-8 lg:flex-row lg:items-center lg:justify-between">
        <div className="max-w-2xl">
          <h2
            className={[
              'text-display-sm',
              isAccent ? 'text-brand-ink' : isDark ? 'text-paper' : 'text-ink',
            ].join(' ')}
          >
            {String(data.headline ?? '')}
          </h2>
          {data.body ? (
            <p
              className={[
                'mt-3 text-body-lg',
                isAccent ? 'text-brand-ink/75' : isDark ? 'text-paper/75' : 'text-ink-soft',
              ].join(' ')}
            >
              {String(data.body)}
            </p>
          ) : null}
        </div>

        <div className="flex shrink-0 flex-wrap gap-4">
          {/* On the yellow band the button inverts to ink for contrast. */}
          <ActionLink link={primary} tone={isAccent ? 'light' : tone} />
          {secondary ? (
            <ActionLink link={secondary} variant="secondary" tone={isAccent ? 'light' : tone} />
          ) : null}
        </div>
      </div>
    </Section>
  );
}

/**
 * Contact directory.
 *
 * Routes an enquiry to the right team rather than offering one generic form —
 * which is the difference between a supplier reaching Procurement and reaching
 * nobody.
 */
export function ContactDirectory({ data, context }: { data: BlockData; context: BlockContext }) {
  const tone = (data.tone as Tone) ?? 'light';
  const entries = (data.entries as Array<Record<string, unknown>>) ?? [];
  if (entries.length === 0) return null;

  return (
    <Section
      tone={tone}
      spacing={(data.spacing as never) ?? 'standard'}
      width={(data.width as never) ?? 'standard'}
    >
      <SectionHeader
        eyebrow={data.eyebrow as string}
        heading={data.heading as string}
        intro={data.intro as string}
        tone={tone}
      />
      <ul className="grid gap-x-gutter gap-y-8 sm:grid-cols-2 lg:grid-cols-3">
        {entries.map((entry, index) => {
          const link = resolveLink(entry.link as never, context.locale, context.pathById);

          return (
            <li key={index} className="border-t border-ink-line pt-5">
              <h3 className="text-heading-sm text-ink">{String(entry.title ?? '')}</h3>
              {entry.description ? (
                <p className="mt-2 text-body-sm text-ink-soft">{String(entry.description)}</p>
              ) : null}

              <div className="mt-4 space-y-1.5">
                {entry.email ? (
                  <p>
                    <a
                      href={`mailto:${String(entry.email)}`}
                      className="text-body-sm text-ink underline decoration-brand decoration-2 underline-offset-4
                                 transition-colors duration-quick hover:text-brand-deep"
                    >
                      {String(entry.email)}
                    </a>
                  </p>
                ) : null}
                {entry.phone ? (
                  <p>
                    <a
                      href={`tel:${String(entry.phone).replace(/\s/g, '')}`}
                      className="text-body-sm text-ink-soft"
                    >
                      {String(entry.phone)}
                    </a>
                  </p>
                ) : null}
                {link ? (
                  <p className="pt-1">
                    <Link
                      href={link.href}
                      className="inline-flex items-center gap-1.5 text-body-sm font-semibold text-ink no-underline
                                 transition-colors duration-quick hover:text-brand-deep"
                    >
                      {link.label}
                      <svg
                        width="12"
                        height="9"
                        viewBox="0 0 12 9"
                        fill="none"
                        aria-hidden="true"
                        className="rtl:rotate-180"
                      >
                        <path
                          d="M7.5 1L11 4.5 7.5 8M11 4.5H1"
                          stroke="currentColor"
                          strokeWidth="1.4"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    </Link>
                  </p>
                ) : null}
              </div>
            </li>
          );
        })}
      </ul>
    </Section>
  );
}

/** Embeds a CMS-defined form. The form itself is a client component. */
export function FormBlock({ data, context }: { data: BlockData; context: BlockContext }) {
  const tone = (data.tone as Tone) ?? 'light';
  const formKey = data.formKey as string | undefined;
  if (!formKey) return null;

  return (
    <Section
      tone={tone}
      spacing={(data.spacing as never) ?? 'standard'}
      width={(data.width as never) ?? 'narrow'}
    >
      <SectionHeader
        eyebrow={data.eyebrow as string}
        heading={(data.heading as string) ?? (data.successHeading as string)}
        intro={data.intro as string}
        tone={tone}
      />
      <PublicForm formKey={formKey} locale={context.locale} />
    </Section>
  );
}
