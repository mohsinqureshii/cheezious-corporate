'use client';

import { useEffect, useState } from 'react';

import { API_URL } from '@/lib/api';

/**
 * Choose a related record — a category, a department, a pillar.
 *
 * A plain select rather than a search field: these lists are short by design,
 * and a dropdown that shows every option at once is faster to use than one that
 * makes you guess what exists. If a list ever grows past a few dozen, that is a
 * signal about the taxonomy rather than about this control.
 */

export interface ReferenceSelectProps {
  value: string | null;
  collection: string;
  label: string;
  help?: string;
  disabled?: boolean;
  onChange: (id: string | null) => void;
}

interface Option {
  id: string;
  name: string;
}

export function ReferenceSelect({
  value,
  collection,
  label,
  help,
  disabled,
  onChange,
}: ReferenceSelectProps) {
  const [options, setOptions] = useState<Option[]>([]);
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading');

  useEffect(() => {
    let cancelled = false;

    fetch(`${API_URL}/api/cms/content/${collection}?pageSize=100`, { credentials: 'include' })
      .then((response) => (response.ok ? response.json() : Promise.reject(new Error('failed'))))
      .then((body: { items: Array<Record<string, unknown>> }) => {
        if (cancelled) return;
        setOptions(
          body.items.map((item) => ({
            id: String(item.id),
            name: String(item.name ?? item.title ?? item.headline ?? item.id),
          })),
        );
        setState('ready');
      })
      .catch(() => {
        if (!cancelled) setState('error');
      });

    return () => {
      cancelled = true;
    };
  }, [collection]);

  const id = `reference-${collection}-${label.toLowerCase().replace(/\W+/g, '-')}`;

  return (
    <div>
      <label htmlFor={id} className="field-label">
        {label}
      </label>
      <select
        id={id}
        className="select"
        value={value ?? ''}
        disabled={disabled || state === 'loading'}
        onChange={(event) => onChange(event.target.value || null)}
      >
        <option value="">
          {state === 'loading' ? 'Loading…' : state === 'error' ? 'Could not load options' : 'None'}
        </option>
        {options.map((option) => (
          <option key={option.id} value={option.id}>
            {option.name}
          </option>
        ))}
      </select>

      {state === 'error' ? (
        <p className="field-error">
          The list could not be loaded. You may not have permission to see it, or the API is
          unavailable.
        </p>
      ) : help ? (
        <p className="field-helper">{help}</p>
      ) : null}
    </div>
  );
}
