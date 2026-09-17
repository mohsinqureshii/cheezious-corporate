'use client';

import { useState } from 'react';

import { API_URL } from '@/lib/api';

/**
 * Settings.
 *
 * Grouped the way the settings themselves are grouped rather than by storage:
 * a site setting is per-language, a global setting is not, and a feature flag is
 * an operational switch. Somebody changing the site name should not have to know
 * which table it lives in.
 *
 * Every change is audited with its before and after value.
 */

export interface SiteSetting {
  key: string;
  locale: string;
  label: string;
  description: string | null;
  value: unknown;
  group: string;
}

export interface GlobalSetting {
  key: string;
  label: string;
  description: string | null;
  value: unknown;
  group: string;
}

export interface FeatureFlag {
  key: string;
  label: string;
  description: string | null;
  isEnabled: boolean;
}

export interface SettingsPanelsProps {
  site: SiteSetting[];
  globals: GlobalSetting[];
  flags: FeatureFlag[];
}

export function SettingsPanels({ site, globals, flags }: SettingsPanelsProps) {
  const [locale, setLocale] = useState('en');

  const siteGroups = groupBy(
    site.filter((setting) => setting.locale === locale),
    (setting) => setting.group,
  );
  const globalGroups = groupBy(globals, (setting) => setting.group);

  return (
    <div className="space-y-06 p-06">
      <section className="panel p-06">
        <div className="flex flex-wrap items-center justify-between gap-04">
          <div>
            <h2 className="text-heading-compact text-content-primary">Site settings</h2>
            <p className="mt-01 text-body-01 text-content-secondary">
              Text and values that differ between languages.
            </p>
          </div>

          <div>
            <label htmlFor="settings-locale" className="sr-only">
              Language
            </label>
            <select
              id="settings-locale"
              className="select w-40"
              value={locale}
              onChange={(event) => setLocale(event.target.value)}
            >
              <option value="en">English</option>
              <option value="ur">Urdu</option>
            </select>
          </div>
        </div>

        {siteGroups.length === 0 ? (
          <p className="mt-05 text-body-01 text-content-secondary">
            Nothing is configured for this language yet.
          </p>
        ) : (
          siteGroups.map(([group, settings]) => (
            <div key={group} className="mt-06">
              <h3 className="text-label-01 uppercase tracking-wide text-content-tertiary">
                {group}
              </h3>
              <div className="mt-03 space-y-05">
                {settings.map((setting) => (
                  <SettingField
                    key={`${setting.key}-${setting.locale}`}
                    settingKey={setting.key}
                    locale={setting.locale}
                    label={setting.label}
                    description={setting.description}
                    value={setting.value}
                  />
                ))}
              </div>
            </div>
          ))
        )}
      </section>

      <section className="panel p-06">
        <h2 className="text-heading-compact text-content-primary">Global settings</h2>
        <p className="mt-01 text-body-01 text-content-secondary">
          Values that apply to the whole platform, in every language.
        </p>

        {globalGroups.map(([group, settings]) => (
          <div key={group} className="mt-06">
            <h3 className="text-label-01 uppercase tracking-wide text-content-tertiary">{group}</h3>
            <div className="mt-03 space-y-05">
              {settings.map((setting) => (
                <SettingField
                  key={setting.key}
                  settingKey={setting.key}
                  label={setting.label}
                  description={setting.description}
                  value={setting.value}
                />
              ))}
            </div>
          </div>
        ))}
      </section>

      <section className="panel p-06">
        <h2 className="text-heading-compact text-content-primary">Feature flags</h2>
        <p className="mt-01 text-body-01 text-content-secondary">
          Operational switches. Turning one off hides a feature from the public site immediately.
        </p>

        <div className="mt-05 space-y-04">
          {flags.map((flag) => (
            <FlagToggle key={flag.key} flag={flag} />
          ))}
        </div>
      </section>
    </div>
  );
}

function SettingField({
  settingKey,
  locale,
  label,
  description,
  value,
}: {
  settingKey: string;
  locale?: string;
  label: string;
  description: string | null;
  value: unknown;
}) {
  const isSimple =
    typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean';
  const [draft, setDraft] = useState(isSimple ? String(value) : JSON.stringify(value, null, 2));
  const [state, setState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [error, setError] = useState('');

  const id = `setting-${settingKey}${locale ? `-${locale}` : ''}`;

  async function save() {
    setState('saving');
    setError('');

    let parsed: unknown = draft;
    if (!isSimple) {
      try {
        parsed = JSON.parse(draft);
      } catch {
        setState('error');
        setError('That is not valid JSON.');
        return;
      }
    } else if (typeof value === 'number') {
      parsed = Number(draft);
      if (Number.isNaN(parsed)) {
        setState('error');
        setError('That is not a number.');
        return;
      }
    } else if (typeof value === 'boolean') {
      parsed = draft === 'true';
    }

    try {
      const response = await fetch(
        `${API_URL}/api/cms/system/settings/${encodeURIComponent(settingKey)}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ value: parsed, ...(locale ? { locale } : {}) }),
        },
      );
      if (!response.ok) {
        const body = (await response.json()) as { error?: { message: string } };
        setState('error');
        setError(body.error?.message ?? 'That change could not be saved.');
        return;
      }
      setState('saved');
    } catch {
      setState('error');
      setError('We could not reach the server. Check your connection and try again.');
    }
  }

  return (
    <div>
      <label htmlFor={id} className="field-label">
        {label}
      </label>

      {typeof value === 'boolean' ? (
        <select
          id={id}
          className="select"
          value={draft}
          onChange={(event) => {
            setDraft(event.target.value);
            setState('idle');
          }}
        >
          <option value="true">On</option>
          <option value="false">Off</option>
        </select>
      ) : isSimple ? (
        <input
          id={id}
          className="input"
          value={draft}
          onChange={(event) => {
            setDraft(event.target.value);
            setState('idle');
          }}
        />
      ) : (
        <textarea
          id={id}
          rows={4}
          className="textarea font-mono text-helper-01"
          value={draft}
          onChange={(event) => {
            setDraft(event.target.value);
            setState('idle');
          }}
        />
      )}

      <div className="mt-02 flex flex-wrap items-center gap-03">
        <button
          type="button"
          onClick={save}
          disabled={state === 'saving'}
          className="btn-tertiary btn-sm"
        >
          {state === 'saving' ? 'Saving…' : 'Save'}
        </button>
        {state === 'saved' ? (
          <span className="text-helper-01 text-status-success" role="status">
            Saved
          </span>
        ) : null}
        {state === 'error' ? (
          <span className="text-helper-01 text-status-danger" role="alert">
            {error}
          </span>
        ) : null}
        <span className="font-mono text-helper-01 text-content-tertiary">{settingKey}</span>
      </div>

      {description ? <p className="field-helper">{description}</p> : null}
    </div>
  );
}

function FlagToggle({ flag }: { flag: FeatureFlag }) {
  const [enabled, setEnabled] = useState(flag.isEnabled);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function toggle(next: boolean) {
    setBusy(true);
    setError('');
    const previous = enabled;
    setEnabled(next);

    try {
      const response = await fetch(
        `${API_URL}/api/cms/system/flags/${encodeURIComponent(flag.key)}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ isEnabled: next }),
        },
      );
      if (!response.ok) {
        setEnabled(previous);
        setError('That flag could not be changed.');
      }
    } catch {
      setEnabled(previous);
      setError('We could not reach the server.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <label className="flex items-start gap-03">
      <input
        type="checkbox"
        className="checkbox mt-01"
        checked={enabled}
        disabled={busy}
        onChange={(event) => toggle(event.target.checked)}
      />
      <span>
        <span className="block text-body-compact text-content-primary">{flag.label}</span>
        {flag.description ? (
          <span className="block text-helper-01 text-content-secondary">{flag.description}</span>
        ) : null}
        <span className="block font-mono text-helper-01 text-content-tertiary">{flag.key}</span>
        {error ? (
          <span className="block text-helper-01 text-status-danger" role="alert">
            {error}
          </span>
        ) : null}
      </span>
    </label>
  );
}

function groupBy<T>(items: T[], key: (item: T) => string): Array<[string, T[]]> {
  const map = new Map<string, T[]>();
  for (const item of items) {
    const group = key(item);
    map.set(group, [...(map.get(group) ?? []), item]);
  }
  return [...map.entries()];
}
