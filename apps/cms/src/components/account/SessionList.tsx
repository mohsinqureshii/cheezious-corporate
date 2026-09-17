'use client';

import { formatDate, formatRelativeTime } from '@cheezious/utilities';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { EmptyState } from '@/components/ui';
import { API_URL } from '@/lib/api';

/**
 * Active sessions.
 *
 * The point of this screen is to be able to end a session you do not recognise,
 * so each row carries the three things that make one identifiable — device,
 * network and when it was last used — and the current one is labelled so it is
 * never ended by accident.
 */

export interface SessionRow {
  id: string;
  userAgent: string | null;
  ipAddress: string | null;
  createdAt: string;
  lastActiveAt: string;
  expiresAt: string;
  isCurrent: boolean;
}

export function SessionList({ sessions: initial }: { sessions: SessionRow[] }) {
  const router = useRouter();
  const [sessions, setSessions] = useState(initial);
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState('');

  async function revoke(id: string) {
    setPending(id);
    setError('');
    try {
      const response = await fetch(`${API_URL}/api/auth/sessions/${id}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      if (!response.ok) {
        setError('That session could not be ended. Reload and try again.');
        return;
      }
      setSessions((current) => current.filter((session) => session.id !== id));
      router.refresh();
    } catch {
      setError('We could not reach the server. Check your connection and try again.');
    } finally {
      setPending(null);
    }
  }

  if (sessions.length === 0) {
    return <EmptyState title="No active sessions" description="Nothing is signed in right now." />;
  }

  return (
    <div className="space-y-04">
      {error ? (
        <div
          className="border-s-[3px] border-status-danger bg-status-dangerSubtle px-05 py-04"
          role="alert"
        >
          <p className="text-body-01 text-content-primary">{error}</p>
        </div>
      ) : null}

      <ul className="divide-y divide-border-subtle border border-border-subtle bg-surface-base">
        {sessions.map((session) => (
          <li
            key={session.id}
            className="flex flex-wrap items-start justify-between gap-04 px-05 py-04"
          >
            <div className="min-w-0">
              <p className="flex items-center gap-02 text-body-compact text-content-primary">
                {describeDevice(session.userAgent)}
                {session.isCurrent ? <span className="tag">This device</span> : null}
              </p>
              <p className="mt-01 text-helper-01 text-content-secondary">
                {session.ipAddress ? `${session.ipAddress} · ` : ''}
                Last active {formatRelativeTime(session.lastActiveAt)}
              </p>
              <p className="mt-01 text-helper-01 text-content-tertiary">
                Signed in{' '}
                {formatDate(session.createdAt, 'en', { dateStyle: 'medium', timeStyle: 'short' })} ·
                expires{' '}
                {formatDate(session.expiresAt, 'en', { dateStyle: 'medium', timeStyle: 'short' })}
              </p>
            </div>

            {session.isCurrent ? null : (
              <button
                type="button"
                onClick={() => revoke(session.id)}
                disabled={pending === session.id}
                className="btn-danger btn-sm"
              >
                {pending === session.id ? 'Ending…' : 'End session'}
                <span className="sr-only"> on {describeDevice(session.userAgent)}</span>
              </button>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * A readable device name from a user agent.
 *
 * Deliberately coarse. A precise parse would be a dependency and a maintenance
 * burden for a string that only needs to help someone recognise their own
 * laptop.
 */
function describeDevice(userAgent: string | null): string {
  if (!userAgent) return 'Unknown device';

  const browser = /Edg\//.test(userAgent)
    ? 'Edge'
    : /Chrome\//.test(userAgent)
      ? 'Chrome'
      : /Safari\//.test(userAgent)
        ? 'Safari'
        : /Firefox\//.test(userAgent)
          ? 'Firefox'
          : 'Browser';

  const platform = /iPhone|iPad/.test(userAgent)
    ? 'iOS'
    : /Android/.test(userAgent)
      ? 'Android'
      : /Mac OS X/.test(userAgent)
        ? 'macOS'
        : /Windows/.test(userAgent)
          ? 'Windows'
          : /Linux/.test(userAgent)
            ? 'Linux'
            : 'Unknown platform';

  return `${browser} on ${platform}`;
}
