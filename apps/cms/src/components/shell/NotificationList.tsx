'use client';

import { formatRelativeTime } from '@cheezious/utilities';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { EmptyState } from '@/components/ui';
import { API_URL } from '@/lib/api';

/**
 * Notifications.
 *
 * An editorial workflow generates traffic — sent for review, changes requested,
 * published, publish failed — and this is where it lands. Unread items are
 * marked by a rule down the leading edge rather than a coloured background, so a
 * long list stays readable.
 *
 * Opening a notification marks it read. Nothing is deleted: the record of what
 * someone was told is part of the audit trail.
 */

export interface NotificationRow {
  id: string;
  kind: string;
  title: string;
  body: string | null;
  href: string | null;
  createdAt: string;
  readAt: string | null;
}

const KIND_LABELS: Record<string, string> = {
  SUBMITTED_FOR_REVIEW: 'Sent for review',
  CHANGES_REQUESTED: 'Changes requested',
  APPROVED: 'Approved',
  SCHEDULED: 'Scheduled',
  PUBLISHED: 'Published',
  PUBLISH_FAILED: 'Publish failed',
  TRANSLATION_OUTDATED: 'Translation outdated',
  SUBMISSION_ASSIGNED: 'Assigned to you',
  MENTION: 'Mentioned you',
};

export function NotificationList({ notifications: initial }: { notifications: NotificationRow[] }) {
  const router = useRouter();
  const [notifications, setNotifications] = useState(initial);
  const [busy, setBusy] = useState(false);

  const unread = notifications.filter((notification) => notification.readAt === null);

  async function markRead(ids?: string[]) {
    setBusy(true);
    const readAt = new Date().toISOString();
    try {
      const response = await fetch(`${API_URL}/api/cms/system/notifications/read`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        ...(ids ? { body: JSON.stringify({ ids }) } : { body: JSON.stringify({}) }),
      });
      if (!response.ok) return;

      setNotifications((current) =>
        current.map((notification) =>
          (ids ? ids.includes(notification.id) : true) && notification.readAt === null
            ? { ...notification, readAt }
            : notification,
        ),
      );
      // The header badge is rendered by the shell, so it has to be refetched.
      router.refresh();
    } catch {
      // A failed mark-as-read is not worth interrupting anyone for; the next
      // load will show the true state.
    } finally {
      setBusy(false);
    }
  }

  if (notifications.length === 0) {
    return (
      <EmptyState
        title="Nothing waiting"
        description="Review requests, approvals and publishing results appear here."
      />
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between border-b border-border-subtle px-05 py-03">
        <p className="text-body-compact text-content-secondary">
          {unread.length > 0 ? `${unread.length} unread` : 'All caught up'}
        </p>
        {unread.length > 0 ? (
          <button
            type="button"
            onClick={() => markRead()}
            disabled={busy}
            className="btn-ghost btn-sm"
          >
            Mark all as read
          </button>
        ) : null}
      </div>

      <ul className="divide-y divide-border-subtle">
        {notifications.map((notification) => {
          const isUnread = notification.readAt === null;
          const content = (
            <>
              <div className="flex flex-wrap items-baseline gap-02">
                <span className="text-label-01 uppercase tracking-wide text-content-tertiary">
                  {KIND_LABELS[notification.kind] ?? notification.kind}
                </span>
                <time
                  dateTime={notification.createdAt}
                  className="text-helper-01 text-content-tertiary"
                >
                  {formatRelativeTime(notification.createdAt)}
                </time>
              </div>
              <p className="mt-01 text-body-compact text-content-primary">{notification.title}</p>
              {notification.body ? (
                <p className="mt-01 text-helper-01 text-content-secondary">{notification.body}</p>
              ) : null}
            </>
          );

          return (
            <li
              key={notification.id}
              className={[
                'border-s-[3px] px-05 py-04',
                isUnread
                  ? 'border-interactive bg-surface-base'
                  : 'border-transparent bg-surface-base',
              ].join(' ')}
            >
              {notification.href ? (
                <Link
                  href={notification.href}
                  onClick={() => (isUnread ? markRead([notification.id]) : undefined)}
                  className="block no-underline"
                >
                  {content}
                </Link>
              ) : (
                content
              )}

              {isUnread ? (
                <button
                  type="button"
                  onClick={() => markRead([notification.id])}
                  disabled={busy}
                  className="mt-02 text-helper-01 text-interactive underline underline-offset-2"
                >
                  Mark as read
                  <span className="sr-only">: {notification.title}</span>
                </button>
              ) : null}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
