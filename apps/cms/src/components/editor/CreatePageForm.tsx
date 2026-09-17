'use client';

import { slugify } from '@cheezious/utilities';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { API_URL } from '@/lib/api';

/**
 * Create a page.
 *
 * Deliberately short: a title, where it lives and what kind of page it is. The
 * composition happens in the editor, and asking for twenty fields before anyone
 * has written a sentence is how a CMS acquires a reputation.
 *
 * The path is suggested from the title and from the section chosen, but stays
 * editable — a URL is a promise to everyone who links to it, so it is worth one
 * deliberate look before it is made.
 */

export interface ParentOption {
  id: string;
  title: string;
  path: string;
}

const PAGE_TYPES = [
  { value: 'STANDARD', label: 'Standard', help: 'A normal content page.' },
  { value: 'LANDING', label: 'Landing', help: 'The front of a section, with a fuller hero.' },
  { value: 'SECTION_INDEX', label: 'Section index', help: 'Lists what is beneath it.' },
  { value: 'EDITORIAL', label: 'Editorial', help: 'Long-form, measured for reading.' },
  { value: 'DOCUMENT_CENTRE', label: 'Document centre', help: 'Reports and downloads.' },
  { value: 'CONTACT', label: 'Contact', help: 'Carries a form.' },
];

export function CreatePageForm({ parents }: { parents: ParentOption[] }) {
  const router = useRouter();

  const [title, setTitle] = useState('');
  const [path, setPath] = useState('');
  const [pathTouched, setPathTouched] = useState(false);
  const [parentId, setParentId] = useState('');
  const [locale, setLocale] = useState('en');
  const [type, setType] = useState('STANDARD');
  const [summary, setSummary] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const parent = parents.find((entry) => entry.id === parentId);
  const suggested = `${parent ? parent.path : ''}/${slugify(title || 'untitled')}`;
  const effectivePath = pathTouched && path ? path : suggested;

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError('');
    setFieldErrors({});

    try {
      const response = await fetch(`${API_URL}/api/cms/pages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          title,
          path: effectivePath,
          locale,
          type,
          parentId: parentId || null,
          summary: summary || null,
        }),
      });

      const body = (await response.json()) as {
        page?: { id: string };
        error?: { message: string; fields?: Array<{ field: string; message: string }> };
      };

      if (!response.ok) {
        setFieldErrors(
          Object.fromEntries(
            (body.error?.fields ?? []).map((entry) => [entry.field, entry.message]),
          ),
        );
        setError(
          body.error?.fields?.length
            ? 'Some fields need attention.'
            : (body.error?.message ?? 'The page could not be created.'),
        );
        return;
      }

      if (body.page) router.replace(`/content/pages/${body.page.id}`);
    } catch {
      setError('We could not reach the server. Check your connection and try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="max-w-xl space-y-05 p-06" noValidate>
      {error ? (
        <div
          className="border-s-[3px] border-status-danger bg-status-dangerSubtle px-05 py-04"
          role="alert"
        >
          <p className="text-body-01 text-content-primary">{error}</p>
        </div>
      ) : null}

      <div>
        <label htmlFor="page-title" className="field-label">
          Title
        </label>
        <input
          id="page-title"
          className={['input', fieldErrors.title ? 'input-invalid' : ''].join(' ')}
          value={title}
          required
          onChange={(event) => setTitle(event.target.value)}
        />
        {fieldErrors.title ? <p className="field-error">{fieldErrors.title}</p> : null}
      </div>

      <div>
        <label htmlFor="page-parent" className="field-label">
          Section
        </label>
        <select
          id="page-parent"
          className="select"
          value={parentId}
          onChange={(event) => setParentId(event.target.value)}
        >
          <option value="">Top level</option>
          {parents.map((entry) => (
            <option key={entry.id} value={entry.id}>
              {entry.title} — {entry.path}
            </option>
          ))}
        </select>
        <p className="field-helper">Where this page sits in the navigation and in its address.</p>
      </div>

      <div>
        <label htmlFor="page-path" className="field-label">
          Address
        </label>
        <input
          id="page-path"
          className={['input font-mono', fieldErrors.path ? 'input-invalid' : ''].join(' ')}
          value={effectivePath}
          onChange={(event) => {
            setPathTouched(true);
            setPath(event.target.value);
          }}
        />
        {fieldErrors.path ? (
          <p className="field-error">{fieldErrors.path}</p>
        ) : (
          <p className="field-helper">
            Suggested from the title. Worth one deliberate look — a URL is a promise to everyone who
            links to it.
          </p>
        )}
      </div>

      <div>
        <label htmlFor="page-locale" className="field-label">
          Language
        </label>
        <select
          id="page-locale"
          className="select"
          value={locale}
          onChange={(event) => setLocale(event.target.value)}
        >
          <option value="en">English</option>
          <option value="ur">Urdu</option>
        </select>
      </div>

      <fieldset>
        <legend className="field-label">Kind of page</legend>
        <div className="space-y-02">
          {PAGE_TYPES.map((option) => (
            <label key={option.value} className="flex items-start gap-03">
              <input
                type="radio"
                name="page-type"
                className="mt-01"
                value={option.value}
                checked={type === option.value}
                onChange={() => setType(option.value)}
              />
              <span>
                <span className="block text-body-compact text-content-primary">{option.label}</span>
                <span className="block text-helper-01 text-content-secondary">{option.help}</span>
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      <div>
        <label htmlFor="page-summary" className="field-label">
          Summary
        </label>
        <textarea
          id="page-summary"
          rows={2}
          className="textarea"
          value={summary}
          onChange={(event) => setSummary(event.target.value)}
        />
        <p className="field-helper">
          Used in listings and as the search description until an SEO description is written.
        </p>
      </div>

      <button type="submit" disabled={busy || !title.trim()} className="btn-primary">
        {busy ? 'Creating…' : 'Create and start editing'}
      </button>
    </form>
  );
}
