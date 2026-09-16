'use client';

import { LOCALE_META, type Locale } from '@cheezious/config';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';

import type { NavigationItem } from '@/lib/content';

/**
 * Mobile navigation.
 *
 * Designed for a phone rather than shrunk down from the desktop mega menu — a
 * six-column panel squeezed into 390px is how corporate sites become unusable on
 * the device most people actually visit them from.
 *
 * Instead: a full-height sheet with one accordion per section, large touch
 * targets, and the section landing page always reachable as its own link so that
 * expanding a section is never the only way in.
 */

export interface MobileNavigationProps {
  id: string;
  locale: Locale;
  isOpen: boolean;
  primary: NavigationItem[];
  utility: NavigationItem[];
  consumerSiteUrl: string;
  labels: { orderNow: string; search: string; closeMenu: string; corporate: string };
  onClose: () => void;
}

export function MobileNavigation({
  id,
  locale,
  isOpen,
  primary,
  consumerSiteUrl,
  labels,
  onClose,
}: MobileNavigationProps) {
  const [expanded, setExpanded] = useState<string | null>(null);
  const pathname = usePathname();
  const sheetRef = useRef<HTMLDivElement>(null);
  const previouslyFocused = useRef<HTMLElement | null>(null);

  /**
   * While the sheet is open the page behind it must not scroll, and focus must
   * move into the sheet. On close, focus returns to whatever opened it.
   */
  useEffect(() => {
    if (!isOpen) return;

    previouslyFocused.current = document.activeElement as HTMLElement;
    const { overflow } = document.body.style;
    document.body.style.overflow = 'hidden';

    const firstLink = sheetRef.current?.querySelector<HTMLElement>('a, button');
    firstLink?.focus();

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKeyDown);

    return () => {
      document.body.style.overflow = overflow;
      document.removeEventListener('keydown', onKeyDown);
      previouslyFocused.current?.focus();
    };
  }, [isOpen, onClose]);

  const otherLocale: Locale = locale === 'en' ? 'ur' : 'en';
  const otherLocalePath = pathname.replace(/^\/(en|ur)/, `/${otherLocale}`);

  if (!isOpen) return null;

  return (
    <div
      id={id}
      className="fixed inset-0 z-overlay lg:hidden"
      role="dialog"
      aria-modal="true"
      aria-label="Site navigation"
    >
      <div
        className="absolute inset-0 bg-ink/40 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />

      <div
        ref={sheetRef}
        className="absolute inset-y-0 end-0 flex w-full max-w-md flex-col bg-paper shadow-dialog animate-menu-in"
      >
        <div className="flex h-[var(--header-height)] shrink-0 items-center justify-between border-b border-ink-line px-gutter">
          <span className="text-heading-sm font-bold text-ink">
            Cheezious <span className="text-eyebrow uppercase text-ink-muted">{labels.corporate}</span>
          </span>
          <button
            type="button"
            onClick={onClose}
            className="-me-2 rounded p-2 text-ink"
            aria-label={labels.closeMenu}
          >
            <svg width="22" height="22" viewBox="0 0 22 22" fill="none" aria-hidden="true">
              <path d="M5 5l12 12M17 5L5 17" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto overscroll-contain px-gutter py-6" aria-label="Primary">
          <ul className="divide-y divide-ink-line">
            {primary.map((section) => {
              const isExpanded = expanded === section.id;
              const hasChildren = section.children.length > 0;

              return (
                <li key={section.id} className="py-1">
                  <div className="flex items-stretch">
                    {/* The section landing page is always directly reachable. */}
                    {section.page ? (
                      <Link
                        href={`/${locale}${section.page.path}`}
                        className="flex-1 py-4 text-heading-sm text-ink no-underline"
                        onClick={onClose}
                      >
                        {section.label}
                      </Link>
                    ) : (
                      <span className="flex-1 py-4 text-heading-sm text-ink">{section.label}</span>
                    )}

                    {hasChildren ? (
                      <button
                        type="button"
                        className="-me-2 flex w-12 items-center justify-center rounded text-ink-muted"
                        aria-expanded={isExpanded}
                        aria-label={`${isExpanded ? 'Collapse' : 'Expand'} ${section.label}`}
                        onClick={() => setExpanded(isExpanded ? null : section.id)}
                      >
                        <svg
                          width="14"
                          height="8"
                          viewBox="0 0 14 8"
                          fill="none"
                          aria-hidden="true"
                          className={['transition-transform duration-quick', isExpanded ? 'rotate-180' : ''].join(' ')}
                        >
                          <path d="M1 1l6 6 6-6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
                        </svg>
                      </button>
                    ) : null}
                  </div>

                  {hasChildren && isExpanded ? (
                    <div className="pb-5">
                      {section.children.map((column) => (
                        <div key={column.id} className="mb-5 last:mb-0">
                          {column.children.length > 0 ? (
                            <p className="mb-2 text-body-xs font-semibold uppercase tracking-wider text-ink-faint">
                              {column.label}
                            </p>
                          ) : null}
                          <ul className="space-y-1">
                            {(column.children.length > 0 ? column.children : [column]).map((item) => {
                              const href = item.page
                                ? `/${locale}${item.page.path}`
                                : (item.externalUrl ?? '#');
                              return (
                                <li key={item.id}>
                                  <Link
                                    href={href}
                                    className={[
                                      // 44px minimum touch target.
                                      'flex min-h-[44px] items-center text-body-sm no-underline',
                                      item.isCallToAction ? 'font-semibold text-ink' : 'text-ink-soft',
                                    ].join(' ')}
                                    onClick={onClose}
                                  >
                                    {item.label}
                                  </Link>
                                </li>
                              );
                            })}
                          </ul>
                        </div>
                      ))}
                    </div>
                  ) : null}
                </li>
              );
            })}
          </ul>
        </nav>

        <div className="shrink-0 space-y-3 border-t border-ink-line px-gutter py-5">
          <div className="flex items-center gap-3">
            <Link
              href={`/${locale}/search`}
              onClick={onClose}
              className="flex flex-1 items-center justify-center gap-2 rounded border border-ink-line
                         px-4 py-3 text-body-sm font-medium text-ink no-underline"
            >
              <svg width="16" height="16" viewBox="0 0 18 18" fill="none" aria-hidden="true">
                <circle cx="8" cy="8" r="5.5" stroke="currentColor" strokeWidth="1.5" />
                <path d="M12.5 12.5L16 16" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
              {labels.search}
            </Link>
            <Link
              href={otherLocalePath}
              lang={otherLocale}
              hrefLang={otherLocale}
              onClick={onClose}
              className={[
                'rounded border border-ink-line px-4 py-3 text-body-sm font-medium text-ink no-underline',
                otherLocale === 'ur' ? 'font-urdu' : '',
              ].join(' ')}
            >
              {LOCALE_META[otherLocale].nativeLabel}
            </Link>
          </div>

          <a
            href={consumerSiteUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-2 rounded bg-ink px-4 py-3.5
                       text-body-sm font-semibold text-paper no-underline"
          >
            {labels.orderNow}
            <svg width="11" height="11" viewBox="0 0 11 11" fill="none" aria-hidden="true">
              <path d="M2 9L9 2M9 2H4M9 2v5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <span className="sr-only"> (opens the Cheezious ordering site in a new tab)</span>
          </a>
        </div>
      </div>
    </div>
  );
}
