import type { Locale } from '@cheezious/config';
import Image from 'next/image';
import Link from 'next/link';
import type { ReactNode } from 'react';

import { mediaUrl } from '@/lib/urls';
import type { MediaImage } from '@/lib/content';

/**
 * Block primitives.
 *
 * Shared building pieces every block composes from, so tone, measure and rhythm
 * are decided once rather than re-implemented per block.
 */

export type Tone = 'light' | 'muted' | 'dark' | 'accent';
export type Width = 'narrow' | 'standard' | 'wide' | 'full';
export type Spacing = 'compact' | 'standard' | 'generous';

const TONE_CLASSES: Record<Tone, string> = {
  light: 'bg-paper text-ink',
  muted: 'bg-paper-sunken text-ink',
  dark: 'bg-ink text-paper',
  accent: 'bg-brand text-brand-ink',
};

const SPACING_CLASSES: Record<Spacing, string> = {
  compact: 'py-section-compact',
  standard: 'py-section',
  generous: 'py-section-generous',
};

const WIDTH_CLASSES: Record<Width, string> = {
  narrow: 'container-narrow',
  standard: 'container-standard',
  wide: 'container-wide',
  full: 'w-full',
};

export interface SectionProps {
  tone?: Tone;
  spacing?: Spacing;
  width?: Width;
  id?: string;
  className?: string;
  children: ReactNode;
}

/** A page section: owns the surface colour and the vertical rhythm. */
export function Section({ tone = 'light', spacing = 'standard', width = 'standard', id, className, children }: SectionProps) {
  return (
    <section id={id} className={[TONE_CLASSES[tone], SPACING_CLASSES[spacing], className ?? ''].join(' ')}>
      <div className={WIDTH_CLASSES[width]}>{children}</div>
    </section>
  );
}

export interface SectionHeaderProps {
  eyebrow?: string;
  heading?: string;
  intro?: string;
  tone?: Tone;
  align?: 'start' | 'center';
  /** Rendered opposite the heading, typically a "view all" link. */
  action?: ReactNode;
  headingLevel?: 2 | 3;
}

/**
 * Section heading.
 *
 * Heading level is a prop rather than hardcoded, because a correct document
 * outline matters for screen-reader navigation: a page has one h1 (the hero) and
 * sections are h2.
 */
export function SectionHeader({
  eyebrow,
  heading,
  intro,
  tone = 'light',
  align = 'start',
  action,
  headingLevel = 2,
}: SectionHeaderProps) {
  if (!eyebrow && !heading && !intro) return null;

  const isDark = tone === 'dark';
  const Heading = headingLevel === 2 ? 'h2' : 'h3';

  return (
    <div
      className={[
        'mb-10 flex flex-col gap-6 lg:mb-14 lg:flex-row lg:items-end lg:justify-between',
        align === 'center' ? 'text-center lg:flex-col lg:items-center lg:text-center' : '',
      ].join(' ')}
    >
      <div className={align === 'center' ? 'max-w-2xl' : 'max-w-3xl'}>
        {eyebrow ? (
          <p className={['eyebrow', isDark ? 'text-paper/60' : 'text-ink-muted'].join(' ')}>{eyebrow}</p>
        ) : null}
        {heading ? (
          <Heading
            className={[
              'text-display-sm',
              eyebrow ? 'mt-4' : '',
              isDark ? 'text-paper' : 'text-ink',
            ].join(' ')}
          >
            {heading}
          </Heading>
        ) : null}
        {intro ? (
          <p
            className={[
              'mt-5 max-w-prose text-body-lg',
              isDark ? 'text-paper/75' : 'text-ink-soft',
            ].join(' ')}
          >
            {intro}
          </p>
        ) : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}

export interface BlockImageProps {
  image: MediaImage | null | undefined;
  /** Sizes hint. Getting this right is most of image performance. */
  sizes: string;
  aspectRatio?: string;
  priority?: boolean;
  className?: string;
  /** Per-use alt override; falls back to the asset's own alt text. */
  alt?: string;
  reveal?: boolean;
}

const ASPECT_CLASSES: Record<string, string> = {
  '21:9': 'aspect-cinematic',
  '16:9': 'aspect-video',
  '4:3': 'aspect-[4/3]',
  '3:2': 'aspect-editorial',
  '1:1': 'aspect-square',
  '4:5': 'aspect-portrait',
};

/**
 * An image inside a block.
 *
 * Honours the editor's focal point, so a portrait cropped to a wide banner keeps
 * the subject's face in frame rather than centring blindly. Falls back to a
 * labelled placeholder rather than a broken image when no asset is set.
 */
export function BlockImage({
  image,
  sizes,
  aspectRatio = '3:2',
  priority = false,
  className,
  alt,
  reveal = true,
}: BlockImageProps) {
  const aspectClass = ASPECT_CLASSES[aspectRatio] ?? 'aspect-editorial';

  if (!image) {
    return (
      <div
        className={[aspectClass, 'flex items-center justify-center bg-paper-sunken', className ?? ''].join(' ')}
        role="img"
        aria-label="Image not yet available"
      >
        <span className="text-body-xs uppercase tracking-widest text-ink-faint">Image pending</span>
      </div>
    );
  }

  const url = mediaUrl(image.storageKey);
  if (!url) return null;

  return (
    <div
      className={[aspectClass, 'relative overflow-hidden bg-paper-sunken', className ?? ''].join(' ')}
      style={image.placeholderColor ? { backgroundColor: image.placeholderColor } : undefined}
    >
      <Image
        src={url}
        alt={alt ?? image.altText ?? ''}
        fill
        sizes={sizes}
        priority={priority}
        className={['object-cover', reveal && !priority ? 'animate-image-reveal' : ''].join(' ')}
        style={{ objectPosition: `${image.focalX * 100}% ${image.focalY * 100}%` }}
        {...(image.blurDataUrl ? { placeholder: 'blur' as const, blurDataURL: image.blurDataUrl } : {})}
      />
    </div>
  );
}

/** Caption and credit rendered beneath an image. */
export function ImageCaption({ image, tone = 'light' }: { image: MediaImage | null | undefined; tone?: Tone }) {
  if (!image?.caption && !image?.credit) return null;
  const isDark = tone === 'dark';

  return (
    <figcaption className={['mt-3 text-body-xs', isDark ? 'text-paper/55' : 'text-ink-faint'].join(' ')}>
      {image.caption}
      {image.caption && image.credit ? ' · ' : ''}
      {image.credit ? <span className="italic">{image.credit}</span> : null}
    </figcaption>
  );
}

export interface ResolvedLink {
  label: string;
  href: string;
  opensInNewTab: boolean;
  isExternal: boolean;
}

/**
 * Resolve a block link reference to an href.
 *
 * Internal links carry a page id; the renderer converts it to a path at request
 * time. A link whose page no longer exists resolves to null and is not rendered,
 * which is preferable to shipping a dead link.
 */
export function resolveLink(
  link: { label?: string; pageId?: string; externalUrl?: string; opensInNewTab?: boolean } | undefined | null,
  locale: Locale,
  pathById: Map<string, string>,
): ResolvedLink | null {
  if (!link?.label) return null;

  if (link.externalUrl) {
    return { label: link.label, href: link.externalUrl, opensInNewTab: link.opensInNewTab ?? true, isExternal: true };
  }

  if (link.pageId) {
    const path = pathById.get(link.pageId);
    if (!path) return null;
    return { label: link.label, href: `/${locale}${path}`, opensInNewTab: false, isExternal: false };
  }

  return null;
}

export type ButtonVariant = 'primary' | 'secondary' | 'ghost';

const BUTTON_CLASSES: Record<ButtonVariant, Record<'light' | 'dark', string>> = {
  primary: {
    light: 'bg-ink text-paper hover:bg-ink-soft',
    dark: 'bg-paper text-ink hover:bg-paper-sunken',
  },
  secondary: {
    light: 'border border-ink text-ink hover:bg-ink hover:text-paper',
    dark: 'border border-paper/40 text-paper hover:bg-paper hover:text-ink',
  },
  ghost: {
    light: 'text-ink hover:text-brand-deep',
    dark: 'text-paper hover:text-brand',
  },
};

export function ActionLink({
  link,
  variant = 'primary',
  tone = 'light',
}: {
  link: ResolvedLink;
  variant?: ButtonVariant;
  tone?: Tone;
}) {
  const surface = tone === 'dark' || tone === 'accent' ? 'dark' : 'light';
  const isGhost = variant === 'ghost';

  const className = [
    'inline-flex items-center gap-2 text-body-sm font-semibold no-underline',
    'transition-colors duration-quick ease-crisp',
    isGhost ? '' : 'rounded px-6 py-3.5',
    BUTTON_CLASSES[variant][surface],
  ].join(' ');

  const content = (
    <>
      {link.label}
      <svg width="13" height="10" viewBox="0 0 14 10" fill="none" aria-hidden="true" className="rtl:rotate-180">
        <path d="M9 1l4 4-4 4M13 5H1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      {link.isExternal ? <span className="sr-only"> (opens in a new tab)</span> : null}
    </>
  );

  return link.isExternal ? (
    <a href={link.href} target={link.opensInNewTab ? '_blank' : undefined} rel="noopener noreferrer" className={className}>
      {content}
    </a>
  ) : (
    <Link href={link.href} className={className}>
      {content}
    </Link>
  );
}

/**
 * Marks a value as unapproved demo content.
 *
 * Visible by design: an unlabelled placeholder statistic on a corporate site is
 * indistinguishable from a claim, and this platform must never be the reason a
 * number nobody approved appears to be official.
 */
export function PlaceholderBadge({ tone = 'light' }: { tone?: Tone }) {
  const isDark = tone === 'dark' || tone === 'accent';
  return (
    <span
      className={[
        'ms-2 inline-flex items-center rounded-sm px-1.5 py-0.5 align-middle',
        'text-[0.625rem] font-semibold uppercase tracking-wider',
        isDark ? 'bg-paper/15 text-paper/70' : 'bg-ink/8 text-ink-muted',
      ].join(' ')}
      title="Placeholder value — awaiting approved corporate data"
    >
      Placeholder
    </span>
  );
}

/** Sanitised editor HTML. The API sanitises on write, so this is already safe. */
export function RichText({ html, className }: { html: string; className?: string }) {
  return (
    <div
      className={['rich-text', className ?? ''].join(' ')}
      // eslint-disable-next-line react/no-danger
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
