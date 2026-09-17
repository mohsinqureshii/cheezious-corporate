'use client';

import { formatDate } from '@cheezious/utilities';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useState, useTransition } from 'react';

import { DataTable, EmptyState, FilterBar, Pagination, type Column } from '@/components/ui';
import type { ListMeta } from '@/lib/types';

/**
 * The audit log.
 *
 * Append-only and read-only: nothing in the CMS can edit or remove an entry,
 * which is the only property that makes it worth keeping.
 *
 * Changes are recorded as a field-level diff with personal data redacted — an
 * entry says that an applicant's email changed, never what it changed to. The
 * row expands to show that diff rather than putting it in a column nobody can
 * read.
 */

export interface AuditRow {
  id: string;
  action: string;
  entityType: string;
  entityId: string | null;
  entityLabel: string | null;
  summary: string | null;
  changes: Record<string, { from: unknown; to: unknown }> | null;
  actorEmail: string | null;
  ipAddress: string | null;
  createdAt: string;
  actor: { id: string; name: string; email: string } | null;
}

export interface AuditTableProps {
  rows: AuditRow[];
  meta: ListMeta;
  actionFacets: Array<{ value: string; count: number }>;
  initialQuery: { q: string; action: string; entityType: string; from: string; to: string };
}

export function AuditTable({ rows, meta, actionFacets, initialQuery }: AuditTableProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const [search, setSearch] = useState(initialQuery.q);
  const [expanded, setExpanded] = useState<string | null>(null);

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

  const columns: Column<AuditRow>[] = [
    {
      key: 'createdAt',
      header: 'When',
      width: '170px',
      render: (row) => (
        <time dateTime={row.createdAt} className="tabular">
          {formatDate(row.createdAt, 'en', { dateStyle: 'medium', timeStyle: 'medium' })}
        </time>
      ),
    },
    {
      key: 'actor',
      header: 'Who',
      width: '20%',
      render: (row) => (
        <span>
          <span className="block text-content-primary">{row.actor?.name ?? 'System'}</span>
          <span className="block truncate text-helper-01 text-content-tertiary">
            {row.actorEmail ?? '—'}
            {row.ipAddress ? ` · ${row.ipAddress}` : ''}
          </span>
        </span>
      ),
    },
    {
      key: 'action',
      header: 'Action',
      width: '160px',
      render: (row) => (
        <span className="tag bg-gray-20 text-content-primary">{humanize(row.action)}</span>
      ),
    },
    {
      key: 'entity',
      header: 'What',
      render: (row) => (
        <span className="block max-w-sm truncate" title={row.entityLabel ?? row.entityType}>
          <span className="text-content-primary">{row.entityLabel ?? '—'}</span>
          <span className="ms-02 text-helper-01 text-content-tertiary">{row.entityType}</span>
        </span>
      ),
    },
    {
      key: 'summary',
      header: 'Detail',
      render: (row) => (
        <span className="block max-w-md">
          <span className="block truncate text-content-secondary" title={row.summary ?? ''}>
            {row.summary ?? '—'}
          </span>
          {row.changes && Object.keys(row.changes).length > 0 ? (
            <button
              type="button"
              onClick={() => setExpanded(expanded === row.id ? null : row.id)}
              className="mt-01 text-helper-01 text-interactive underline underline-offset-2"
              aria-expanded={expanded === row.id}
            >
              {expanded === row.id
                ? 'Hide changes'
                : `${Object.keys(row.changes).length} field(s) changed`}
            </button>
          ) : null}
          {expanded === row.id && row.changes ? (
            <dl className="mt-02 space-y-01 border-s-[3px] border-border-subtle ps-03">
              {Object.entries(row.changes).map(([field, change]) => (
                <div key={field}>
                  <dt className="font-mono text-helper-01 text-content-tertiary">{field}</dt>
                  <dd className="text-helper-01 text-content-secondary">
                    <span className="line-through">{render(change.from)}</span>
                    {' → '}
                    <span className="text-content-primary">{render(change.to)}</span>
                  </dd>
                </div>
              ))}
            </dl>
          ) : null}
        </span>
      ),
    },
  ];

  const filtered = Boolean(
    initialQuery.q ||
    initialQuery.action ||
    initialQuery.entityType ||
    initialQuery.from ||
    initialQuery.to,
  );

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
            <label htmlFor="audit-search" className="sr-only">
              Search the audit log
            </label>
            <input
              id="audit-search"
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search by what, who or summary"
              className="input w-72"
            />
          </form>

          <label htmlFor="audit-action" className="sr-only">
            Filter by action
          </label>
          <select
            id="audit-action"
            className="select w-52"
            value={initialQuery.action}
            onChange={(event) => setParam('action', event.target.value || null)}
          >
            <option value="">All actions</option>
            {actionFacets.map((facet) => (
              <option key={facet.value} value={facet.value}>
                {humanize(facet.value)} ({facet.count})
              </option>
            ))}
          </select>

          <label htmlFor="audit-from" className="sr-only">
            From date
          </label>
          <input
            id="audit-from"
            type="date"
            className="input w-40"
            value={initialQuery.from}
            onChange={(event) => setParam('from', event.target.value || null)}
          />

          <label htmlFor="audit-to" className="sr-only">
            To date
          </label>
          <input
            id="audit-to"
            type="date"
            className="input w-40"
            value={initialQuery.to}
            onChange={(event) => setParam('to', event.target.value || null)}
          />

          {filtered ? (
            <button
              type="button"
              className="btn-ghost btn-sm"
              onClick={() => startTransition(() => router.push(pathname))}
            >
              Clear filters
            </button>
          ) : null}
        </FilterBar>

        <div
          className={isPending ? 'opacity-60 transition-opacity duration-fast' : undefined}
          aria-busy={isPending}
        >
          <DataTable
            caption="Audit log"
            columns={columns}
            rows={rows}
            emptyState={
              <EmptyState
                title="Nothing recorded for those filters"
                description="Try widening the date range or clearing the filters."
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

      <p className="mt-04 max-w-2xl text-helper-01 text-content-tertiary">
        Entries are never edited or removed, and personal data is recorded as having changed rather
        than as what it changed to.
      </p>
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

function render(value: unknown): string {
  if (value === null || value === undefined) return 'empty';
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}
