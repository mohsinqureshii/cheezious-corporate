'use client';

import { formatRelativeTime } from '@cheezious/utilities';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useState, useTransition } from 'react';

import { EmptyState, FilterBar, Pagination } from '@/components/ui';
import { API_URL } from '@/lib/api';
import type { ListMeta } from '@/lib/types';

/**
 * Content health.
 *
 * Everything the platform can tell is wrong without a person looking: a page
 * with no description, an image with no alternative text, a link to nowhere,
 * content past its review date.
 *
 * Dismissing an issue requires a reason. "We know, and here is why" is worth
 * recording — otherwise the next person re-investigates it, or the list grows
 * until nobody reads it.
 */

const TYPE_LABELS: Record<string, string> = {
  MISSING_SEO_DESCRIPTION: 'No meta description',
  MISSING_ALT_TEXT: 'Image without alternative text',
  MISSING_TRANSLATION: 'Not translated',
  BROKEN_INTERNAL_LINK: 'Link to a page that is not there',
  ORPHAN_PAGE: 'Not linked from anywhere',
  STALE_CONTENT: 'Past its review date',
  MISSING_HERO_IMAGE: 'No hero image',
  DUPLICATE_SLUG: 'Duplicate address',
  EMPTY_PAGE: 'No content',
  UNPUBLISHED_CHANGES: 'Edited but not published',
};

export interface HealthIssue {
  id: string;
  type: string;
  severity: string;
  entityType: string;
  entityId: string;
  entityLabel: string;
  locale: string;
  field: string | null;
  detail: string | null;
  href: string | null;
  detectedAt: string;
  dismissedAt: string | null;
  dismissReason: string | null;
}

export function ContentHealthList({
  items,
  meta,
  byType,
  initialQuery,
}: {
  items: HealthIssue[];
  meta: ListMeta;
  byType: Array<{ type: string; severity: string; count: number }>;
  initialQuery: { type: string; severity: string; includeDismissed: boolean };
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const [dismissing, setDismissing] = useState<string | null>(null);
  const [reason, setReason] = useState('');
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

  async function dismiss(id: string) {
    setError('');
    const response = await fetch(`${API_URL}/api/cms/structure/content-health/${id}/dismiss`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ reason }),
    });
    if (!response.ok) {
      setError('That could not be dismissed.');
      return;
    }
    setDismissing(null);
    setReason('');
    router.refresh();
  }

  const totals = byType.reduce<Record<string, number>>((accumulator, row) => {
    accumulator[row.severity] = (accumulator[row.severity] ?? 0) + row.count;
    return accumulator;
  }, {});

  return (
    <div className="p-06">
      <div className="mb-05 grid gap-04 sm:grid-cols-3">
        {(['ERROR', 'WARNING', 'INFO'] as const).map((severity) => (
          <button
            key={severity}
            type="button"
            onClick={() => setParam('severity', initialQuery.severity === severity ? null : severity)}
            className={[
              'panel p-05 text-start transition-colors duration-fast',
              initialQuery.severity === severity ? 'border-interactive' : 'hover:border-border-strong',
            ].join(' ')}
          >
            <span className="block text-heading-04 tabular text-content-primary">{totals[severity] ?? 0}</span>
            <span className="block text-body-compact text-content-secondary">
              {severity === 'ERROR' ? 'Need fixing' : severity === 'WARNING' ? 'Worth fixing' : 'Worth knowing'}
            </span>
          </button>
        ))}
      </div>

      {error ? (
        <div className="mb-05 border-s-[3px] border-status-danger bg-status-dangerSubtle px-05 py-04" role="alert">
          <p className="text-body-01 text-content-primary">{error}</p>
        </div>
      ) : null}

      <div className="panel">
        <FilterBar resultCount={meta.total}>
          <label htmlFor="health-type" className="sr-only">
            Filter by kind
          </label>
          <select
            id="health-type"
            className="select w-72"
            value={initialQuery.type}
            onChange={(event) => setParam('type', event.target.value || null)}
          >
            <option value="">Every kind of issue</option>
            {byType.map((row) => (
              <option key={row.type} value={row.type}>
                {TYPE_LABELS[row.type] ?? row.type} ({row.count})
              </option>
            ))}
          </select>

          <label className="flex items-center gap-02 text-body-compact text-content-secondary">
            <input
              type="checkbox"
              className="checkbox"
              checked={initialQuery.includeDismissed}
              onChange={(event) => setParam('includeDismissed', event.target.checked ? 'true' : null)}
            />
            Include dismissed
          </label>
        </FilterBar>

        <div className={isPending ? 'opacity-60 transition-opacity duration-fast' : undefined} aria-busy={isPending}>
          {items.length === 0 ? (
            <EmptyState
              title="Nothing to fix"
              description="Either everything checks out, or nothing matches these filters."
            />
          ) : (
            <ul className="divide-y divide-border-subtle">
              {items.map((issue) => (
                <li key={issue.id} className="px-05 py-04">
                  <div className="flex flex-wrap items-start justify-between gap-04">
                    <div className="min-w-0">
                      <p className="flex flex-wrap items-center gap-02">
                        <span
                          className={[
                            'tag',
                            issue.severity === 'ERROR'
                              ? 'bg-status-dangerSubtle text-content-primary'
                              : issue.severity === 'WARNING'
                                ? 'bg-status-warningSubtle text-content-primary'
                                : 'bg-gray-20 text-content-primary',
                          ].join(' ')}
                        >
                          {TYPE_LABELS[issue.type] ?? issue.type}
                        </span>
                        <span className="text-label-01 uppercase text-content-tertiary">{issue.locale}</span>
                      </p>

                      <p className="mt-02 text-body-compact text-content-primary">
                        {issue.href ? (
                          <Link href={issue.href} className="text-interactive no-underline hover:underline">
                            {issue.entityLabel}
                          </Link>
                        ) : (
                          issue.entityLabel
                        )}
                      </p>

                      {issue.detail ? (
                        <p className="mt-01 text-helper-01 text-content-secondary">{issue.detail}</p>
                      ) : null}

                      <p className="mt-01 text-helper-01 text-content-tertiary">
                        Found {formatRelativeTime(issue.detectedAt)}
                        {issue.dismissedAt ? ` · dismissed: ${issue.dismissReason ?? 'no reason given'}` : ''}
                      </p>
                    </div>

                    {!issue.dismissedAt ? (
                      <button type="button" className="btn-ghost btn-sm" onClick={() => setDismissing(issue.id)}>
                        Dismiss
                        <span className="sr-only"> the issue on {issue.entityLabel}</span>
                      </button>
                    ) : null}
                  </div>

                  {dismissing === issue.id ? (
                    <div className="mt-03 flex flex-wrap items-end gap-02">
                      <span className="min-w-0 flex-1">
                        <label htmlFor={`dismiss-${issue.id}`} className="field-label">
                          Why is this not a problem?
                        </label>
                        <input
                          id={`dismiss-${issue.id}`}
                          className="input"
                          value={reason}
                          onChange={(event) => setReason(event.target.value)}
                          autoFocus
                        />
                      </span>
                      <button type="button" className="btn-secondary btn-sm" disabled={!reason.trim()} onClick={() => dismiss(issue.id)}>
                        Dismiss
                      </button>
                      <button type="button" className="btn-ghost btn-sm" onClick={() => setDismissing(null)}>
                        Cancel
                      </button>
                    </div>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </div>

        {meta.total > meta.pageSize ? (
          <Pagination page={meta.page} pageSize={meta.pageSize} total={meta.total} onPageChange={(next) => setParam('page', String(next))} />
        ) : null}
      </div>
    </div>
  );
}
