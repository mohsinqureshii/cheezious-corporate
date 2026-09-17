'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { API_URL } from '@/lib/api';

/**
 * The footer.
 *
 * Small, global and read on every page, so a mistake here is on the whole site
 * at once. Each language has its own configuration rather than sharing one with
 * translated strings, because the legal links a Pakistani reader needs and the
 * ones an English-language reader needs are not always the same list.
 */

export interface FooterConfig {
  id: string;
  locale: string;
  copyrightTemplate: string;
  showLocaleSwitch: boolean;
  socialLinks: Array<{ label: string; url: string }>;
  legalLinks: Array<{ label: string; path: string }>;
  regionLabel: string;
  note: string | null;
}

export function FooterEditor({
  footers,
  canManage,
}: {
  footers: FooterConfig[];
  canManage: boolean;
}) {
  const [locale, setLocale] = useState(footers[0]?.locale ?? 'en');
  const footer = footers.find((entry) => entry.locale === locale);

  if (!footer) {
    return (
      <div className="p-06">
        <p className="text-body-01 text-content-secondary">No footer is configured yet.</p>
      </div>
    );
  }

  return (
    <div className="p-06">
      <div className="mb-05 flex items-center gap-04">
        <label htmlFor="footer-locale" className="field-label mb-0">
          Language
        </label>
        <select
          id="footer-locale"
          className="select w-40"
          value={locale}
          onChange={(event) => setLocale(event.target.value)}
        >
          {footers.map((entry) => (
            <option key={entry.locale} value={entry.locale}>
              {entry.locale === 'en' ? 'English' : 'Urdu'}
            </option>
          ))}
        </select>
      </div>

      <FooterForm key={footer.locale} footer={footer} canManage={canManage} />
    </div>
  );
}

function FooterForm({ footer, canManage }: { footer: FooterConfig; canManage: boolean }) {
  const router = useRouter();
  const [copyrightTemplate, setCopyright] = useState(footer.copyrightTemplate);
  const [regionLabel, setRegionLabel] = useState(footer.regionLabel);
  const [showLocaleSwitch, setShowLocaleSwitch] = useState(footer.showLocaleSwitch);
  const [note, setNote] = useState(footer.note ?? '');
  const [socialLinks, setSocialLinks] = useState(footer.socialLinks ?? []);
  const [legalLinks, setLegalLinks] = useState(footer.legalLinks ?? []);
  const [state, setState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [error, setError] = useState('');

  async function save() {
    setState('saving');
    setError('');
    try {
      const response = await fetch(`${API_URL}/api/cms/structure/footer/${footer.locale}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          copyrightTemplate,
          regionLabel,
          showLocaleSwitch,
          note: note || null,
          socialLinks,
          legalLinks,
        }),
      });
      if (!response.ok) {
        const body = (await response.json()) as { error?: { message: string } };
        setState('error');
        setError(body.error?.message ?? 'The footer could not be saved.');
        return;
      }
      setState('saved');
      router.refresh();
    } catch {
      setState('error');
      setError('We could not reach the server. Check your connection and try again.');
    }
  }

  return (
    <div className="grid gap-06 xl:grid-cols-2">
      <section className="panel p-06">
        <h2 className="text-heading-compact text-content-primary">Text</h2>

        <div className="mt-05 space-y-05">
          <div>
            <label htmlFor="footer-copyright" className="field-label">
              Copyright line
            </label>
            <input
              id="footer-copyright"
              className="input"
              value={copyrightTemplate}
              disabled={!canManage}
              onChange={(event) => setCopyright(event.target.value)}
            />
            <p className="field-helper">
              <code>{'{year}'}</code> is replaced with the current year, so this never goes stale on
              1 January.
            </p>
          </div>

          <div>
            <label htmlFor="footer-region" className="field-label">
              Region label
            </label>
            <input
              id="footer-region"
              className="input"
              value={regionLabel}
              disabled={!canManage}
              onChange={(event) => setRegionLabel(event.target.value)}
            />
          </div>

          <label className="flex items-start gap-03">
            <input
              type="checkbox"
              className="checkbox mt-01"
              checked={showLocaleSwitch}
              disabled={!canManage}
              onChange={(event) => setShowLocaleSwitch(event.target.checked)}
            />
            <span>
              <span className="block text-body-compact text-content-primary">
                Show the language switch
              </span>
              <span className="block text-helper-01 text-content-secondary">
                Turn this off only while the other language is incomplete.
              </span>
            </span>
          </label>

          <div>
            <label htmlFor="footer-note" className="field-label">
              Note
            </label>
            <textarea
              id="footer-note"
              rows={2}
              className="textarea"
              value={note}
              disabled={!canManage}
              onChange={(event) => setNote(event.target.value)}
            />
          </div>
        </div>
      </section>

      <section className="panel p-06">
        <h2 className="text-heading-compact text-content-primary">Links</h2>

        <LinkList
          title="Social"
          items={socialLinks}
          fields={[
            { key: 'label', label: 'Label' },
            { key: 'url', label: 'Address' },
          ]}
          canManage={canManage}
          onChange={setSocialLinks}
        />

        <LinkList
          title="Legal"
          items={legalLinks}
          fields={[
            { key: 'label', label: 'Label' },
            { key: 'path', label: 'Path' },
          ]}
          canManage={canManage}
          onChange={setLegalLinks}
        />

        {canManage ? (
          <div className="mt-06 flex items-center gap-04">
            <button
              type="button"
              onClick={save}
              disabled={state === 'saving'}
              className="btn-primary"
            >
              {state === 'saving' ? 'Saving…' : 'Save footer'}
            </button>
            {state === 'saved' ? (
              <span className="text-body-compact text-status-success" role="status">
                Saved
              </span>
            ) : null}
            {state === 'error' ? (
              <span className="text-body-compact text-status-danger" role="alert">
                {error}
              </span>
            ) : null}
          </div>
        ) : null}
      </section>
    </div>
  );
}

function LinkList<T extends Record<string, string>>({
  title,
  items,
  fields,
  canManage,
  onChange,
}: {
  title: string;
  items: T[];
  fields: Array<{ key: string; label: string }>;
  canManage: boolean;
  onChange: (items: T[]) => void;
}) {
  return (
    <div className="mt-05">
      <p className="text-label-01 uppercase tracking-wide text-content-tertiary">{title}</p>

      <ul className="mt-02 space-y-02">
        {items.map((item, index) => (
          <li key={index} className="flex flex-wrap items-end gap-02">
            {fields.map((field) => (
              <span key={field.key} className="min-w-0 flex-1">
                <label htmlFor={`${title}-${index}-${field.key}`} className="sr-only">
                  {field.label}
                </label>
                <input
                  id={`${title}-${index}-${field.key}`}
                  className="input"
                  placeholder={field.label}
                  value={item[field.key] ?? ''}
                  disabled={!canManage}
                  onChange={(event) =>
                    onChange(
                      items.map((entry, i) =>
                        i === index ? { ...entry, [field.key]: event.target.value } : entry,
                      ),
                    )
                  }
                />
              </span>
            ))}
            {canManage ? (
              <button
                type="button"
                className="btn-ghost btn-sm"
                onClick={() => onChange(items.filter((_, i) => i !== index))}
              >
                Remove
                <span className="sr-only">
                  {' '}
                  {item[fields[0]!.key] ?? `${title} link ${index + 1}`}
                </span>
              </button>
            ) : null}
          </li>
        ))}
      </ul>

      {canManage ? (
        <button
          type="button"
          className="btn-ghost btn-sm mt-02"
          onClick={() =>
            onChange([...items, Object.fromEntries(fields.map((field) => [field.key, ''])) as T])
          }
        >
          Add a {title.toLowerCase()} link
        </button>
      ) : null}
    </div>
  );
}
