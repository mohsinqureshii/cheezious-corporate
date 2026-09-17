import Link from 'next/link';

import { ErrorState, PageHeader } from '@/components/ui';
import { cmsFetch } from '@/lib/api';
import { requireUsableSession } from '@/lib/session';

/**
 * Translation status.
 *
 * The number that matters is the last one: published English pages with no Urdu
 * counterpart. Those are live and half the audience cannot read them, which is
 * a different problem from a draft that has not been translated yet.
 */

export const dynamic = 'force-dynamic';

export const metadata = { title: 'Translation status' };

interface LocalizationResponse {
  locales: Array<{
    code: string;
    label: string;
    nativeLabel: string;
    direction: string;
    isDefault: boolean;
    isEnabled: boolean;
  }>;
  counts: {
    pages: Array<{ locale: string; status: string; count: number }>;
    stories: Array<{ locale: string; status: string; count: number }>;
  };
  untranslatedPages: Array<{ id: string; title: string; path: string }>;
}

const STATUS_LABELS: Record<string, string> = {
  NOT_STARTED: 'Not started',
  IN_PROGRESS: 'In progress',
  TRANSLATED: 'Translated',
  OUTDATED: 'Outdated',
};

export default async function LocalizationPage() {
  const { cookie } = await requireUsableSession();

  const data = await cmsFetch<LocalizationResponse>('/api/cms/structure/localization', {
    cookie,
  }).catch(() => null);

  if (!data) {
    return (
      <>
        <PageHeader title="Translation status" />
        <div className="p-06">
          <ErrorState title="This could not be loaded" description="This section is restricted." />
        </div>
      </>
    );
  }

  return (
    <>
      <PageHeader
        title="Translation status"
        description="How much of the site exists in each language, and what is missing."
      />

      <div className="space-y-06 p-06">
        <section className="panel p-06">
          <h2 className="text-heading-compact text-content-primary">Languages</h2>
          <ul className="mt-04 grid gap-04 sm:grid-cols-2">
            {data.locales.map((locale) => (
              <li key={locale.code} className="border border-border-subtle p-05">
                <p className="text-body-compact text-content-primary">
                  {locale.label}{' '}
                  <span className="text-content-tertiary">({locale.nativeLabel})</span>
                </p>
                <p className="mt-01 text-helper-01 text-content-secondary">
                  {locale.code.toUpperCase()} · {locale.direction.toUpperCase()}
                  {locale.isDefault ? ' · default' : ''}
                  {locale.isEnabled ? '' : ' · disabled'}
                </p>
              </li>
            ))}
          </ul>
        </section>

        <section className="panel p-06">
          <h2 className="text-heading-compact text-content-primary">Where things stand</h2>

          {(['pages', 'stories'] as const).map((kind) => (
            <div key={kind} className="mt-05">
              <h3 className="text-label-01 uppercase tracking-wide text-content-tertiary">
                {kind}
              </h3>
              {data.counts[kind].length === 0 ? (
                <p className="mt-02 text-body-01 text-content-secondary">Nothing yet.</p>
              ) : (
                <ul className="mt-02 flex flex-wrap gap-03">
                  {data.counts[kind].map((row) => (
                    <li
                      key={`${row.locale}-${row.status}`}
                      className="border border-border-subtle px-04 py-02"
                    >
                      <span className="block text-heading-compact tabular text-content-primary">
                        {row.count}
                      </span>
                      <span className="block text-helper-01 text-content-secondary">
                        {row.locale.toUpperCase()} · {STATUS_LABELS[row.status] ?? row.status}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ))}
        </section>

        <section className="panel">
          <div className="flex flex-wrap items-baseline justify-between gap-03 border-b border-border-subtle px-05 py-04">
            <div>
              <h2 className="text-heading-compact text-content-primary">
                Published, but only in English
              </h2>
              <p className="mt-01 text-helper-01 text-content-secondary">
                These are live and half the audience cannot read them.
              </p>
            </div>
            <span className="text-body-compact tabular text-content-secondary">
              {data.untranslatedPages.length}
              {data.untranslatedPages.length === 100 ? '+' : ''}
            </span>
          </div>

          {data.untranslatedPages.length === 0 ? (
            <p className="px-05 py-05 text-body-01 text-content-secondary">
              Every published English page has an Urdu counterpart.
            </p>
          ) : (
            <ul className="divide-y divide-border-subtle">
              {data.untranslatedPages.map((page) => (
                <li
                  key={page.id}
                  className="flex flex-wrap items-center justify-between gap-03 px-05 py-03"
                >
                  <Link
                    href={`/content/pages/${page.id}`}
                    className="text-body-compact text-interactive no-underline hover:underline"
                  >
                    {page.title}
                  </Link>
                  <span className="font-mono text-helper-01 text-content-tertiary">
                    {page.path}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </>
  );
}
