import { DEFAULT_LOCALE, LOCALES, type Locale } from '@cheezious/config';
import { NextResponse, type NextRequest } from 'next/server';

import { resolveRequestOrigin } from '@/lib/origin';

/**
 * Locale routing.
 *
 * The corporate site is always served under a locale prefix. A request without
 * one is redirected rather than rendered, so there is never an unprefixed second
 * copy of the site competing with the real one for the same search terms.
 *
 * The visitor's `Accept-Language` is honoured on first arrival — an Urdu speaker
 * landing on the homepage gets the Urdu site — but a locale they have chosen
 * explicitly always wins, because guessing over someone's stated choice is worse
 * than not guessing at all.
 */

const LOCALE_COOKIE = 'cheezious_locale';

/** Paths that are not content and must not be locale-prefixed. */
const EXCLUDED = [
  '/api',
  '/_next',
  '/sitemap.xml',
  '/robots.txt',
  '/favicon.ico',
  '/manifest.webmanifest',
];

function hasLocalePrefix(pathname: string): boolean {
  return LOCALES.some((locale) => pathname === `/${locale}` || pathname.startsWith(`/${locale}/`));
}

/** Pick a locale from the cookie, then Accept-Language, then the default. */
function detectLocale(request: NextRequest): Locale {
  const fromCookie = request.cookies.get(LOCALE_COOKIE)?.value;
  if (fromCookie && LOCALES.includes(fromCookie as Locale)) return fromCookie as Locale;

  const header = request.headers.get('accept-language');
  if (header) {
    // Parse "ur-PK,ur;q=0.9,en;q=0.8" into a quality-ordered list.
    const preferences = header
      .split(',')
      .map((part) => {
        const [tag, quality] = part.trim().split(';q=');
        return { tag: (tag ?? '').toLowerCase(), quality: quality ? Number(quality) : 1 };
      })
      .filter((entry) => entry.tag)
      .sort((a, b) => b.quality - a.quality);

    for (const preference of preferences) {
      const base = preference.tag.split('-')[0] as Locale;
      if (LOCALES.includes(base)) return base;
    }
  }

  return DEFAULT_LOCALE;
}

export function middleware(request: NextRequest): NextResponse {
  const { pathname, search } = request.nextUrl;

  if (EXCLUDED.some((prefix) => pathname.startsWith(prefix))) return NextResponse.next();
  if (hasLocalePrefix(pathname)) return NextResponse.next();

  const locale = detectLocale(request);

  // The bare root goes to the corporate home, not to an empty locale root.
  const target = pathname === '/' ? `/${locale}/company` : `/${locale}${pathname}`;

  const origin = resolveRequestOrigin((name) => request.headers.get(name), {
    url: request.url,
    scheme: request.nextUrl.protocol.replace(':', ''),
  });

  const response = NextResponse.redirect(new URL(`${target}${search}`, origin));

  // Remember the resolved locale so a returning visitor is not re-detected on
  // every navigation.
  response.cookies.set(LOCALE_COOKIE, locale, {
    path: '/',
    maxAge: 60 * 60 * 24 * 365,
    sameSite: 'lax',
  });

  return response;
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt).*)'],
};
