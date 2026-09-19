import { DEFAULT_LOCALE, type Locale } from '@cheezious/config';

/**
 * URL helpers.
 *
 * Deliberately separate from `api.ts`, which is server-only: these are pure
 * string functions that client components (the header, the mega menu) also need,
 * and importing them must not drag the server-side fetch client into the browser
 * bundle.
 */

/**
 * The origin the browser should call the API on.
 *
 * Empty when the platform is served from one process: the API is then on the
 * same origin as the page, so a relative path is both correct and immune to the
 * domain changing. A separate API service sets the variable to its own origin.
 */
export function apiOrigin(): string {
  const configured = process.env.NEXT_PUBLIC_API_URL;
  if (configured !== undefined) return configured.replace(/\/+$/, '');
  return 'http://localhost:4000';
}

/** Resolve a stored media key to a URL the browser can load. */
export function mediaUrl(storageKey: string | null | undefined): string | null {
  if (!storageKey) return null;
  const base = process.env.NEXT_PUBLIC_MEDIA_URL ?? `${apiOrigin()}/files`;
  return `${base.replace(/\/+$/, '')}/${storageKey.replace(/^\/+/, '')}`;
}

/** Build a locale-prefixed site path. */
export function localePath(locale: Locale, path: string): string {
  const normalised = path.startsWith('/') ? path : `/${path}`;
  return `/${locale}${normalised === '/' ? '' : normalised}`;
}

/** Strip the locale prefix from an incoming path. */
export function stripLocale(path: string): { locale: Locale; path: string } {
  const match = /^\/(en|ur)(\/.*)?$/.exec(path);
  if (!match) return { locale: DEFAULT_LOCALE, path: path || '/' };
  return { locale: match[1] as Locale, path: match[2] || '/' };
}

/** Swap the locale prefix on the current path, for the language switcher. */
export function switchLocalePath(path: string, target: Locale): string {
  return path.replace(/^\/(en|ur)/, `/${target}`);
}
