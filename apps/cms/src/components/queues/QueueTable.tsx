'use client';

import { formatDate, formatRelativeTime } from '@cheezious/utilities';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useState, useTransition } from 'react';

import { DataTable, EmptyState, FilterBar, Pagination, StatusTag, type Column } from '@/components/ui';
import { API_URL } from '@/lib/api';
import { humanizeStatus, type QueueDescriptor, type SubmissionRecord } from '@/lib/queues';
import type { ListMeta, StatusFacet } from '@/lib/types';

/**
 * A submission queue.
 *
 * Triage view: reference, who it is from, when it arrived, where it has got to
 * and who owns it. Anything more detailed is behind the record, so a screen left
 * open on a desk does not display somebody's application in full.
 */

export interface QueueTableProps {
  queue: QueueDescriptor;
  rows: SubmissionRecord[];
  meta: ListMeta;
  statusFacets: StatusFacet[];
  initialQuery: { q: string; status: string };
  canExport: boolean;
}

export function QueueTable({ queue, rows, meta, statusFacets, initialQuery, canExport }: QueueTableProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const [search, setSearch] = useState(initialQuery.q);

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

  const listFields = queue.fields.filter((field) => field.inList);

  const columns: Column<SubmissionRecord>[] = [
    {
      key: 'reference',
      header: 'Reference',
      width: '130px',
      render: (row) => <span className="font-mono text-helper-01 text-content-secondary">{row.reference}</span>,
    },
    ...listFields.map((field) => ({
      key: field.name,
      header: field.label,
      render: (row: SubmissionRecord) => {
        const value = row[field.name];
        const text = Array.isArray(value) ? value.join(', ') : value === null || value === undefined || value === '' ? '—' : String(value);
        return (
          <span className="block max-w-xs truncate" title={text}>
            {text}
          </span>
        );
      },
    })),
    {
      key: 'createdAt',
      header: 'Received',
      width: '130px',
      render: (row) => (
        <time dateTime={row.createdAt} title={formatDate(row.createdAt, 'en', { dateStyle: 'full', timeStyle: 'short' })}>
          {formatRelativeTime(row.createdAt)}
        </time>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      width: '150px',
      render: (row) => <StatusTag status={row.status} size="sm" />,
    },
    {
      key: 'assignee',
      header: 'Assigned to',
      width: '150px',
      render: (row) => (
        <span className={row.assignee ? 'text-content-secondary' : 'text-content-tertiary'}>
          {row.assignee?.name ?? 'Unassigned'}
        </span>
      ),
    },
    {
      key: 'actions',
      header: 'Actions',
      align: 'end',
      width: '90px',
      render: (row) => (
        <Link href={`${queue.href}/${row.id}`} className="text-interactive no-underline hover:underline">
          Review
          <span className="sr-only"> {row.reference}</span>
        </Link>
      ),
    },
  ];

  const filtered = Boolean(initialQuery.q || initialQuery.status);

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
            <label htmlFor="queue-search" className="sr-only">
              Search {queue.labelPlural.toLowerCase()}
            </label>
            <input
              id="queue-search"
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder={queue.searchPlaceholder}
              className="input w-72"
            />
          </form>

          <label htmlFor="queue-status" className="sr-only">
            Filter by status
          </label>
          <select
            id="queue-status"
            className="select w-48"
            value={initialQuery.status}
            onChange={(event) => setParam('status', event.target.value || null)}
          >
            <option value="">All statuses</option>
            {statusFacets.map((facet) => (
              <option key={facet.value} value={facet.value}>
                {humanizeStatus(facet.value)} ({facet.count})
              </option>
            ))}
          </select>

          {filtered ? (
            <button type="button" className="btn-ghost btn-sm" onClick={() => startTransition(() => router.push(pathname))}>
              Clear filters
            </button>
          ) : null}

          {canExport ? (
            // Export is a separate, higher-risk permission: pulling a queue in
            // bulk is a different act from reviewing one record, and is audited
            // with the row count.
            <a
              href={`${API_URL}/api/cms/submissions/${queue.path}/export${
                searchParams.toString() ? `?${searchParams.toString()}` : ''
              }`}
              className="btn-ghost btn-sm ms-auto no-underline"
            >
              Export CSV
              <span className="sr-only"> — downloads personal data and is recorded in the audit log</span>
            </a>
          ) : null}
        </FilterBar>

        <div className={isPending ? 'opacity-60 transition-opacity duration-fast' : undefined} aria-busy={isPending}>
          <DataTable
            caption={queue.labelPlural}
            columns={columns}
            rows={rows}
            rowHref={(row) => `${queue.href}/${row.id}`}
            emptyState={
              <EmptyState
                title={filtered ? 'Nothing matches those filters' : `No ${queue.labelPlural.toLowerCase()} yet`}
                description={
                  filtered
                    ? 'Try a different search term, or clear the filters.'
                    : 'Submissions from the public site appear here as they arrive.'
                }
                action={filtered ? { label: 'Clear filters', href: pathname } : undefined}
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

      <p className="mt-04 max-w-2xl text-helper-01 text-content-tertiary">{queue.privacyNote}</p>
    </div>
  );
}
