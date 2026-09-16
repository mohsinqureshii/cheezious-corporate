'use client';

import type { Locale } from '@cheezious/config';
import Image from 'next/image';
import Link from 'next/link';
import { useEffect, useRef } from 'react';

import { mediaUrl } from '@/lib/urls';
import type { NavigationItem } from '@/lib/content';

/**
 * The mega menu panel.
 *
 * Deliberately not "a giant list": each section is a set of labelled columns
 * whose links carry a short descriptor, plus an optional featured story. That
 * turns the menu into a map of the company rather than a directory, which is the
 * difference between a visitor finding "Food Safety" and giving up.
 *
 * Accessibility: the panel is hidden from assistive technology and removed from
 * the tab order when closed, so a keyboard user does not tab through six
 * invisible menus before reaching the page.
 */

export interface MegaMenuProps {
  id: string;
  locale: Locale;
  section: NavigationItem;
  isOpen: boolean;
  onMouseEnter: () => void;
  onMouseLeave: () => void;
  onClose: () => void;
}

export function MegaMenu({ id, locale, section, isOpen, onMouseEnter, onMouseLeave, onClose }: MegaMenuProps) {
  const panelRef = useRef<HTMLDivElement>(null);

  /**
   * Focus trapping while open: Tab cycles within the panel, Shift+Tab wraps
   * backwards, and Escape returns focus to the trigger. Without this, tabbing
   * out of an open menu leaves it visually open behind the page.
   */
  useEffect(() => {
    if (!isOpen || !panelRef.current) return;
    const panel = panelRef.current;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Tab') return;

      const focusable = panel.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])',
      );
      if (focusable.length === 0) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      // Tabbing past the last item closes the menu and continues into the page,
      // which is what a keyboard user expects rather than being held captive.
      if (!event.shiftKey && document.activeElement === last) onClose();
      if (event.shiftKey && document.activeElement === first) onClose();
    };

    panel.addEventListener('keydown', onKeyDown);
    return () => panel.removeEventListener('keydown', onKeyDown);
  }, [isOpen, onClose]);

  const columns = section.children.filter((child) => child.children.length > 0 || child.kind === 'GROUP');
  const directLinks = section.children.filter((child) => child.children.length === 0 && child.kind !== 'GROUP');
  const featured = section.featuredStory;
  const featuredImage = featured?.heroImage ?? section.featuredImage;

  return (
    <div
      ref={panelRef}
      id={id}
      // `hidden` rather than opacity alone: a visually-hidden-but-present panel
      // is still reachable by screen readers and by Tab.
      hidden={!isOpen}
      className={[
        'absolute inset-x-0 top-full border-b border-ink-line bg-paper-raised shadow-menu',
        isOpen ? 'animate-menu-in' : '',
      ].join(' ')}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    >
      <div className="container-wide py-10 lg:py-12">
        <div className="grid grid-cols-12 gap-x-gutter gap-y-10">
          {/* Section heading ------------------------------------------------ */}
          <div className="col-span-12 lg:col-span-3">
            <p className="eyebrow">{section.label}</p>
            {section.page ? (
              <Link
                href={`/${locale}${section.page.path}`}
                className="mt-3 inline-flex items-baseline gap-2 text-heading-md text-ink no-underline
                           transition-colors duration-quick hover:text-brand-deep"
              >
                {section.descriptor ?? `Explore ${section.label.toLowerCase()}`}
                <svg width="14" height="10" viewBox="0 0 14 10" fill="none" aria-hidden="true" className="rtl:rotate-180">
                  <path d="M9 1l4 4-4 4M13 5H1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </Link>
            ) : null}
          </div>

          {/* Link columns --------------------------------------------------- */}
          <div
            className={[
              'col-span-12',
              featuredImage ? 'lg:col-span-6' : 'lg:col-span-9',
            ].join(' ')}
          >
            <div
              className={[
                'grid gap-x-gutter gap-y-8',
                columns.length > 2 ? 'sm:grid-cols-2 lg:grid-cols-3' : 'sm:grid-cols-2',
              ].join(' ')}
            >
              {columns.map((column) => (
                <div key={column.id}>
                  <p className="text-body-xs font-semibold uppercase tracking-wider text-ink-faint">
                    {column.label}
                  </p>
                  <ul className="mt-4 space-y-3">
                    {column.children.map((item) => (
                      <li key={item.id}>
                        <MegaMenuLink locale={locale} item={item} />
                      </li>
                    ))}
                  </ul>
                </div>
              ))}

              {directLinks.length > 0 ? (
                <div>
                  <ul className="space-y-3">
                    {directLinks.map((item) => (
                      <li key={item.id}>
                        <MegaMenuLink locale={locale} item={item} />
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </div>
          </div>

          {/* Featured content ----------------------------------------------- */}
          {featuredImage ? (
            <div className="col-span-12 lg:col-span-3">
              <Link
                href={
                  featured
                    ? `/${locale}/company/newsroom/stories/${featured.slug}`
                    : `/${locale}${section.page?.path ?? ''}`
                }
                className="group block no-underline"
              >
                <div className="relative aspect-editorial overflow-hidden bg-paper-sunken">
                  <Image
                    src={mediaUrl(featuredImage.storageKey) ?? ''}
                    alt={featuredImage.altText ?? ''}
                    fill
                    sizes="(max-width: 1024px) 100vw, 320px"
                    className="object-cover transition-transform duration-slow ease-editorial group-hover:scale-[1.03]"
                    {...(featuredImage.blurDataUrl
                      ? { placeholder: 'blur' as const, blurDataURL: featuredImage.blurDataUrl }
                      : {})}
                  />
                </div>
                <p className="eyebrow mt-4">{section.featuredEyebrow ?? 'Featured'}</p>
                <p className="mt-2 text-heading-sm text-ink transition-colors duration-quick group-hover:text-brand-deep">
                  {section.featuredHeadline ?? featured?.title}
                </p>
                {featured?.excerpt ? (
                  <p className="mt-2 line-clamp-2 text-body-sm text-ink-muted">{featured.excerpt}</p>
                ) : null}
              </Link>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function MegaMenuLink({ locale, item }: { locale: Locale; item: NavigationItem }) {
  const href = item.page ? `/${locale}${item.page.path}` : (item.externalUrl ?? '#');
  const isExternal = Boolean(item.externalUrl);

  const className = [
    'group block no-underline',
    item.isCallToAction ? 'font-semibold text-ink' : 'text-ink-soft',
  ].join(' ');

  const content = (
    <>
      <span
        className={[
          'inline-flex items-center gap-1.5 text-body-sm transition-colors duration-quick',
          item.isCallToAction ? 'text-ink group-hover:text-brand-deep' : 'group-hover:text-ink',
        ].join(' ')}
      >
        {item.label}
        {item.isCallToAction ? (
          <svg width="12" height="9" viewBox="0 0 12 9" fill="none" aria-hidden="true" className="rtl:rotate-180">
            <path d="M7.5 1L11 4.5 7.5 8M11 4.5H1" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        ) : null}
        {isExternal ? (
          <svg width="10" height="10" viewBox="0 0 11 11" fill="none" aria-hidden="true">
            <path d="M2 9L9 2M9 2H4M9 2v5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        ) : null}
      </span>
      {item.descriptor ? (
        <span className="mt-0.5 block text-body-xs text-ink-faint">{item.descriptor}</span>
      ) : null}
    </>
  );

  return isExternal ? (
    <a href={href} target={item.opensInNewTab ? '_blank' : undefined} rel="noopener noreferrer" className={className}>
      {content}
    </a>
  ) : (
    <Link href={href} className={className}>
      {content}
    </Link>
  );
}
