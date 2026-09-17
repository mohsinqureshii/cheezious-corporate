import type { Locale } from '@cheezious/config';
import { formatDate } from '@cheezious/utilities';
import Link from 'next/link';
import type { ReactNode } from 'react';

import { BlockImage, ImageCaption, RichText, Section } from '@/components/blocks/primitives';
import type { MediaImage } from '@/lib/content';

/**
 * The article page.
 *
 * Shared by stories, news, press releases, employee stories and impact stories,
 * because they are the same object to a reader: a headline, a date, a lede, a
 * body, and something to read next.
 *
 * The measure is deliberately narrow — around 68 characters — and the body type
 * is a step larger than the interface type. A corporate newsroom is read, not
 * scanned, and the most common failure of one is a full-width column of 16px
 * text that nobody finishes.
 */

export interface ArticleLayoutProps {
  locale: Locale;
  eyebrow?: string | null;
  headline: string;
  standfirst?: string | null;
  /** Rendered above the headline, e.g. "Islamabad, 4 March 2026". */
  dateline?: string | null;
  publishedAt?: string | null;
  updatedAt?: string | null;
  byline?: string | null;
  readingMinutes?: number | null;
  heroImage?: MediaImage | null;
  /** Sanitised on the way into the database; never raw input. */
  body?: string | null;
  breadcrumb: Array<{ label: string; href?: string }>;
  /** Anything the article itself adds — attachments, related people, downloads. */
  children?: ReactNode;
  /** Shown after the body, under its own heading. */
  related?: ReactNode;
}

export function ArticleLayout({
  locale,
  eyebrow,
  headline,
  standfirst,
  dateline,
  publishedAt,
  updatedAt,
  byline,
  readingMinutes,
  heroImage,
  body,
  breadcrumb,
  children,
  related,
}: ArticleLayoutProps) {
  // Only worth showing when the article has genuinely been revised since it was
  // published; otherwise it is noise on every page.
  const revised =
    publishedAt && updatedAt && new Date(updatedAt).getTime() - new Date(publishedAt).getTime() > 86_400_000;

  return (
    <article>
      <Section width="narrow" spacing="compact">
        <nav aria-label="Breadcrumb" className="mb-8">
          <ol className="flex flex-wrap items-center gap-2 text-body-xs uppercase tracking-widest text-ink-faint">
            {breadcrumb.map((crumb, index) => (
              <li key={`${crumb.label}-${index}`} className="flex items-center gap-2">
                {crumb.href ? (
                  <Link href={crumb.href} className="no-underline hover:text-ink">
                    {crumb.label}
                  </Link>
                ) : (
                  <span aria-current="page">{crumb.label}</span>
                )}
                {index < breadcrumb.length - 1 ? <span aria-hidden="true">/</span> : null}
              </li>
            ))}
          </ol>
        </nav>

        {eyebrow ? (
          <p className="text-body-xs uppercase tracking-widest text-accent-ink">{eyebrow}</p>
        ) : null}

        <h1 className="mt-4 text-display-sm text-ink md:text-display-md">{headline}</h1>

        {standfirst ? <p className="mt-6 text-body-lg text-ink-muted">{standfirst}</p> : null}

        <p className="mt-8 flex flex-wrap items-center gap-x-4 gap-y-1 text-body-xs text-ink-faint">
          {dateline ? <span>{dateline}</span> : null}
          {publishedAt ? (
            <time dateTime={publishedAt}>{formatDate(publishedAt, locale, { dateStyle: 'long' })}</time>
          ) : null}
          {byline ? <span>By {byline}</span> : null}
          {readingMinutes ? <span>{readingMinutes} min read</span> : null}
          {revised && updatedAt ? (
            <span>
              Updated <time dateTime={updatedAt}>{formatDate(updatedAt, locale, { dateStyle: 'long' })}</time>
            </span>
          ) : null}
        </p>
      </Section>

      {heroImage ? (
        <Section width="wide" spacing="compact">
          <figure>
            <BlockImage image={heroImage} sizes="(min-width: 1280px) 1120px, 100vw" aspectRatio="21:9" priority />
            <ImageCaption image={heroImage} />
          </figure>
        </Section>
      ) : null}

      {body ? (
        <Section width="narrow" spacing="standard">
          <RichText html={body} className="prose-editorial" />
        </Section>
      ) : null}

      {children}

      {related}
    </article>
  );
}
