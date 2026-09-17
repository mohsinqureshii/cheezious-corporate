import { formatDate, formatRelativeTime } from '@cheezious/utilities';
import Link from 'next/link';

import { EmptyState, StatusTag, UnpublishedChangesTag } from '@/components/ui';

/**
 * A list of content waiting on someone.
 *
 * Used by every Overview screen, because "my drafts", "waiting for review" and
 * "publishing this week" are the same list answering different questions. Each
 * row carries the two facts that decide whether to open it: where it is in the
 * workflow, and how long it has been sitting there.
 */

export interface WorkItem {
  id: string;
  title: string;
  path?: string;
  locale?: string;
  status: string;
  hasUnpublishedChanges?: boolean;
  publishedAt?: string | null;
  scheduledFor?: string | null;
  updatedAt?: string;
  updatedBy?: { id: string; name: string } | null;
  createdBy?: { id: string; name: string } | null;
}

export function WorkList({
  items,
  emptyTitle,
  emptyDescription,
  showScheduled = false,
}: {
  items: WorkItem[];
  emptyTitle: string;
  emptyDescription: string;
  showScheduled?: boolean;
}) {
  if (items.length === 0) {
    return <EmptyState title={emptyTitle} description={emptyDescription} />;
  }

  return (
    <ul className="divide-y divide-border-subtle">
      {items.map((item) => (
        <li key={item.id} className="px-05 py-04">
          <div className="flex flex-wrap items-start justify-between gap-04">
            <div className="min-w-0">
              <Link
                href={`/content/pages/${item.id}`}
                className="text-body-compact text-interactive no-underline hover:underline"
              >
                {item.title}
              </Link>
              {item.path ? (
                <p className="mt-01 truncate font-mono text-helper-01 text-content-tertiary">
                  {item.path}
                </p>
              ) : null}
            </div>

            <div className="flex flex-wrap items-center gap-02">
              <StatusTag status={item.status} size="sm" />
              {item.hasUnpublishedChanges && item.status === 'PUBLISHED' ? (
                <UnpublishedChangesTag />
              ) : null}
              {item.locale ? (
                <span className="text-label-01 uppercase text-content-tertiary">{item.locale}</span>
              ) : null}
            </div>
          </div>

          <p className="mt-02 text-helper-01 text-content-secondary">
            {showScheduled && item.scheduledFor ? (
              <>
                Publishes{' '}
                <time dateTime={item.scheduledFor}>
                  {formatDate(item.scheduledFor, 'en', { dateStyle: 'medium', timeStyle: 'short' })}
                </time>
              </>
            ) : item.updatedAt ? (
              <>
                Last edited{' '}
                <time dateTime={item.updatedAt}>{formatRelativeTime(item.updatedAt)}</time>
                {item.updatedBy ? ` by ${item.updatedBy.name}` : ''}
              </>
            ) : null}
          </p>
        </li>
      ))}
    </ul>
  );
}

/** A titled group of work, with its own count. */
export function WorkSection({
  title,
  description,
  items,
  emptyTitle,
  emptyDescription,
  showScheduled,
}: {
  title: string;
  description?: string;
  items: WorkItem[];
  emptyTitle: string;
  emptyDescription: string;
  showScheduled?: boolean;
}) {
  return (
    <section className="panel">
      <div className="flex flex-wrap items-baseline justify-between gap-03 border-b border-border-subtle px-05 py-04">
        <div>
          <h2 className="text-heading-compact text-content-primary">{title}</h2>
          {description ? (
            <p className="mt-01 text-helper-01 text-content-secondary">{description}</p>
          ) : null}
        </div>
        <span className="text-body-compact tabular text-content-secondary">{items.length}</span>
      </div>

      <WorkList
        items={items}
        emptyTitle={emptyTitle}
        emptyDescription={emptyDescription}
        showScheduled={showScheduled}
      />
    </section>
  );
}
