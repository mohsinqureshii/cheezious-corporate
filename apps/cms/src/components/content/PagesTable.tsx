'use client';

import { formatDate, formatRelativeTime } from '@cheezious/utilities';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useState, useTransition } from 'react';

import {
  BulkActions,
  DataTable,
  EmptyState,
  FilterBar,
  Pagination,
  StatusTag,
  UnpublishedChangesTag,
  type Column,
} from '@/components/ui';
import type { ListMeta, PageRow, StatusFacet } from '@/lib/types';

/**
 * The pages data table.
 *
 * Filters live in the URL rather than in component state, which means a
 * filtered view is shareable and the browser's back button behaves the way
 * people expect. Filtering re-runs the query on the server, so the counts and
 * pagination always reflect the whole collection rather than the loaded page.
 */

export interface PagesTableProps {
  rows: PageRow[];
  meta: ListMeta;
  statusFacets: StatusFacet[];
  canCreate: boolean;
  canPublish: boolean;
  canDelete: boolean;
  initialQuery: { q: string; status: string; locale: string; unpublished: boolean };
}

export function PagesTable({
  rows,
  meta,
  statusFacets,
  canCreate,
  canPublish,
  canDelete,
  initialQuery,
}: PagesTableProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const [selected, setSelected] = useState<string[]>([]);
  const [search, setSearch] = useState(initialQuery.q);

  /** Write a filter into the URL, resetting to page 1 whenever it changes. */
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

  const columns: Column<PageRow>[] = [
    {
      key: 'title',
      header: 'Title',
      render: (row) => (
        <span className="block max-w-xs truncate" title={row.title}>
          {row.title}
        </span>
      ),
      width: '28%',
    },
    {
      key: 'path',
      header: 'Path',
      render: (row) => (
        <span
          className="block max-w-xs truncate font-mono text-helper-01 text-content-secondary"
          title={row.path}
        >
          {row.path}
        </span>
      ),
      width: '22%',
    },
    {
      key: 'type',
      header: 'Type',
      render: (row) => <span className="text-content-secondary">{humanize(row.type)}</span>,
    },
    {
      key: 'locale',
      header: 'Locale',
      render: (row) => <span className="uppercase text-content-secondary">{row.locale}</span>,
      width: '72px',
    },
    {
      key: 'status',
      header: 'Status',
      render: (row) => (
        <span className="flex flex-wrap items-center gap-02">
          <StatusTag status={row.status} size="sm" />
          {row.hasUnpublishedChanges && row.status === 'PUBLISHED' ? (
            <UnpublishedChangesTag />
          ) : null}
        </span>
      ),
      width: '180px',
    },
    {
      key: 'updatedBy',
      header: 'Last edited by',
      render: (row) => <span className="text-content-secondary">{row.updatedBy?.name ?? '—'}</span>,
    },
    {
      key: 'updatedAt',
      header: 'Updated',
      render: (row) => (
        <time
          dateTime={row.updatedAt}
          title={formatDate(row.updatedAt, 'en', {
            dateStyle: 'full',
            timeStyle: 'short',
          } as never)}
        >
          {formatRelativeTime(row.updatedAt)}
        </time>
      ),
      width: '140px',
    },
    {
      key: 'scheduledFor',
      header: 'Scheduled',
      render: (row) =>
        row.scheduledFor ? (
          <time dateTime={row.scheduledFor} className="text-status-info">
            {formatDate(row.scheduledFor, 'en', {
              month: 'short',
              day: 'numeric',
              hour: '2-digit',
              minute: '2-digit',
            })}
          </time>
        ) : (
          <span className="text-content-tertiary">—</span>
        ),
      width: '140px',
    },
    {
      key: 'actions',
      header: 'Actions',
      align: 'end',
      render: (row) => (
        // Labelled links rather than mystery icons: an operational tool should
        // not require hovering to discover what a control does.
        <span className="flex items-center justify-end gap-03">
          <Link
            href={`/content/pages/${row.id}`}
            className="text-interactive no-underline hover:underline"
          >
            Edit
          </Link>
          {row.status === 'PUBLISHED' ? (
            <a
              href={`${process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'}/${row.locale}${row.path}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-interactive no-underline hover:underline"
            >
              View
              <span className="sr-only"> on the live site (opens in a new tab)</span>
            </a>
          ) : null}
        </span>
      ),
      width: '120px',
    },
  ];

  return (
    <div className="p-06">
      <div className="panel">
        <FilterBar resultCount={meta.total}>
          <form
            onSubmit={(event) => {
              event.preventDefault();
              setParam('q', search);
            }}
            className="flex items-center"
          >
            <label htmlFor="pages-search" className="sr-only">
              Search pages
            </label>
            <input
              id="pages-search"
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search by title or path"
              className="input w-64"
            />
          </form>

          <label htmlFor="pages-status" className="sr-only">
            Filter by status
          </label>
          <select
            id="pages-status"
            className="select w-48"
            value={initialQuery.status}
            onChange={(event) => setParam('status', event.target.value || null)}
          >
            <option value="">All statuses</option>
            {statusFacets.map((facet) => (
              <option key={facet.value} value={facet.value}>
                {facet.label} ({facet.count})
              </option>
            ))}
          </select>

          <label htmlFor="pages-locale" className="sr-only">
            Filter by language
          </label>
          <select
            id="pages-locale"
            className="select w-36"
            value={initialQuery.locale}
            onChange={(event) => setParam('locale', event.target.value || null)}
          >
            <option value="">All languages</option>
            <option value="en">English</option>
            <option value="ur">Urdu</option>
          </select>

          <label className="flex items-center gap-02 text-body-compact text-content-secondary">
            <input
              type="checkbox"
              className="checkbox"
              checked={initialQuery.unpublished}
              onChange={(event) => setParam('unpublished', event.target.checked ? 'true' : null)}
            />
            Unpublished changes only
          </label>

          {initialQuery.q ||
          initialQuery.status ||
          initialQuery.locale ||
          initialQuery.unpublished ? (
            <button
              type="button"
              className="btn-ghost btn-sm"
              onClick={() => startTransition(() => router.push(pathname))}
            >
              Clear filters
            </button>
          ) : null}
        </FilterBar>

        {selected.length > 0 ? (
          <BulkActions count={selected.length} onCancel={() => setSelected([])}>
            {canPublish ? (
              <button type="button" className="text-body-compact underline underline-offset-2">
                Publish
              </button>
            ) : null}
            {canDelete ? (
              <button type="button" className="text-body-compact underline underline-offset-2">
                Delete
              </button>
            ) : null}
          </BulkActions>
        ) : null}

        <div
          className={isPending ? 'opacity-60 transition-opacity duration-fast' : undefined}
          aria-busy={isPending}
        >
          <DataTable
            caption="Pages on the corporate site"
            columns={columns}
            rows={rows}
            selectable={canPublish || canDelete}
            selectedIds={selected}
            onToggle={(id) =>
              setSelected((current) =>
                current.includes(id) ? current.filter((value) => value !== id) : [...current, id],
              )
            }
            onToggleAll={() =>
              setSelected((current) =>
                current.length === rows.length ? [] : rows.map((row) => row.id),
              )
            }
            rowHref={(row) => `/content/pages/${row.id}`}
            emptyState={
              initialQuery.q || initialQuery.status || initialQuery.locale ? (
                <EmptyState
                  title="No pages match those filters"
                  description="Try a different search term, or clear the filters to see everything."
                  action={{ label: 'Clear filters', href: pathname }}
                />
              ) : (
                <EmptyState
                  title="No pages yet"
                  description="Pages are the backbone of the corporate site. Create one to get started."
                  action={
                    canCreate ? { label: 'Create page', href: '/content/pages/new' } : undefined
                  }
                />
              )
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
    </div>
  );
}

function humanize(value: string): string {
  return value
    .toLowerCase()
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}
