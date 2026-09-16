import { LOCALE_META, type Locale } from '@cheezious/config';
import Link from 'next/link';

import type { FooterData, NavigationItem } from '@/lib/content';

/**
 * The corporate footer.
 *
 * A serious corporate footer is a second navigation, not a legal afterthought:
 * for a site this deep it is often how someone reaches Governance or Resources.
 * Everything here — groups, legal links, social profiles, the copyright line —
 * comes from the CMS.
 */

export interface FooterProps {
  locale: Locale;
  data: FooterData;
  consumerSiteUrl: string;
  labels: {
    corporate: string;
    backToTop: string;
    orderNow: string;
    followUs: string;
    consumerNote: string;
  };
}

export function Footer({ locale, data, consumerSiteUrl, labels }: FooterProps) {
  const year = new Date().getFullYear();
  const copyright = (data.footer?.copyrightTemplate ?? 'Cheezious © {year}').replace('{year}', String(year));
  const otherLocale: Locale = locale === 'en' ? 'ur' : 'en';

  return (
    <footer className="mt-section border-t border-ink-line bg-paper-sunken" aria-labelledby="footer-heading">
      <h2 id="footer-heading" className="sr-only">
        Site footer
      </h2>

      <div className="container-wide py-section-compact">
        {/* Identity and navigation groups ---------------------------------- */}
        <div className="grid grid-cols-12 gap-x-gutter gap-y-12">
          <div className="col-span-12 lg:col-span-3">
            <Link href={`/${locale}/company`} className="inline-flex items-baseline gap-2 no-underline">
              <span className="text-heading-md font-bold tracking-tight text-ink">Cheezious</span>
              <span className="text-eyebrow uppercase text-ink-muted">{labels.corporate}</span>
            </Link>

            {data.footer?.note ? (
              <p className="mt-4 max-w-xs text-body-sm text-ink-muted">{data.footer.note}</p>
            ) : null}

            {/*
              The corporate site is not the place to order food. The link is
              offered once, clearly marked as leaving, rather than scattered.
            */}
            <div className="mt-6">
              <p className="text-body-xs text-ink-faint">{labels.consumerNote}</p>
              <a
                href={consumerSiteUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-2 inline-flex items-center gap-1.5 text-body-sm font-semibold text-ink
                           underline decoration-brand decoration-2 underline-offset-4
                           transition-colors duration-quick hover:text-brand-deep"
              >
                {labels.orderNow}
                <svg width="11" height="11" viewBox="0 0 11 11" fill="none" aria-hidden="true">
                  <path d="M2 9L9 2M9 2H4M9 2v5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                <span className="sr-only"> (opens in a new tab)</span>
              </a>
            </div>
          </div>

          <div className="col-span-12 lg:col-span-9">
            <nav aria-label="Footer">
              <div className="grid grid-cols-2 gap-x-gutter gap-y-10 sm:grid-cols-3 xl:grid-cols-6">
                {data.groups.map((group) => (
                  <FooterGroup key={group.id} locale={locale} group={group} />
                ))}
              </div>
            </nav>
          </div>
        </div>

        {/* Social -------------------------------------------------------- */}
        {data.footer?.socialLinks && data.footer.socialLinks.length > 0 ? (
          <div className="mt-12 border-t border-ink-line pt-8">
            <p className="text-body-xs font-semibold uppercase tracking-wider text-ink-faint">
              {labels.followUs}
            </p>
            <ul className="mt-3 flex flex-wrap gap-x-6 gap-y-2">
              {data.footer.socialLinks.map((social) => (
                <li key={social.platform}>
                  <a
                    href={social.url}
                    target="_blank"
                    rel="noopener noreferrer me"
                    className="text-body-sm text-ink-soft no-underline transition-colors duration-quick hover:text-ink"
                  >
                    {social.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>

      {/* Legal bar ------------------------------------------------------- */}
      <div className="border-t border-ink-line">
        <div className="container-wide flex flex-col gap-4 py-6 md:flex-row md:items-center md:justify-between">
          <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
            <p className="text-body-xs text-ink-muted">{copyright}</p>
            {(data.footer?.legalLinks ?? []).map((link) => (
              <Link
                key={link.path}
                href={`/${locale}${link.path}`}
                className="text-body-xs text-ink-muted no-underline transition-colors duration-quick hover:text-ink"
              >
                {link.label}
              </Link>
            ))}
          </div>

          <div className="flex items-center gap-4">
            <p className="text-body-xs text-ink-muted">
              {data.footer?.regionLabel ?? 'Pakistan'}
            </p>
            {data.footer?.showLocaleSwitch !== false ? (
              <>
                <span aria-hidden="true" className="text-ink-line">
                  |
                </span>
                <div className="flex items-center gap-2 text-body-xs">
                  <span className="font-semibold text-ink">{LOCALE_META[locale].nativeLabel}</span>
                  <Link
                    href={`/${otherLocale}/company`}
                    lang={otherLocale}
                    hrefLang={otherLocale}
                    className={[
                      'text-ink-muted no-underline transition-colors duration-quick hover:text-ink',
                      otherLocale === 'ur' ? 'font-urdu' : '',
                    ].join(' ')}
                  >
                    {LOCALE_META[otherLocale].nativeLabel}
                  </Link>
                </div>
              </>
            ) : null}

            <a
              href="#main"
              className="ms-2 text-body-xs text-ink-muted no-underline transition-colors duration-quick hover:text-ink"
            >
              {labels.backToTop} ↑
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}

function FooterGroup({ locale, group }: { locale: Locale; group: NavigationItem }) {
  return (
    <div>
      <p className="text-body-xs font-semibold uppercase tracking-wider text-ink">{group.label}</p>
      <ul className="mt-4 space-y-2.5">
        {group.children.map((item) => {
          const href = item.page ? `/${locale}${item.page.path}` : (item.externalUrl ?? '#');
          const isExternal = Boolean(item.externalUrl);

          return (
            <li key={item.id}>
              {isExternal ? (
                <a
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-body-sm text-ink-soft no-underline transition-colors duration-quick hover:text-ink"
                >
                  {item.label}
                </a>
              ) : (
                <Link
                  href={href}
                  className="text-body-sm text-ink-soft no-underline transition-colors duration-quick hover:text-ink"
                >
                  {item.label}
                </Link>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
