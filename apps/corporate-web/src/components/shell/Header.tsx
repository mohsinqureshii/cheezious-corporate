'use client';

import { LOCALE_META, type Locale } from '@cheezious/config';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';

import type { NavigationItem } from '@/lib/content';

import { MegaMenu } from './MegaMenu';
import { MobileNavigation } from './MobileNavigation';

/**
 * The corporate header.
 *
 * Behaviours that matter:
 *   • Over a dark hero it starts transparent and becomes solid on scroll, so the
 *     hero reads full-bleed without the header ever sitting illegibly over it.
 *   • The mega menu opens on hover *and* on focus, closes on Escape and on
 *     outside click, and its trigger carries the correct ARIA state — so it is
 *     fully operable from the keyboard rather than being a mouse-only flourish.
 *   • A close is delayed slightly so that moving the pointer diagonally from a
 *     trigger into the panel does not dismiss the menu mid-gesture.
 */

export interface HeaderProps {
  locale: Locale;
  primary: NavigationItem[];
  utility: NavigationItem[];
  /** Set by pages whose hero is dark and full-bleed. */
  overlay?: boolean;
  consumerSiteUrl: string;
  labels: {
    skipToContent: string;
    openMenu: string;
    closeMenu: string;
    search: string;
    orderNow: string;
    corporate: string;
  };
}

export function Header({
  locale,
  primary,
  utility,
  overlay = false,
  consumerSiteUrl,
  labels,
}: HeaderProps) {
  const pathname = usePathname();
  const [openSection, setOpenSection] = useState<string | null>(null);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const headerRef = useRef<HTMLElement>(null);

  // Solid background once the hero is behind us. Passive listener so scrolling
  // is never blocked on this work.
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // Navigating away must close the menu; otherwise it hangs open over the new page.
  useEffect(() => {
    setOpenSection(null);
    setMobileOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!openSection) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpenSection(null);
    };
    const onPointerDown = (event: PointerEvent) => {
      if (!headerRef.current?.contains(event.target as Node)) setOpenSection(null);
    };

    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('pointerdown', onPointerDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.removeEventListener('pointerdown', onPointerDown);
    };
  }, [openSection]);

  const cancelClose = useCallback(() => {
    if (closeTimer.current) {
      clearTimeout(closeTimer.current);
      closeTimer.current = null;
    }
  }, []);

  const scheduleClose = useCallback(() => {
    cancelClose();
    // Long enough to cross the gap between trigger and panel, short enough that
    // the menu never feels stuck open.
    closeTimer.current = setTimeout(() => setOpenSection(null), 180);
  }, [cancelClose]);

  useEffect(() => cancelClose, [cancelClose]);

  const isTransparent = overlay && !scrolled && !openSection;
  const otherLocale: Locale = locale === 'en' ? 'ur' : 'en';
  const otherLocalePath = pathname.replace(/^\/(en|ur)/, `/${otherLocale}`);

  return (
    <>
      <a href="#main" className="skip-link">
        {labels.skipToContent}
      </a>

      <header
        ref={headerRef}
        className={[
          'fixed inset-x-0 top-0 z-header transition-[background-color,border-color,box-shadow] duration-300 ease-crisp',
          isTransparent
            ? 'border-b border-transparent bg-transparent'
            : 'border-b border-ink-line bg-paper/95 backdrop-blur-md supports-[backdrop-filter]:bg-paper/80',
        ].join(' ')}
        data-overlay={isTransparent ? 'true' : 'false'}
      >
        <div className="container-wide">
          <div className="flex h-[var(--header-height)] items-center justify-between gap-6">
            {/* Identity ----------------------------------------------------- */}
            <Link
              href={`/${locale}/company`}
              className="group flex shrink-0 items-baseline gap-2 no-underline"
              aria-label={`Cheezious ${labels.corporate}`}
            >
              <span
                className={[
                  'text-heading-md font-bold tracking-tight transition-colors duration-quick',
                  isTransparent ? 'text-paper' : 'text-ink',
                ].join(' ')}
              >
                Cheezious
              </span>
              <span
                className={[
                  'hidden text-eyebrow uppercase transition-colors duration-quick sm:inline',
                  isTransparent ? 'text-paper/70' : 'text-ink-muted',
                ].join(' ')}
              >
                {labels.corporate}
              </span>
            </Link>

            {/* Primary navigation ------------------------------------------- */}
            <nav
              className="hidden items-center lg:flex"
              aria-label="Primary"
              onMouseLeave={scheduleClose}
            >
              <ul className="flex items-center gap-1">
                {primary.map((section) => {
                  const isOpen = openSection === section.id;
                  const hasPanel = section.children.length > 0;
                  const href = section.page ? `/${locale}${section.page.path}` : undefined;

                  return (
                    <li key={section.id}>
                      {hasPanel ? (
                        <button
                          type="button"
                          className={[
                            'flex items-center gap-1.5 rounded px-3 py-2 text-body-sm font-medium',
                            'transition-colors duration-quick',
                            isTransparent
                              ? 'text-paper/90 hover:text-paper'
                              : 'text-ink-soft hover:text-ink',
                            isOpen && !isTransparent ? 'text-ink' : '',
                          ].join(' ')}
                          aria-expanded={isOpen}
                          aria-haspopup="true"
                          aria-controls={`megamenu-${section.id}`}
                          onMouseEnter={() => {
                            cancelClose();
                            setOpenSection(section.id);
                          }}
                          onFocus={() => {
                            cancelClose();
                            setOpenSection(section.id);
                          }}
                          onClick={() => setOpenSection(isOpen ? null : section.id)}
                        >
                          {section.label}
                          <svg
                            width="10"
                            height="6"
                            viewBox="0 0 10 6"
                            aria-hidden="true"
                            className={[
                              'transition-transform duration-quick',
                              isOpen ? 'rotate-180' : '',
                            ].join(' ')}
                          >
                            <path
                              d="M1 1l4 4 4-4"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="1.5"
                            />
                          </svg>
                        </button>
                      ) : (
                        <Link
                          href={href ?? '#'}
                          className={[
                            'block rounded px-3 py-2 text-body-sm font-medium no-underline transition-colors duration-quick',
                            isTransparent
                              ? 'text-paper/90 hover:text-paper'
                              : 'text-ink-soft hover:text-ink',
                          ].join(' ')}
                        >
                          {section.label}
                        </Link>
                      )}
                    </li>
                  );
                })}
              </ul>
            </nav>

            {/* Utilities ---------------------------------------------------- */}
            <div className="flex shrink-0 items-center gap-1 sm:gap-2">
              <Link
                href={`/${locale}/search`}
                className={[
                  'rounded p-2 transition-colors duration-quick',
                  isTransparent ? 'text-paper/90 hover:text-paper' : 'text-ink-soft hover:text-ink',
                ].join(' ')}
                aria-label={labels.search}
              >
                <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
                  <circle cx="8" cy="8" r="5.5" stroke="currentColor" strokeWidth="1.5" />
                  <path
                    d="M12.5 12.5L16 16"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                  />
                </svg>
              </Link>

              <Link
                href={otherLocalePath}
                lang={otherLocale}
                className={[
                  'hidden rounded px-2.5 py-2 text-body-sm font-medium no-underline transition-colors duration-quick sm:block',
                  isTransparent ? 'text-paper/90 hover:text-paper' : 'text-ink-soft hover:text-ink',
                  otherLocale === 'ur' ? 'font-urdu' : '',
                ].join(' ')}
                hrefLang={otherLocale}
              >
                {LOCALE_META[otherLocale].nativeLabel}
              </Link>

              {/*
                The one place the corporate site hands a visitor back to the
                consumer experience. Marked as leaving, and opened in a new tab,
                so someone researching the company does not lose their place.
              */}
              <a
                href={consumerSiteUrl}
                target="_blank"
                rel="noopener noreferrer"
                className={[
                  'hidden items-center gap-1.5 rounded px-4 py-2.5 text-body-sm font-semibold no-underline',
                  'transition-colors duration-quick md:inline-flex',
                  isTransparent
                    ? 'bg-paper/95 text-ink hover:bg-paper'
                    : 'bg-ink text-paper hover:bg-ink-soft',
                ].join(' ')}
              >
                {labels.orderNow}
                <svg width="11" height="11" viewBox="0 0 11 11" fill="none" aria-hidden="true">
                  <path
                    d="M2 9L9 2M9 2H4M9 2v5"
                    stroke="currentColor"
                    strokeWidth="1.4"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
                <span className="sr-only"> (opens the Cheezious ordering site in a new tab)</span>
              </a>

              <button
                type="button"
                className={[
                  'rounded p-2 lg:hidden',
                  isTransparent ? 'text-paper' : 'text-ink',
                ].join(' ')}
                aria-expanded={mobileOpen}
                aria-controls="mobile-navigation"
                onClick={() => setMobileOpen((open) => !open)}
              >
                <span className="sr-only">{mobileOpen ? labels.closeMenu : labels.openMenu}</span>
                <svg width="22" height="22" viewBox="0 0 22 22" fill="none" aria-hidden="true">
                  {mobileOpen ? (
                    <path
                      d="M5 5l12 12M17 5L5 17"
                      stroke="currentColor"
                      strokeWidth="1.6"
                      strokeLinecap="round"
                    />
                  ) : (
                    <>
                      <path
                        d="M3 6h16"
                        stroke="currentColor"
                        strokeWidth="1.6"
                        strokeLinecap="round"
                      />
                      <path
                        d="M3 11h16"
                        stroke="currentColor"
                        strokeWidth="1.6"
                        strokeLinecap="round"
                      />
                      <path
                        d="M3 16h16"
                        stroke="currentColor"
                        strokeWidth="1.6"
                        strokeLinecap="round"
                      />
                    </>
                  )}
                </svg>
              </button>
            </div>
          </div>
        </div>

        {/* Mega menu panels ----------------------------------------------- */}
        {primary.map((section) =>
          section.children.length > 0 ? (
            <MegaMenu
              key={section.id}
              id={`megamenu-${section.id}`}
              locale={locale}
              section={section}
              isOpen={openSection === section.id}
              onMouseEnter={cancelClose}
              onMouseLeave={scheduleClose}
              onClose={() => setOpenSection(null)}
            />
          ) : null,
        )}
      </header>

      <MobileNavigation
        id="mobile-navigation"
        locale={locale}
        isOpen={mobileOpen}
        primary={primary}
        utility={utility}
        consumerSiteUrl={consumerSiteUrl}
        labels={labels}
        onClose={() => setMobileOpen(false)}
      />
    </>
  );
}
