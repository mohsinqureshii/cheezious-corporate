import { isLocale, LOCALE_META, LOCALES, type Locale } from '@cheezious/config';
import { notFound } from 'next/navigation';

import { Footer } from '@/components/shell/Footer';
import { Header } from '@/components/shell/Header';
import {
  getFooter,
  getNavigation,
  getSettings,
  type FooterData,
  type NavigationGroup,
} from '@/lib/content';

/**
 * Locale layout.
 *
 * Owns `lang` and `dir`, which is what makes Urdu genuinely right-to-left rather
 * than English text mirrored. Navigation, footer and settings are fetched here
 * once per request and cached, so the 100+ content pages beneath do not each
 * re-fetch the mega menu.
 */

export function generateStaticParams() {
  return LOCALES.map((locale) => ({ locale }));
}

const LABELS: Record<
  Locale,
  {
    skipToContent: string;
    openMenu: string;
    closeMenu: string;
    search: string;
    orderNow: string;
    corporate: string;
    backToTop: string;
    followUs: string;
    consumerNote: string;
  }
> = {
  en: {
    skipToContent: 'Skip to content',
    openMenu: 'Open menu',
    closeMenu: 'Close menu',
    search: 'Search',
    orderNow: 'Order Cheezious',
    corporate: 'Corporate',
    backToTop: 'Back to top',
    followUs: 'Follow us',
    consumerNote: 'Looking to order?',
  },
  ur: {
    skipToContent: 'مواد پر جائیں',
    openMenu: 'مینو کھولیں',
    closeMenu: 'مینو بند کریں',
    search: 'تلاش',
    orderNow: 'چیزیس آرڈر کریں',
    corporate: 'کارپوریٹ',
    backToTop: 'اوپر جائیں',
    followUs: 'ہمیں فالو کریں',
    consumerNote: 'آرڈر کرنا چاہتے ہیں؟',
  },
};

/**
 * Fetch one piece of site furniture, falling back rather than failing the page.
 *
 * Returns `fallback` when the call throws, after logging what went wrong and
 * which call it was. Nothing here is worth a 500.
 */
async function resilient<T>(what: string, load: () => Promise<T>, fallback: T): Promise<T> {
  try {
    return await load();
  } catch (error) {
    console.error(
      `[layout] could not load ${what}; rendering without it.`,
      error instanceof Error ? error.message : error,
    );
    return fallback;
  }
}

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale: localeParam } = await params;
  if (!isLocale(localeParam)) notFound();
  const locale = localeParam;

  // Fetched concurrently: three sequential round trips on every page would be
  // three round trips too many.
  //
  // Each one degrades on its own rather than throwing. This is the root layout,
  // so an unhandled failure here is not a missing menu — it is a 500 on every
  // page of the site, including the pages that would have rendered perfectly
  // well without a footer. A site with no navigation is bad; a site that is
  // entirely down because the navigation endpoint hiccuped is worse.
  //
  // The failure is logged rather than swallowed: the operator needs to know the
  // furniture is missing, and which call could not be made.
  const [navigations, footer, settings] = await Promise.all([
    resilient('navigation', () => getNavigation(locale), [] as NavigationGroup[]),
    resilient('footer', () => getFooter(locale), { footer: null, groups: [] } as FooterData),
    resilient('settings', () => getSettings(locale), {} as Record<string, unknown>),
  ]);

  const primary = navigations.find((nav) => nav.location === 'PRIMARY')?.items ?? [];
  const utility = navigations.find((nav) => nav.location === 'UTILITY')?.items ?? [];
  const consumerSiteUrl =
    (settings['consumer.orderUrl'] as string) ??
    process.env.NEXT_PUBLIC_CONSUMER_SITE_URL ??
    'https://cheezious.com';

  const meta = LOCALE_META[locale];
  const labels = LABELS[locale];

  return (
    /*
      `lang` and `dir` are set here rather than on <html> so the root layout can
      stay static and every content page can be prerendered. Both attributes are
      valid on any element: assistive technology announces Urdu correctly from
      this wrapper, and `dir="rtl"` flips the whole layout beneath it.

      The inline script mirrors them onto <html> before first paint, so the
      document element is also correct for anything that reads it there. It runs
      ahead of hydration and needs no JavaScript to be enabled for the wrapper
      itself to work — the script only improves an already-correct page.
    */
    <div lang={meta.htmlLang} dir={meta.dir} className="contents">
      <script
        dangerouslySetInnerHTML={{
          __html: `document.documentElement.lang=${JSON.stringify(meta.htmlLang)};document.documentElement.dir=${JSON.stringify(meta.dir)};`,
        }}
      />

      <Header
        locale={locale}
        primary={primary}
        utility={utility}
        consumerSiteUrl={consumerSiteUrl}
        labels={labels}
      />

      {/* tabIndex -1 so the skip link can move focus here. */}
      <main id="main" tabIndex={-1} className="focus:outline-none">
        {children}
      </main>

      <Footer locale={locale} data={footer} consumerSiteUrl={consumerSiteUrl} labels={labels} />
    </div>
  );
}
