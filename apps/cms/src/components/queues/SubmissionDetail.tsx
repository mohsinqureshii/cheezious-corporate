'use client';

import { formatDate, formatRelativeTime } from '@cheezious/utilities';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { StatusTag } from '@/components/ui';
import { API_URL } from '@/lib/api';
import {
  humanizeStatus,
  type QueueDescriptor,
  type SubmissionNote,
  type SubmissionRecord,
} from '@/lib/queues';

/**
 * One submission.
 *
 * Everything the sender provided, the queue's own state, and an internal
 * discussion. The three are visually separated because they answer different
 * questions — what did they say, where have we got to, what do we think — and
 * conflating them is how an internal comment ends up being read as the
 * applicant's own words.
 */

export interface SubmissionDetailProps {
  queue: QueueDescriptor;
  submission: SubmissionRecord;
  assignees: Array<{ id: string; name: string }>;
  canManage: boolean;
}

export function SubmissionDetail({
  queue,
  submission,
  assignees,
  canManage,
}: SubmissionDetailProps) {
  const router = useRouter();
  const [status, setStatus] = useState(submission.status);
  const [assigneeId, setAssigneeId] = useState(submission.assignee?.id ?? '');
  const [note, setNote] = useState('');
  const [notes, setNotes] = useState<SubmissionNote[]>(submission.notesLog ?? []);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function patch(changes: Record<string, unknown>) {
    setBusy(true);
    setError('');
    try {
      const response = await fetch(
        `${API_URL}/api/cms/submissions/${queue.path}/${submission.id}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify(changes),
        },
      );
      if (!response.ok) {
        const body = (await response.json()) as { error?: { message: string } };
        setError(body.error?.message ?? 'That change could not be saved.');
        return false;
      }
      router.refresh();
      return true;
    } catch {
      setError('We could not reach the server. Check your connection and try again.');
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function addNote(event: React.FormEvent) {
    event.preventDefault();
    if (!note.trim()) return;

    setBusy(true);
    setError('');
    try {
      const response = await fetch(
        `${API_URL}/api/cms/submissions/${queue.path}/${submission.id}/notes`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ body: note }),
        },
      );
      if (!response.ok) {
        setError('The note could not be added.');
        return;
      }
      const body = (await response.json()) as { note: SubmissionNote };
      setNotes((current) => [body.note, ...current]);
      setNote('');
    } catch {
      setError('We could not reach the server. Check your connection and try again.');
    } finally {
      setBusy(false);
    }
  }

  const title = String(submission[queue.titleField] ?? submission.reference);
  const subtitle = queue.subtitleField ? String(submission[queue.subtitleField] ?? '') : '';

  return (
    <div className="p-06">
      <div className="mb-05 flex flex-wrap items-start justify-between gap-04">
        <div>
          <p className="font-mono text-helper-01 text-content-secondary">{submission.reference}</p>
          <h1 className="mt-01 text-heading-04 text-content-primary">{title}</h1>
          {subtitle ? (
            <p className="mt-01 text-body-01 text-content-secondary">{subtitle}</p>
          ) : null}
          <p className="mt-02 text-helper-01 text-content-tertiary">
            Received{' '}
            {formatDate(submission.createdAt, 'en', { dateStyle: 'full', timeStyle: 'short' })}
          </p>
        </div>

        <Link href={queue.href} className="btn-ghost no-underline">
          Back to {queue.labelPlural.toLowerCase()}
        </Link>
      </div>

      {error ? (
        <div
          className="mb-05 border-s-[3px] border-status-danger bg-status-dangerSubtle px-05 py-04"
          role="alert"
        >
          <p className="text-body-01 text-content-primary">{error}</p>
        </div>
      ) : null}

      <div className="grid gap-06 xl:grid-cols-[minmax(0,1fr)_340px]">
        {/* --- What the sender provided ------------------------------------ */}
        <section className="panel p-06">
          <h2 className="text-heading-compact text-content-primary">Submitted details</h2>
          <p className="mt-01 text-helper-01 text-content-tertiary">
            Exactly as the sender entered them. Nothing here has been edited.
          </p>

          <dl className="mt-05 grid gap-05 sm:grid-cols-2">
            {queue.fields.map((field) => {
              const value = submission[field.name];
              if (value === null || value === undefined || value === '') return null;

              return (
                <div key={field.name} className={field.long ? 'sm:col-span-2' : undefined}>
                  <dt className="text-label-01 uppercase tracking-wide text-content-tertiary">
                    {field.label}
                  </dt>
                  <dd className="mt-01 text-body-01 text-content-primary">
                    {renderValue(value, field.type)}
                  </dd>
                </div>
              );
            })}
          </dl>

          {queue.hasAttachments ? (
            <div className="mt-06 border-t border-border-subtle pt-05">
              <h3 className="text-heading-compact text-content-primary">Attachments</h3>
              {submission.attachments && submission.attachments.length > 0 ? (
                <ul className="mt-03 space-y-02">
                  {submission.attachments.map((attachment) => (
                    <li key={attachment.id}>
                      {/* Served through the API, never from a public URL: these
                          files are personal data and every download is audited. */}
                      <a
                        href={`${API_URL}/api/cms/submissions/${queue.path}/${submission.id}/files/${attachment.id}`}
                        className="text-interactive no-underline hover:underline"
                        rel="noopener noreferrer"
                      >
                        {attachment.asset.originalName}
                      </a>
                      <span className="ms-02 text-helper-01 text-content-tertiary">
                        {formatBytes(attachment.asset.byteSize)}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-02 text-body-01 text-content-secondary">None attached.</p>
              )}
            </div>
          ) : null}
        </section>

        <div className="space-y-06">
          {/* --- Where it has got to --------------------------------------- */}
          <section className="panel p-06">
            <h2 className="text-heading-compact text-content-primary">Progress</h2>

            <div className="mt-04">
              <p className="field-label">Current status</p>
              <StatusTag status={String(status)} />
            </div>

            {canManage ? (
              <>
                <div className="mt-05">
                  <label htmlFor="submission-status" className="field-label">
                    Move to
                  </label>
                  <select
                    id="submission-status"
                    className="select"
                    value={String(status)}
                    disabled={busy}
                    onChange={async (event) => {
                      const next = event.target.value;
                      const previous = status;
                      setStatus(next);
                      if (!(await patch({ status: next }))) setStatus(previous);
                    }}
                  >
                    {queue.statuses.map((value) => (
                      <option key={value} value={value}>
                        {humanizeStatus(value)}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="mt-05">
                  <label htmlFor="submission-assignee" className="field-label">
                    Assigned to
                  </label>
                  <select
                    id="submission-assignee"
                    className="select"
                    value={assigneeId}
                    disabled={busy}
                    onChange={async (event) => {
                      const next = event.target.value;
                      const previous = assigneeId;
                      setAssigneeId(next);
                      if (!(await patch({ assigneeId: next || null }))) setAssigneeId(previous);
                    }}
                  >
                    <option value="">Unassigned</option>
                    {assignees.map((user) => (
                      <option key={user.id} value={user.id}>
                        {user.name}
                      </option>
                    ))}
                  </select>
                </div>
              </>
            ) : (
              <p className="mt-04 text-body-01 text-content-secondary">
                You can read this {queue.label.toLowerCase()} but not change its progress.
              </p>
            )}
          </section>

          {/* --- What we think --------------------------------------------- */}
          <section className="panel p-06">
            <h2 className="text-heading-compact text-content-primary">Internal notes</h2>
            <p className="mt-01 text-helper-01 text-content-tertiary">
              Only ever seen inside the CMS. Never sent to the sender and never published.
            </p>

            {canManage ? (
              <form onSubmit={addNote} className="mt-04">
                <label htmlFor="submission-note" className="sr-only">
                  Add an internal note
                </label>
                <textarea
                  id="submission-note"
                  rows={3}
                  value={note}
                  onChange={(event) => setNote(event.target.value)}
                  placeholder="Add a note for whoever picks this up next"
                  className="textarea"
                />
                <button
                  type="submit"
                  disabled={busy || !note.trim()}
                  className="btn-secondary btn-sm mt-03"
                >
                  Add note
                </button>
              </form>
            ) : null}

            {notes.length > 0 ? (
              <ul className="mt-05 space-y-04 border-t border-border-subtle pt-05">
                {notes.map((entry) => (
                  <li key={entry.id}>
                    <p className="text-helper-01 text-content-tertiary">
                      {entry.author?.name ?? 'Someone'} · {formatRelativeTime(entry.createdAt)}
                    </p>
                    <p className="mt-01 whitespace-pre-wrap text-body-01 text-content-primary">
                      {entry.body}
                    </p>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-04 text-body-01 text-content-secondary">No notes yet.</p>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}

function renderValue(value: unknown, type: string | undefined): React.ReactNode {
  if (Array.isArray(value)) return value.join(', ');
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';

  const text = String(value);

  if (type === 'email') {
    return (
      <a href={`mailto:${text}`} className="text-interactive no-underline hover:underline">
        {text}
      </a>
    );
  }
  if (type === 'phone') {
    return (
      <a
        href={`tel:${text.replace(/\s+/g, '')}`}
        className="text-interactive no-underline hover:underline"
      >
        {text}
      </a>
    );
  }
  if (type === 'url') {
    return (
      <a
        href={text}
        target="_blank"
        rel="noopener noreferrer nofollow"
        className="text-interactive no-underline hover:underline"
      >
        {text}
        <span className="sr-only"> (opens in a new tab)</span>
      </a>
    );
  }
  if (type === 'date') {
    return (
      <time dateTime={text}>
        {formatDate(text, 'en', { dateStyle: 'medium', timeStyle: 'short' })}
      </time>
    );
  }

  return <span className="whitespace-pre-wrap">{text}</span>;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
