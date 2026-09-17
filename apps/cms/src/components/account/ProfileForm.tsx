'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { API_URL } from '@/lib/api';

/**
 * Own-profile form.
 *
 * Only the two fields a person owns about themselves. Email address, roles and
 * account status are shown alongside as facts rather than fields, because
 * changing them is an administrative act and belongs to user administration.
 */

export interface ProfileFormProps {
  name: string;
  jobTitle: string | null;
}

export function ProfileForm({ name: initialName, jobTitle: initialJobTitle }: ProfileFormProps) {
  const router = useRouter();

  const [name, setName] = useState(initialName);
  const [jobTitle, setJobTitle] = useState(initialJobTitle ?? '');
  const [status, setStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [message, setMessage] = useState('');

  const dirty = name !== initialName || jobTitle !== (initialJobTitle ?? '');

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setStatus('saving');
    setMessage('');

    try {
      const response = await fetch(`${API_URL}/api/auth/me`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ name, jobTitle }),
      });

      const body = (await response.json()) as {
        error?: { message: string; fields?: Array<{ field: string; message: string }> };
      };

      if (!response.ok) {
        setStatus('error');
        setMessage(body.error?.fields?.[0]?.message ?? body.error?.message ?? 'Your profile could not be saved.');
        return;
      }

      setStatus('saved');
      // The header shows the name, so the whole shell is refreshed rather than
      // leaving the old one in place until the next navigation.
      router.refresh();
    } catch {
      setStatus('error');
      setMessage('We could not reach the server. Check your connection and try again.');
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-05" noValidate>
      {status === 'error' ? (
        <div className="border-s-[3px] border-status-danger bg-status-dangerSubtle px-05 py-04" role="alert">
          <p className="text-body-01 text-content-primary">{message}</p>
        </div>
      ) : null}

      <div>
        <label htmlFor="profile-name" className="field-label">
          Name
        </label>
        <input
          id="profile-name"
          value={name}
          onChange={(event) => {
            setName(event.target.value);
            setStatus('idle');
          }}
          required
          maxLength={120}
          autoComplete="name"
          className="input"
        />
        <p className="field-helper">Shown on everything you publish, review or comment on.</p>
      </div>

      <div>
        <label htmlFor="profile-job-title" className="field-label">
          Job title
        </label>
        <input
          id="profile-job-title"
          value={jobTitle}
          onChange={(event) => {
            setJobTitle(event.target.value);
            setStatus('idle');
          }}
          maxLength={120}
          autoComplete="organization-title"
          className="input"
        />
        <p className="field-helper">Optional. Used in the audit log and review queues to give your name context.</p>
      </div>

      <div className="flex items-center gap-04">
        <button type="submit" disabled={!dirty || status === 'saving'} className="btn-primary">
          {status === 'saving' ? 'Saving…' : 'Save changes'}
        </button>
        {status === 'saved' ? (
          <span className="text-body-compact text-status-success" role="status">
            Saved
          </span>
        ) : null}
      </div>
    </form>
  );
}
