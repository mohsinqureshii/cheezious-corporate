'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { PasswordStrength, evaluatePassword } from '@/components/account/PasswordStrength';
import { API_URL } from '@/lib/api';

/**
 * Change password.
 *
 * Used both for a routine change and for the forced change an invited account
 * must complete before it can reach anything else — `forced` only changes the
 * wording and where the form sends you afterwards, never what the server
 * enforces.
 *
 * Changing a password ends every other session. That is stated up front rather
 * than discovered when a colleague's tab signs itself out.
 */

export interface ChangePasswordFormProps {
  forced?: boolean;
}

export function ChangePasswordForm({ forced = false }: ChangePasswordFormProps) {
  const router = useRouter();

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [reveal, setReveal] = useState(false);
  const [status, setStatus] = useState<'idle' | 'submitting' | 'error' | 'done'>('idle');
  const [message, setMessage] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [revoked, setRevoked] = useState(0);

  const mismatch = confirmPassword.length > 0 && confirmPassword !== newPassword;
  const meetsLocalPolicy = evaluatePassword(newPassword).requirements.every((requirement) => requirement.met);
  const canSubmit =
    currentPassword.length > 0 && meetsLocalPolicy && !mismatch && confirmPassword.length > 0 && status !== 'submitting';

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setStatus('submitting');
    setMessage('');
    setFieldErrors({});

    try {
      const response = await fetch(`${API_URL}/api/auth/password/change`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ currentPassword, newPassword }),
      });

      const body = (await response.json()) as {
        ok?: boolean;
        revokedSessions?: number;
        error?: { message: string; fields?: Array<{ field: string; message: string }> };
      };

      if (!response.ok) {
        setStatus('error');
        setFieldErrors(
          Object.fromEntries((body.error?.fields ?? []).map((error) => [error.field, error.message])),
        );
        setMessage(
          body.error?.fields?.length
            ? 'Fix the problems below and try again.'
            : (body.error?.message ?? 'The password could not be changed.'),
        );
        return;
      }

      setRevoked(body.revokedSessions ?? 0);
      setStatus('done');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');

      // The forced-change screen exists only until the change is made, so the
      // shell is reloaded rather than left showing a form that no longer applies.
      router.refresh();
      if (forced) router.push('/');
    } catch {
      setStatus('error');
      setMessage('We could not reach the server. Check your connection and try again.');
    }
  }

  if (status === 'done' && !forced) {
    return (
      <div className="border-s-[3px] border-status-success bg-status-successSubtle px-05 py-04" role="status">
        <p className="text-heading-compact text-content-primary">Your password has been changed</p>
        <p className="mt-01 text-body-01 text-content-secondary">
          {revoked > 0
            ? `${revoked} other ${revoked === 1 ? 'session was' : 'sessions were'} signed out. This one stays signed in.`
            : 'This session stays signed in.'}
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-05" noValidate>
      {status === 'error' && message ? (
        <div className="border-s-[3px] border-status-danger bg-status-dangerSubtle px-05 py-04" role="alert">
          <p className="text-body-01 text-content-primary">{message}</p>
        </div>
      ) : null}

      <div>
        <label htmlFor="current-password" className="field-label">
          Current password
        </label>
        <input
          id="current-password"
          type={reveal ? 'text' : 'password'}
          value={currentPassword}
          onChange={(event) => setCurrentPassword(event.target.value)}
          required
          autoComplete="current-password"
          autoFocus
          className="input"
          aria-invalid={fieldErrors.currentPassword ? true : undefined}
          aria-describedby={fieldErrors.currentPassword ? 'current-password-error' : undefined}
        />
        {fieldErrors.currentPassword ? (
          <p id="current-password-error" className="field-error">
            {fieldErrors.currentPassword}
          </p>
        ) : null}
      </div>

      <div>
        <label htmlFor="new-password" className="field-label">
          New password
        </label>
        <input
          id="new-password"
          type={reveal ? 'text' : 'password'}
          value={newPassword}
          onChange={(event) => setNewPassword(event.target.value)}
          required
          autoComplete="new-password"
          className="input"
          aria-invalid={fieldErrors.newPassword ? true : undefined}
          aria-describedby="new-password-strength"
        />
        <PasswordStrength value={newPassword} id="new-password-strength" />
        {fieldErrors.newPassword ? <p className="field-error">{fieldErrors.newPassword}</p> : null}
      </div>

      <div>
        <label htmlFor="confirm-password" className="field-label">
          Confirm new password
        </label>
        <input
          id="confirm-password"
          type={reveal ? 'text' : 'password'}
          value={confirmPassword}
          onChange={(event) => setConfirmPassword(event.target.value)}
          required
          autoComplete="new-password"
          className="input"
          aria-invalid={mismatch ? true : undefined}
          aria-describedby={mismatch ? 'confirm-password-error' : undefined}
        />
        {mismatch ? (
          <p id="confirm-password-error" className="field-error">
            The two passwords do not match.
          </p>
        ) : null}
      </div>

      <label className="flex items-center gap-02 text-body-compact text-content-secondary">
        <input
          type="checkbox"
          className="checkbox"
          checked={reveal}
          onChange={(event) => setReveal(event.target.checked)}
        />
        Show passwords
      </label>

      <p className="text-helper-01 text-content-tertiary">
        Changing your password signs out every other device. This one stays signed in.
      </p>

      <button type="submit" disabled={!canSubmit} className="btn-primary">
        {status === 'submitting' ? 'Changing…' : 'Change password'}
      </button>
    </form>
  );
}
