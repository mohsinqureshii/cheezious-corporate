'use client';

import { LOCALE_META, type Locale } from '@cheezious/config';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';

/**
 * The language switch.
 *
 * Takes the reader to the same page in the other language where that page has
 * been translated, and to the other language's home where it has not — which is
 * the honest outcome, and better than a 404 or a switch that silently does
 * nothing.
 *
 * The translated address is read from the page's own hreflang link, which the
 * metadata layer already emits for every route. That keeps one source of truth:
 * if a page declares an alternate to search engines, the switch offers it, and
 * if it does not, neither does the switch.
 *
 * Rendered as a link to the section home on the server, then upgraded once the
 * page's alternates can be read — so it works without JavaScript and simply gets
 * more precise with it.
 */

export interface LocaleSwitchProps {
  locale: Locale;
  otherLocale: Locale;
  /** Where to go when the current page has no counterpart. */
  fallbackPath: string;
}

export function LocaleSwitch({ locale, otherLocale, fallbackPath }: LocaleSwitchProps) {
  const pathname = usePathname();
  const [href, setHref] = useState(fallbackPath);

  useEffect(() => {
    const alternate = document.querySelector<HTMLLinkElement>(
      `link[rel="alternate"][hreflang^="${otherLocale}"]`,
    );

    if (!alternate?.href) {
      setHref(fallbackPath);
      return;
    }

    try {
      const url = new URL(alternate.href);
      // Same-origin only: an alternate pointing elsewhere is not a language
      // switch, whatever it claims to be.
      setHref(url.origin === window.location.origin ? `${url.pathname}${url.search}` : fallbackPath);
    } catch {
      setHref(fallbackPath);
    }
  }, [otherLocale, fallbackPath, pathname]);

  return (
    <div className="flex items-center gap-2 text-body-xs">
      <span className="font-semibold text-ink">{LOCALE_META[locale].nativeLabel}</span>
      <Link
        href={href}
        lang={otherLocale}
        hrefLang={otherLocale}
        className={[
          'text-ink-muted no-underline transition-colors duration-quick hover:text-ink',
          otherLocale === 'ur' ? 'font-urdu' : '',
        ].join(' ')}
      >
        {LOCALE_META[otherLocale].nativeLabel}
        <span className="sr-only"> — view this site in {LOCALE_META[otherLocale].label}</span>
      </Link>
    </div>
  );
}
