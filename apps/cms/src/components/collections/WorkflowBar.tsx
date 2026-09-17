'use client';

import { formatDate } from '@cheezious/utilities';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { API_URL } from '@/lib/api';

/**
 * The workflow bar.
 *
 * Shows only the transitions this person may actually perform — the server sends
 * the list already filtered by permission, so an author never sees a Publish
 * button that would refuse them.
 *
 * Two transitions ask for something before they run: requesting changes needs a
 * reason, because "changes requested" with no note is a message an author cannot
 * act on, and scheduling needs a future time.
 */

export interface WorkflowBarProps {
  collectionPath: string;
  recordId: string;
  status: string;
  scheduledFor: string | null;
  transitions: Array<{ action: string; label: string; requires: string; tone?: string }>;
  /** Unsaved edits would not be included in a publish, so publishing is blocked. */
  dirty: boolean;
}

const NOTE_REQUIRED = new Set(['REQUEST_CHANGES']);
const NEEDS_DATE = new Set(['SCHEDULE']);

export function WorkflowBar({
  collectionPath,
  recordId,
  status,
  scheduledFor,
  transitions,
  dirty,
}: WorkflowBarProps) {
  const router = useRouter();
  const [pending, setPending] = useState<string | null>(null);
  const [prompting, setPrompting] = useState<string | null>(null);
  const [note, setNote] = useState('');
  const [when, setWhen] = useState('');
  const [error, setError] = useState('');

  async function run(action: string) {
    setPending(action);
    setError('');

    try {
      const response = await fetch(`${API_URL}/api/cms/content/${collectionPath}/${recordId}/transition`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          action,
          ...(note ? { note } : {}),
          ...(when ? { scheduledFor: new Date(when).toISOString() } : {}),
        }),
      });

      const body = (await response.json()) as {
        error?: { message: string; fields?: Array<{ field: string; message: string }> };
      };

      if (!response.ok) {
        setError(body.error?.fields?.[0]?.message ?? body.error?.message ?? 'That could not be done.');
        return;
      }

      setPrompting(null);
      setNote('');
      setWhen('');
      router.refresh();
    } catch {
      setError('We could not reach the server. Check your connection and try again.');
    } finally {
      setPending(null);
    }
  }

  function start(action: string) {
    if (NOTE_REQUIRED.has(action) || NEEDS_DATE.has(action)) {
      setPrompting(action);
      setError('');
      return;
    }
    void run(action);
  }

  return (
    <section className="panel p-06">
      <h2 className="text-heading-compact text-content-primary">Workflow</h2>

      {scheduledFor ? (
        <p className="mt-02 text-body-01 text-status-info">
          Scheduled to publish {formatDate(scheduledFor, 'en', { dateStyle: 'medium', timeStyle: 'short' })}.
        </p>
      ) : null}

      {dirty ? (
        <p className="mt-04 border-s-[3px] border-status-warning bg-status-warningSubtle px-03 py-02 text-helper-01">
          Save your changes first — a transition publishes what is stored, not what is on screen.
        </p>
      ) : null}

      {error ? (
        <p className="mt-04 border-s-[3px] border-status-danger bg-status-dangerSubtle px-03 py-02 text-helper-01" role="alert">
          {error}
        </p>
      ) : null}

      {prompting ? (
        <div className="mt-05 space-y-04">
          {NOTE_REQUIRED.has(prompting) ? (
            <div>
              <label htmlFor="workflow-note" className="field-label">
                What needs to change?
              </label>
              <textarea
                id="workflow-note"
                rows={3}
                value={note}
                onChange={(event) => setNote(event.target.value)}
                className="textarea"
                autoFocus
              />
              <p className="field-helper">The author is notified with this message.</p>
            </div>
          ) : null}

          {NEEDS_DATE.has(prompting) ? (
            <div>
              <label htmlFor="workflow-when" className="field-label">
                Publish at
              </label>
              <input
                id="workflow-when"
                type="datetime-local"
                value={when}
                onChange={(event) => setWhen(event.target.value)}
                className="input"
                autoFocus
              />
              <p className="field-helper">Your local time. The scheduler publishes within a minute of it.</p>
            </div>
          ) : null}

          <div className="flex gap-03">
            <button
              type="button"
              className="btn-primary btn-sm"
              disabled={pending !== null || (NOTE_REQUIRED.has(prompting) && !note.trim()) || (NEEDS_DATE.has(prompting) && !when)}
              onClick={() => void run(prompting)}
            >
              Confirm
            </button>
            <button type="button" className="btn-ghost btn-sm" onClick={() => setPrompting(null)}>
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <div className="mt-05 flex flex-col gap-03">
          {transitions.length === 0 ? (
            <p className="text-body-01 text-content-secondary">
              Nothing you can do here from {status.toLowerCase().replace(/_/g, ' ')}.
            </p>
          ) : (
            transitions.map((transition) => (
              <button
                key={transition.action}
                type="button"
                disabled={pending !== null || (dirty && transition.action === 'PUBLISH')}
                onClick={() => start(transition.action)}
                className={transition.action === 'PUBLISH' ? 'btn-primary justify-center' : 'btn-secondary justify-center'}
              >
                {pending === transition.action ? 'Working…' : transition.label}
              </button>
            ))
          )}
        </div>
      )}
    </section>
  );
}
