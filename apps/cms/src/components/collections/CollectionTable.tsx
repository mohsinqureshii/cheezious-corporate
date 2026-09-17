'use client';

import { formatRelativeTime } from '@cheezious/utilities';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useState, useTransition } from 'react';

import {
  DataTable,
  EmptyState,
  FilterBar,
  Pagination,
  StatusTag,
  UnpublishedChangesTag,
  type Column,
} from '@/components/ui';
import { collectionHref, displayValue, type CollectionDescriptor, type RecordRow } from '@/lib/collections';
import type { ListMeta, StatusFacet } from '@/lib/types';

/**
 * A collection list.
 *
 * The columns come from the collection's own field description — anything marked
 * `inList` — plus the state columns every collection has. Filters live in the
 * URL so a filtered view is a shareable link.
 */

export interface CollectionTableProps {
  collection: CollectionDescriptor;
  rows: RecordRow[];
  meta: ListMeta;
  statusFacets: StatusFacet[];
  canCreate: boolean;
  initialQuery: { q: string; status: string; locale: string; published: string };
}

export function CollectionTable({
  collection,
  rows,
  meta,
  statusFacets,
  canCreate,
  initialQuery,
}: CollectionTableProps) {
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

  const listFields = collection.fields.filter((field) => field.inList);

  const columns: Column<RecordRow>[] = [
    ...listFields.map((field) => ({
      key: field.name,
      header: field.label,
      render: (row: RecordRow) => (
        <span className="block max-w-xs truncate" title={displayValue(row, field)}>
          {displayValue(row, field)}
        </span>
      ),
    })),

    ...(collection.workflow
      ? [
          {
            key: 'status',
            header: 'Status',
            width: '180px',
            render: (row: RecordRow) => (
              <span className="flex flex-wrap items-center gap-02">
                <StatusTag status={String(row.status)} size="sm" />
                {row.hasUnpublishedChanges === true && row.status === 'PUBLISHED' ? <UnpublishedChangesTag /> : null}
              </span>
            ),
          } satisfies Column<RecordRow>,
        ]
      : []),

    {
      key: 'updatedAt',
      header: 'Updated',
      width: '140px',
      render: (row: RecordRow) =>
        typeof row.updatedAt === 'string' ? (
          <time dateTime={row.updatedAt}>{formatRelativeTime(row.updatedAt)}</time>
        ) : (
          <span className="text-content-tertiary">—</span>
        ),
    },
    {
      key: 'actions',
      header: 'Actions',
      align: 'end',
      width: '90px',
      render: (row: RecordRow) => (
        <Link href={collectionHref(collection.path, row.id)} className="text-interactive no-underline hover:underline">
          Edit
          <span className="sr-only"> {String(row[collection.labelField] ?? '')}</span>
        </Link>
      ),
    },
  ];

  const filtered = Boolean(initialQuery.q || initialQuery.status || initialQuery.locale || initialQuery.published);

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
            <label htmlFor="collection-search" className="sr-only">
              Search {collection.labelPlural.toLowerCase()}
            </label>
            <input
              id="collection-search"
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder={`Search ${collection.labelPlural.toLowerCase()}`}
              className="input w-64"
            />
          </form>

          {collection.workflow ? (
            <>
              <label htmlFor="collection-status" className="sr-only">
                Filter by status
              </label>
              <select
                id="collection-status"
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
            </>
          ) : null}

          {collection.publishFlag ? (
            <>
              <label htmlFor="collection-published" className="sr-only">
                Filter by published state
              </label>
              <select
                id="collection-published"
                className="select w-44"
                value={initialQuery.published}
                onChange={(event) => setParam('published', event.target.value || null)}
              >
                <option value="">Published and not</option>
                <option value="true">Published only</option>
                <option value="false">Not published</option>
              </select>
            </>
          ) : null}

          {collection.localized ? (
            <>
              <label htmlFor="collection-locale" className="sr-only">
                Filter by language
              </label>
              <select
                id="collection-locale"
                className="select w-36"
                value={initialQuery.locale}
                onChange={(event) => setParam('locale', event.target.value || null)}
              >
                <option value="">All languages</option>
                <option value="en">English</option>
                <option value="ur">Urdu</option>
              </select>
            </>
          ) : null}

          {filtered ? (
            <button type="button" className="btn-ghost btn-sm" onClick={() => startTransition(() => router.push(pathname))}>
              Clear filters
            </button>
          ) : null}
        </FilterBar>

        <div className={isPending ? 'opacity-60 transition-opacity duration-fast' : undefined} aria-busy={isPending}>
          <DataTable
            caption={collection.labelPlural}
            columns={columns}
            rows={rows}
            rowHref={(row) => collectionHref(collection.path, row.id)}
            emptyState={
              filtered ? (
                <EmptyState
                  title={`No ${collection.labelPlural.toLowerCase()} match those filters`}
                  description="Try a different search term, or clear the filters to see everything."
                  action={{ label: 'Clear filters', href: pathname }}
                />
              ) : (
                <EmptyState
                  title={`No ${collection.labelPlural.toLowerCase()} yet`}
                  description={`Nothing has been created here.`}
                  action={canCreate ? { label: `Create ${collection.label.toLowerCase()}`, href: `${pathname}/new` } : undefined}
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
