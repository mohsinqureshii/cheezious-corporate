/** Platform-wide constants shared by the API, the CMS and the public site. */

export const LOCALES = ['en', 'ur'] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = 'en';

export const LOCALE_META: Record<
  Locale,
  { label: string; nativeLabel: string; dir: 'ltr' | 'rtl'; htmlLang: string }
> = {
  en: { label: 'English', nativeLabel: 'English', dir: 'ltr', htmlLang: 'en-PK' },
  ur: { label: 'Urdu', nativeLabel: 'اردو', dir: 'rtl', htmlLang: 'ur-PK' },
};

export function isLocale(value: unknown): value is Locale {
  return typeof value === 'string' && (LOCALES as readonly string[]).includes(value);
}

/** Organisation identity. Display values are CMS-managed; these are structural fallbacks. */
export const ORGANISATION = {
  legalName: 'Cheezious',
  displayName: 'Cheezious',
  corporateName: 'Cheezious Corporate',
  country: 'PK',
  countryName: 'Pakistan',
} as const;

export const PAGINATION = {
  defaultPageSize: 20,
  maxPageSize: 100,
  cmsDefaultPageSize: 25,
} as const;

export const CACHE_TAGS = {
  navigation: 'navigation',
  footer: 'footer',
  settings: 'settings',
  homepage: 'homepage',
  page: (id: string) => `page:${id}`,
  pathname: (path: string) => `path:${path}`,
  collection: (name: string) => `collection:${name}`,
  sitemap: 'sitemap',
  search: 'search',
} as const;

/** Content that the platform never invents. Seeded values carry this marker. */
export const DEMO_CONTENT_NOTICE =
  'Demo content — replace with approved corporate data before publication.';
