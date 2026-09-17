'use client';

import Link from 'next/link';
import { useState } from 'react';

import { PasswordStrength, evaluatePassword } from '@/components/account/PasswordStrength';
import { API_URL } from '@/lib/api';

/**
 * Complete a password reset.
 *
 * The token stays in the URL and is never written to component state beyond
 * this submit, and the form never asks for the email address: the token already
 * identifies the account, and asking again would only invite typing one in.
 */
export function ResetPasswordForm({ token }: { token: string }) {
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [reveal, setReveal] = useState(false);
  const [status, setStatus] = useState<'idle' | 'submitting' | 'done' | 'error'>('idle');
  const [message, setMessage] = useState('');

  const mismatch = confirm.length > 0 && confirm !== password;
  const meetsLocalPolicy = evaluatePassword(password).requirements.every(
    (requirement) => requirement.met,
  );
  const canSubmit = meetsLocalPolicy && confirm.length > 0 && !mismatch && status !== 'submitting';

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setStatus('submitting');
    setMessage('');

    try {
      const response = await fetch(`${API_URL}/api/auth/password/reset`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ token, password }),
      });

      const body = (await response.json()) as {
        message?: string;
        error?: { message: string; fields?: Array<{ field: string; message: string }> };
      };

      if (!response.ok) {
        setStatus('error');
        setMessage(
          body.error?.fields?.[0]?.message ??
            body.error?.message ??
            'That reset link is invalid or has expired.',
        );
        return;
      }

      setStatus('done');
      setPassword('');
      setConfirm('');
      setMessage(body.message ?? 'Your password has been changed. Sign in with your new password.');
    } catch {
      setStatus('error');
      setMessage('We could not reach the server. Check your connection and try again.');
    }
  }

  if (status === 'done') {
    return (
      <div
        className="border-s-[3px] border-status-success bg-status-successSubtle px-05 py-04"
        role="status"
      >
        <p className="text-body-01 text-content-primary">{message}</p>
        <p className="mt-04">
          <Link href="/sign-in" className="btn-primary no-underline">
            Go to sign in
          </Link>
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-05" noValidate>
      {status === 'error' ? (
        <div
          className="border-s-[3px] border-status-danger bg-status-dangerSubtle px-05 py-04"
          role="alert"
        >
          <p className="text-body-01 text-content-primary">{message}</p>
        </div>
      ) : null}

      <div>
        <label htmlFor="reset-password" className="field-label">
          New password
        </label>
        <input
          id="reset-password"
          type={reveal ? 'text' : 'password'}
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          required
          autoComplete="new-password"
          className="input"
          aria-describedby="reset-password-strength"
        />
        <PasswordStrength value={password} id="reset-password-strength" />
      </div>

      <div>
        <label htmlFor="reset-confirm" className="field-label">
          Confirm new password
        </label>
        <input
          id="reset-confirm"
          type={reveal ? 'text' : 'password'}
          value={confirm}
          onChange={(event) => setConfirm(event.target.value)}
          required
          autoComplete="new-password"
          className="input"
          aria-invalid={mismatch ? true : undefined}
          aria-describedby={mismatch ? 'reset-confirm-error' : undefined}
        />
        {mismatch ? (
          <p id="reset-confirm-error" className="field-error">
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
        Resetting your password signs out every device that is currently signed in.
      </p>

      <button type="submit" disabled={!canSubmit} className="btn-primary w-full justify-center">
        {status === 'submitting' ? 'Changing…' : 'Change password'}
      </button>
    </form>
  );
}
