'use client';

import { formatDate } from '@cheezious/utilities';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useState, useTransition } from 'react';

import { DataTable, EmptyState, FilterBar, Pagination, type Column } from '@/components/ui';
import { API_URL } from '@/lib/api';
import type { ListMeta } from '@/lib/types';

/**
 * Redirects.
 *
 * Most of these are not written by hand: renaming a published page leaves one
 * behind automatically, which is what stops a rename quietly breaking every link
 * anyone has ever shared. Those are marked, because deleting one is deleting the
 * only thing keeping an old URL alive.
 *
 * The hit count is the useful column. A redirect nobody follows can go; one
 * followed thousands of times is load-bearing.
 */

export interface RedirectRow {
  id: string;
  source: string;
  destination: string;
  statusCode: number;
  locale: string | null;
  isEnabled: boolean;
  isAutomatic: boolean;
  note: string | null;
  hitCount: number;
  lastHitAt: string | null;
  createdAt: string;
}

export function RedirectsTable({
  rows,
  meta,
  automatic,
  canManage,
  initialQuery,
}: {
  rows: RedirectRow[];
  meta: ListMeta;
  automatic: number;
  canManage: boolean;
  initialQuery: { q: string; isAutomatic: string };
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const [search, setSearch] = useState(initialQuery.q);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');

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

  async function remove(row: RedirectRow) {
    setError('');
    const response = await fetch(`${API_URL}/api/cms/structure/redirects/${row.id}`, {
      method: 'DELETE',
      credentials: 'include',
    });
    if (!response.ok) {
      setError('That redirect could not be deleted.');
      return;
    }
    router.refresh();
  }

  const columns: Column<RedirectRow>[] = [
    {
      key: 'source',
      header: 'From',
      render: (row) => (
        <span className="block max-w-xs truncate font-mono text-helper-01">{row.source}</span>
      ),
      width: '26%',
    },
    {
      key: 'destination',
      header: 'To',
      render: (row) => (
        <span className="block max-w-xs truncate font-mono text-helper-01">{row.destination}</span>
      ),
      width: '26%',
    },
    {
      key: 'statusCode',
      header: 'Code',
      width: '80px',
      render: (row) => <span className="tabular">{row.statusCode}</span>,
    },
    {
      key: 'origin',
      header: 'Origin',
      width: '130px',
      render: (row) =>
        row.isAutomatic ? (
          <span
            className="tag bg-gray-20 text-content-primary"
            title="Created automatically when a page was renamed"
          >
            Automatic
          </span>
        ) : (
          <span className="text-content-secondary">Manual</span>
        ),
    },
    {
      key: 'hitCount',
      header: 'Followed',
      width: '130px',
      render: (row) => (
        <span
          className="tabular text-content-secondary"
          title={row.lastHitAt ? `Last ${formatDate(row.lastHitAt)}` : 'Never followed'}
        >
          {row.hitCount}
        </span>
      ),
    },
    {
      key: 'isEnabled',
      header: 'Status',
      width: '110px',
      render: (row) =>
        row.isEnabled ? (
          <span className="tag bg-status-successSubtle text-content-primary">Active</span>
        ) : (
          <span className="tag bg-gray-20 text-content-primary">Off</span>
        ),
    },
    ...(canManage
      ? [
          {
            key: 'actions',
            header: 'Actions',
            align: 'end' as const,
            width: '90px',
            render: (row: RedirectRow) => (
              <button
                type="button"
                onClick={() => remove(row)}
                className="text-status-danger hover:underline"
              >
                Delete
                <span className="sr-only"> the redirect from {row.source}</span>
              </button>
            ),
          },
        ]
      : []),
  ];

  return (
    <div className="p-06">
      {error ? (
        <div
          className="mb-05 border-s-[3px] border-status-danger bg-status-dangerSubtle px-05 py-04"
          role="alert"
        >
          <p className="text-body-01 text-content-primary">{error}</p>
        </div>
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
            <label htmlFor="redirects-search" className="sr-only">
              Search redirects
            </label>
            <input
              id="redirects-search"
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search by address"
              className="input w-64"
            />
          </form>

          <label htmlFor="redirects-origin" className="sr-only">
            Filter by origin
          </label>
          <select
            id="redirects-origin"
            className="select w-48"
            value={initialQuery.isAutomatic}
            onChange={(event) => setParam('isAutomatic', event.target.value || null)}
          >
            <option value="">Manual and automatic</option>
            <option value="false">Manual only</option>
            <option value="true">Automatic only ({automatic})</option>
          </select>

          {canManage ? (
            <button
              type="button"
              className="btn-primary btn-sm ms-auto"
              onClick={() => setCreating(true)}
            >
              Add a redirect
            </button>
          ) : null}
        </FilterBar>

        <div
          className={isPending ? 'opacity-60 transition-opacity duration-fast' : undefined}
          aria-busy={isPending}
        >
          <DataTable
            caption="Redirects"
            columns={columns}
            rows={rows}
            emptyState={
              <EmptyState
                title="No redirects"
                description="Renaming a published page leaves one here automatically."
              />
            }
          />
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

      {creating ? (
        <CreateRedirect
          onClose={() => setCreating(false)}
          onDone={() => {
            setCreating(false);
            router.refresh();
          }}
        />
      ) : null}
    </div>
  );
}

function CreateRedirect({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const [source, setSource] = useState('');
  const [destination, setDestination] = useState('');
  const [statusCode, setStatusCode] = useState('301');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError('');

    try {
      const response = await fetch(`${API_URL}/api/cms/structure/redirects`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          source,
          destination,
          statusCode: Number(statusCode),
          note: note || null,
        }),
      });
      if (!response.ok) {
        const body = (await response.json()) as {
          error?: { message: string; fields?: Array<{ message: string }> };
        };
        setError(
          body.error?.fields?.[0]?.message ??
            body.error?.message ??
            'That redirect could not be created.',
        );
        return;
      }
      onDone();
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
      aria-label="Add a redirect"
    >
      <div className="absolute inset-0" onClick={onClose} aria-hidden="true" />
      <form
        onSubmit={submit}
        className="relative w-full max-w-lg space-y-05 border border-border-subtle bg-surface-base p-06 shadow-modal"
      >
        <h2 className="text-heading-compact text-content-primary">Add a redirect</h2>

        {error ? (
          <p
            className="border-s-[3px] border-status-danger bg-status-dangerSubtle px-03 py-02 text-helper-01"
            role="alert"
          >
            {error}
          </p>
        ) : null}

        <div>
          <label htmlFor="redirect-source" className="field-label">
            From
          </label>
          <input
            id="redirect-source"
            className="input font-mono"
            value={source}
            required
            placeholder="/old-path"
            onChange={(event) => setSource(event.target.value)}
            // A dialog takes focus when it opens: WAI-ARIA asks for it, and without
            // it a keyboard user is left behind the overlay with nothing focused.
            // eslint-disable-next-line jsx-a11y/no-autofocus
            autoFocus
          />
          <p className="field-helper">
            The address people are arriving at, without the language prefix.
          </p>
        </div>

        <div>
          <label htmlFor="redirect-destination" className="field-label">
            To
          </label>
          <input
            id="redirect-destination"
            className="input font-mono"
            value={destination}
            required
            placeholder="/new-path"
            onChange={(event) => setDestination(event.target.value)}
          />
        </div>

        <div>
          <label htmlFor="redirect-status" className="field-label">
            Kind
          </label>
          <select
            id="redirect-status"
            className="select"
            value={statusCode}
            onChange={(event) => setStatusCode(event.target.value)}
          >
            <option value="301">Permanent (301)</option>
            <option value="302">Temporary (302)</option>
            <option value="307">Temporary, method preserved (307)</option>
            <option value="308">Permanent, method preserved (308)</option>
          </select>
          <p className="field-helper">
            Permanent is right for a rename and is what search engines act on. Use temporary only if
            the old address is coming back.
          </p>
        </div>

        <div>
          <label htmlFor="redirect-note" className="field-label">
            Note
          </label>
          <input
            id="redirect-note"
            className="input"
            value={note}
            onChange={(event) => setNote(event.target.value)}
            placeholder="Why this exists"
          />
        </div>

        <div className="flex gap-03">
          <button type="submit" disabled={busy || !source || !destination} className="btn-primary">
            {busy ? 'Creating…' : 'Create'}
          </button>
          <button type="button" onClick={onClose} className="btn-ghost">
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}
