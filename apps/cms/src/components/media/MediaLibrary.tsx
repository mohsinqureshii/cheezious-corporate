'use client';

import { formatDate } from '@cheezious/utilities';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useRef, useState, useTransition } from 'react';

import { assetUrl } from '@/components/collections/MediaPicker';
import { EmptyState, FilterBar, Pagination } from '@/components/ui';
import { API_URL } from '@/lib/api';
import type { ListMeta } from '@/lib/types';

/**
 * The media library.
 *
 * A grid rather than a table, because an image is identified by looking at it.
 * Selecting one opens an inspector where the metadata that matters — above all
 * the alternative text — is edited in place.
 *
 * Missing alternative text is surfaced as a count and a filter rather than left
 * for someone to notice. A site's accessibility is the sum of these small
 * omissions, and they are only ever fixed if somebody can find them.
 */

export interface MediaAsset {
  id: string;
  kind: string;
  storageKey: string;
  originalName: string;
  mimeType: string;
  byteSize: number;
  width: number | null;
  height: number | null;
  title: string;
  altText: string | null;
  caption: string | null;
  credit: string | null;
  visibility: string;
  isBrandAsset: boolean;
  isPressAsset: boolean;
  createdAt: string;
  folder: { id: string; name: string } | null;
  uploadedBy: { id: string; name: string } | null;
  _count: { usages: number };
}

export interface MediaLibraryProps {
  items: MediaAsset[];
  meta: ListMeta;
  facets: { kinds: Array<{ value: string; count: number }>; missingAltText: number };
  initialQuery: { q: string; kind: string; missingAltText: boolean };
  canUpload: boolean;
  canUpdate: boolean;
  canDelete: boolean;
  canManageBrand: boolean;
}

export function MediaLibrary({
  items,
  meta,
  facets,
  initialQuery,
  canUpload,
  canUpdate,
  canDelete,
  canManageBrand,
}: MediaLibraryProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const [search, setSearch] = useState(initialQuery.q);
  const [selected, setSelected] = useState<MediaAsset | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const fileInput = useRef<HTMLInputElement>(null);

  const setParam = useCallback(
    (key: string, value: string | null) => {
      const params = new URLSearchParams(searchParams.toString());
      if (value === null || value === '') params.delete(key);
      else params.set(key, value);
      if (key !== 'page') params.delete('page');
      startTransition(() => router.push(`${pathname}?${params.toString()}`));
    },
    [pathname, router, searchParams],
  );

  async function upload(files: FileList) {
    setUploading(true);
    setUploadError('');

    const form = new FormData();
    for (const file of Array.from(files)) form.append('files', file);

    try {
      const response = await fetch(`${API_URL}/api/cms/media`, {
        method: 'POST',
        credentials: 'include',
        body: form,
      });

      if (!response.ok) {
        const body = (await response.json()) as {
          error?: { message: string; fields?: Array<{ message: string }> };
        };
        setUploadError(
          body.error?.fields?.[0]?.message ?? body.error?.message ?? 'The upload failed.',
        );
        return;
      }
      router.refresh();
    } catch {
      setUploadError('We could not reach the server. Check your connection and try again.');
    } finally {
      setUploading(false);
      if (fileInput.current) fileInput.current.value = '';
    }
  }

  return (
    <div className="p-06">
      {facets.missingAltText > 0 ? (
        <button
          type="button"
          onClick={() => setParam('missingAltText', initialQuery.missingAltText ? null : 'true')}
          className={[
            'mb-05 flex w-full items-center gap-04 border-s-[3px] px-05 py-04 text-start',
            initialQuery.missingAltText
              ? 'border-interactive bg-interactive-subtle'
              : 'border-status-warning bg-status-warningSubtle',
          ].join(' ')}
        >
          <span className="flex-1">
            <span className="block text-heading-compact text-content-primary">
              {facets.missingAltText} image{facets.missingAltText === 1 ? '' : 's'} without
              alternative text
            </span>
            <span className="block text-helper-01 text-content-secondary">
              Screen readers announce nothing for these.{' '}
              {initialQuery.missingAltText ? 'Showing them now.' : 'Show only those.'}
            </span>
          </span>
        </button>
      ) : null}

      <div className="panel">
        <FilterBar resultCount={meta.total}>
          <form
            onSubmit={(event) => {
              event.preventDefault();
              setParam('q', search);
            }}
            className="flex items-center"
          >
            <label htmlFor="media-library-search" className="sr-only">
              Search the media library
            </label>
            <input
              id="media-library-search"
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search by title, file name or alt text"
              className="input w-72"
            />
          </form>

          <label htmlFor="media-kind" className="sr-only">
            Filter by type
          </label>
          <select
            id="media-kind"
            className="select w-44"
            value={initialQuery.kind}
            onChange={(event) => setParam('kind', event.target.value || null)}
          >
            <option value="">All types</option>
            {facets.kinds.map((facet) => (
              <option key={facet.value} value={facet.value}>
                {facet.value.charAt(0) + facet.value.slice(1).toLowerCase()} ({facet.count})
              </option>
            ))}
          </select>

          {canUpload ? (
            <div className="ms-auto">
              <label htmlFor="media-upload" className="btn-primary btn-sm cursor-pointer">
                {uploading ? 'Uploading…' : 'Upload'}
              </label>
              <input
                ref={fileInput}
                id="media-upload"
                type="file"
                multiple
                className="sr-only"
                disabled={uploading}
                onChange={(event) => {
                  if (event.target.files?.length) void upload(event.target.files);
                }}
              />
            </div>
          ) : null}
        </FilterBar>

        {uploadError ? (
          <p
            className="border-b border-border-subtle bg-status-dangerSubtle px-05 py-03 text-body-01"
            role="alert"
          >
            {uploadError}
          </p>
        ) : null}

        <div
          className={isPending ? 'opacity-60 transition-opacity duration-fast' : undefined}
          aria-busy={isPending}
        >
          {items.length === 0 ? (
            <EmptyState
              title="Nothing here"
              description={
                initialQuery.q || initialQuery.kind || initialQuery.missingAltText
                  ? 'Try a different search, or clear the filters.'
                  : 'Upload an image or document to get started.'
              }
            />
          ) : (
            <ul className="grid grid-cols-2 gap-04 p-05 sm:grid-cols-3 lg:grid-cols-5 xl:grid-cols-6">
              {items.map((asset) => (
                <li key={asset.id}>
                  <button
                    type="button"
                    onClick={() => setSelected(asset)}
                    className="group block w-full text-start"
                    aria-haspopup="dialog"
                  >
                    <span className="block aspect-square overflow-hidden bg-surface-subtle">
                      {asset.kind === 'IMAGE' ? (
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
                    <span className="mt-02 block truncate text-helper-01 text-content-primary">
                      {asset.title}
                    </span>
                    {asset.kind === 'IMAGE' && !asset.altText ? (
                      <span className="block text-helper-01 text-status-warning">No alt text</span>
                    ) : (
                      <span className="block text-helper-01 text-content-tertiary">
                        {asset._count.usages > 0 ? `Used ${asset._count.usages}×` : 'Unused'}
                      </span>
                    )}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {meta.total > meta.pageSize ? (
          <Pagination
            page={meta.page}
            pageSize={meta.pageSize}
            total={meta.total}
            onPageChange={(next) => setParam('page', String(next))}
          />
        ) : null}
      </div>

      {selected ? (
        <AssetInspector
          asset={selected}
          canUpdate={canUpdate}
          canDelete={canDelete}
          canManageBrand={canManageBrand}
          onClose={() => setSelected(null)}
          onSaved={() => {
            setSelected(null);
            router.refresh();
          }}
        />
      ) : null}
    </div>
  );
}

function AssetInspector({
  asset,
  canUpdate,
  canDelete,
  canManageBrand,
  onClose,
  onSaved,
}: {
  asset: MediaAsset;
  canUpdate: boolean;
  canDelete: boolean;
  canManageBrand: boolean;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [title, setTitle] = useState(asset.title);
  const [altText, setAltText] = useState(asset.altText ?? '');
  const [caption, setCaption] = useState(asset.caption ?? '');
  const [credit, setCredit] = useState(asset.credit ?? '');
  const [isBrandAsset, setIsBrandAsset] = useState(asset.isBrandAsset);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);

  async function save() {
    setBusy(true);
    setError('');
    try {
      const response = await fetch(`${API_URL}/api/cms/media/${asset.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          title,
          altText: altText || null,
          caption: caption || null,
          credit: credit || null,
          ...(canManageBrand ? { isBrandAsset } : {}),
        }),
      });
      if (!response.ok) {
        const body = (await response.json()) as { error?: { message: string } };
        setError(body.error?.message ?? 'The changes could not be saved.');
        return;
      }
      onSaved();
    } catch {
      setError('We could not reach the server. Check your connection and try again.');
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    setBusy(true);
    setError('');
    try {
      const response = await fetch(`${API_URL}/api/cms/media/${asset.id}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      if (!response.ok) {
        const body = (await response.json()) as { error?: { message: string } };
        setError(body.error?.message ?? 'This asset could not be deleted.');
        return;
      }
      onSaved();
    } catch {
      setError('We could not reach the server. Check your connection and try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-modal flex items-center justify-center bg-gray-100/50 p-05"
      role="dialog"
      aria-modal="true"
      aria-label={asset.title}
    >
      <div className="absolute inset-0" onClick={onClose} aria-hidden="true" />

      <div className="relative grid max-h-[85vh] w-full max-w-4xl grid-cols-1 overflow-hidden border border-border-subtle bg-surface-base shadow-modal md:grid-cols-[minmax(0,1fr)_340px]">
        <div className="flex items-center justify-center bg-gray-100 p-05">
          {asset.kind === 'IMAGE' ? (
            <img
              src={assetUrl(asset.storageKey)}
              alt={asset.altText ?? ''}
              className="max-h-[60vh] w-auto object-contain"
            />
          ) : (
            <a
              href={assetUrl(asset.storageKey)}
              target="_blank"
              rel="noopener noreferrer"
              className="text-body-01 text-content-inverse underline"
            >
              Open {asset.originalName}
            </a>
          )}
        </div>

        <div className="flex flex-col overflow-y-auto p-05">
          <div className="flex items-start justify-between gap-03">
            <h2 className="text-heading-compact text-content-primary">Asset details</h2>
            <button type="button" onClick={onClose} className="btn-ghost btn-sm">
              Close
            </button>
          </div>

          {error ? (
            <p
              className="mt-04 border-s-[3px] border-status-danger bg-status-dangerSubtle px-03 py-02 text-helper-01"
              role="alert"
            >
              {error}
            </p>
          ) : null}

          <div className="mt-05 space-y-04">
            <div>
              <label htmlFor="asset-title" className="field-label">
                Title
              </label>
              <input
                id="asset-title"
                className="input"
                value={title}
                disabled={!canUpdate}
                onChange={(event) => setTitle(event.target.value)}
              />
            </div>

            {asset.kind === 'IMAGE' ? (
              <div>
                <label htmlFor="asset-alt" className="field-label">
                  Alternative text
                </label>
                <textarea
                  id="asset-alt"
                  rows={2}
                  className={['textarea', !altText ? 'input-invalid' : ''].join(' ')}
                  value={altText}
                  disabled={!canUpdate}
                  onChange={(event) => setAltText(event.target.value)}
                />
                <p className="field-helper">
                  What the image conveys, for someone who cannot see it. Leave empty only if the
                  image is purely decorative.
                </p>
              </div>
            ) : null}

            <div>
              <label htmlFor="asset-caption" className="field-label">
                Caption
              </label>
              <textarea
                id="asset-caption"
                rows={2}
                className="textarea"
                value={caption}
                disabled={!canUpdate}
                onChange={(event) => setCaption(event.target.value)}
              />
            </div>

            <div>
              <label htmlFor="asset-credit" className="field-label">
                Credit
              </label>
              <input
                id="asset-credit"
                className="input"
                value={credit}
                disabled={!canUpdate}
                onChange={(event) => setCredit(event.target.value)}
              />
              <p className="field-helper">
                The photographer or rights holder, where one must be named.
              </p>
            </div>

            {canManageBrand ? (
              <label className="flex items-start gap-03">
                <input
                  type="checkbox"
                  className="checkbox mt-01"
                  checked={isBrandAsset}
                  onChange={(event) => setIsBrandAsset(event.target.checked)}
                />
                <span>
                  <span className="block text-body-compact text-content-primary">Brand asset</span>
                  <span className="block text-helper-01 text-content-secondary">
                    Appears in the brand section, where third parties are told how it may be used.
                  </span>
                </span>
              </label>
            ) : null}
          </div>

          <dl className="mt-05 space-y-02 border-t border-border-subtle pt-04 text-helper-01">
            <div className="flex justify-between gap-03">
              <dt className="text-content-tertiary">File</dt>
              <dd className="truncate text-content-secondary">{asset.originalName}</dd>
            </div>
            <div className="flex justify-between gap-03">
              <dt className="text-content-tertiary">Dimensions</dt>
              <dd className="text-content-secondary">
                {asset.width && asset.height ? `${asset.width} × ${asset.height}` : '—'}
              </dd>
            </div>
            <div className="flex justify-between gap-03">
              <dt className="text-content-tertiary">Uploaded</dt>
              <dd className="text-content-secondary">
                {formatDate(asset.createdAt, 'en', { dateStyle: 'medium' })}
                {asset.uploadedBy ? ` by ${asset.uploadedBy.name}` : ''}
              </dd>
            </div>
            <div className="flex justify-between gap-03">
              <dt className="text-content-tertiary">In use</dt>
              <dd className="text-content-secondary">{asset._count.usages} place(s)</dd>
            </div>
          </dl>

          <div className="mt-auto flex flex-wrap items-center gap-03 pt-05">
            {canUpdate ? (
              <button type="button" onClick={save} disabled={busy} className="btn-primary btn-sm">
                {busy ? 'Saving…' : 'Save'}
              </button>
            ) : null}

            {canDelete ? (
              confirmDelete ? (
                <>
                  <span className="text-helper-01 text-content-secondary">Delete this asset?</span>
                  <button
                    type="button"
                    onClick={remove}
                    disabled={busy}
                    className="btn-danger btn-sm"
                  >
                    Yes, delete
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmDelete(false)}
                    className="btn-ghost btn-sm"
                  >
                    Cancel
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  onClick={() => setConfirmDelete(true)}
                  className="btn-ghost btn-sm"
                >
                  Delete
                </button>
              )
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
