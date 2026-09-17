'use client';

import { useCallback, useEffect, useState } from 'react';

import { API_URL } from '@/lib/api';

/**
 * Choose an image or document from the media library.
 *
 * Opens over the editor rather than navigating away, because leaving a
 * half-written story to find a photograph is how work gets lost. The grid loads
 * on open and searches on demand; nothing is fetched until someone asks for it.
 */

export interface MediaAssetSummary {
  id: string;
  title: string;
  kind: string;
  storageKey: string;
  mimeType: string;
  altText: string | null;
  width: number | null;
  height: number | null;
}

const MEDIA_BASE = process.env.NEXT_PUBLIC_MEDIA_BASE_URL ?? `${API_URL}/files`;

export function assetUrl(storageKey: string): string {
  return `${MEDIA_BASE}/${storageKey}`;
}

export interface MediaPickerProps {
  value: string | null;
  label: string;
  help?: string;
  disabled?: boolean;
  onChange: (id: string | null) => void;
}

export function MediaPicker({ value, label, help, disabled, onChange }: MediaPickerProps) {
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<MediaAssetSummary | null>(null);

  // Resolve the current value so the field shows the asset rather than its id.
  useEffect(() => {
    if (!value) {
      setSelected(null);
      return;
    }
    let cancelled = false;
    fetch(`${API_URL}/api/cms/media/${value}`, { credentials: 'include' })
      .then((response) => (response.ok ? response.json() : null))
      .then((body: { asset?: MediaAssetSummary } | null) => {
        if (!cancelled && body?.asset) setSelected(body.asset);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [value]);

  return (
    <div>
      <p className="field-label">{label}</p>

      {selected ? (
        <div className="flex items-start gap-04 border border-border-subtle bg-surface-base p-03">
          {selected.kind === 'IMAGE' ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={assetUrl(selected.storageKey)}
              alt=""
              className="h-16 w-16 shrink-0 object-cover"
            />
          ) : (
            <span className="flex h-16 w-16 shrink-0 items-center justify-center bg-surface-subtle text-label-01 uppercase text-content-tertiary">
              {selected.mimeType.split('/')[1]?.slice(0, 4) ?? 'file'}
            </span>
          )}

          <div className="min-w-0 flex-1">
            <p className="truncate text-body-compact text-content-primary">{selected.title}</p>
            {selected.kind === 'IMAGE' && !selected.altText ? (
              <p className="mt-01 text-helper-01 text-status-warning">
                No alternative text. Add one in the media library before publishing.
              </p>
            ) : null}
            {!disabled ? (
              <div className="mt-02 flex gap-03">
                <button type="button" className="btn-ghost btn-sm" onClick={() => setOpen(true)}>
                  Replace
                </button>
                <button type="button" className="btn-ghost btn-sm" onClick={() => onChange(null)}>
                  Remove
                </button>
              </div>
            ) : null}
          </div>
        </div>
      ) : (
        <button
          type="button"
          disabled={disabled}
          onClick={() => setOpen(true)}
          className="flex w-full items-center justify-center border border-dashed border-border-strong
                     bg-surface-base px-05 py-06 text-body-compact text-content-secondary
                     transition-colors duration-fast hover:border-interactive hover:text-interactive
                     disabled:cursor-not-allowed disabled:opacity-50"
        >
          Choose from the media library
        </button>
      )}

      {help ? <p className="field-helper">{help}</p> : null}

      {open ? (
        <MediaBrowser
          onClose={() => setOpen(false)}
          onSelect={(asset) => {
            setSelected(asset);
            onChange(asset.id);
            setOpen(false);
          }}
        />
      ) : null}
    </div>
  );
}

function MediaBrowser({
  onClose,
  onSelect,
}: {
  onClose: () => void;
  onSelect: (asset: MediaAssetSummary) => void;
}) {
  const [items, setItems] = useState<MediaAssetSummary[]>([]);
  const [query, setQuery] = useState('');
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading');

  const load = useCallback(async (search: string) => {
    setState('loading');
    try {
      const url = new URL(`${API_URL}/api/cms/media`);
      url.searchParams.set('pageSize', '48');
      if (search) url.searchParams.set('q', search);

      const response = await fetch(url.toString(), { credentials: 'include' });
      if (!response.ok) {
        setState('error');
        return;
      }
      const body = (await response.json()) as { items: MediaAssetSummary[] };
      setItems(body.items);
      setState('ready');
    } catch {
      setState('error');
    }
  }, []);

  useEffect(() => {
    void load('');
  }, [load]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-modal flex items-center justify-center bg-gray-100/50 p-05"
      role="dialog"
      aria-modal="true"
      aria-label="Media library"
    >
      <div className="absolute inset-0" onClick={onClose} aria-hidden="true" />

      <div className="relative flex max-h-[80vh] w-full max-w-4xl flex-col border border-border-subtle bg-surface-base shadow-modal">
        <div className="flex items-center gap-04 border-b border-border-subtle px-05 py-04">
          <h2 className="text-heading-compact text-content-primary">Media library</h2>
          <form
            className="ms-auto"
            onSubmit={(event) => {
              event.preventDefault();
              void load(query);
            }}
          >
            <label htmlFor="media-search" className="sr-only">
              Search the media library
            </label>
            <input
              id="media-search"
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search by title or file name"
              className="input w-64"
              autoFocus
            />
          </form>
          <button type="button" onClick={onClose} className="btn-ghost btn-sm">
            Close
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-05">
          {state === 'loading' ? (
            <p className="text-body-compact text-content-secondary">Loading…</p>
          ) : state === 'error' ? (
            <p className="text-body-compact text-status-danger">The media library could not be loaded.</p>
          ) : items.length === 0 ? (
            <p className="text-body-compact text-content-secondary">Nothing matched that search.</p>
          ) : (
            <ul className="grid grid-cols-2 gap-04 sm:grid-cols-4 lg:grid-cols-6">
              {items.map((asset) => (
                <li key={asset.id}>
                  <button
                    type="button"
                    onClick={() => onSelect(asset)}
                    className="group block w-full text-start"
                  >
                    <span className="block aspect-square overflow-hidden bg-surface-subtle">
                      {asset.kind === 'IMAGE' ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={assetUrl(asset.storageKey)}
                          alt=""
                          loading="lazy"
                          className="h-full w-full object-cover transition-transform duration-fast group-hover:scale-105"
                        />
                      ) : (
                        <span className="flex h-full w-full items-center justify-center text-label-01 uppercase text-content-tertiary">
                          {asset.mimeType.split('/')[1]?.slice(0, 4) ?? 'file'}
                        </span>
                      )}
                    </span>
                    <span className="mt-02 block truncate text-helper-01 text-content-primary">{asset.title}</span>
                    {asset.kind === 'IMAGE' && !asset.altText ? (
                      <span className="block text-helper-01 text-status-warning">No alt text</span>
                    ) : null}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
