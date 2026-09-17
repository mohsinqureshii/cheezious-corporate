'use client';

import { useState } from 'react';

import { API_URL } from '@/lib/api';

/**
 * Request a password reset.
 *
 * The response is identical whether or not the address has an account, and the
 * interface repeats that wording exactly — an "unknown address" message here
 * would hand an attacker a list of who works here.
 */
export function ForgotPasswordForm() {
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<'idle' | 'submitting' | 'sent' | 'error'>('idle');
  const [message, setMessage] = useState('');

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setStatus('submitting');
    setMessage('');

    try {
      const response = await fetch(`${API_URL}/api/auth/password/forgot`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ email }),
      });

      const body = (await response.json()) as { message?: string; error?: { message: string } };

      if (!response.ok) {
        setStatus('error');
        setMessage(body.error?.message ?? 'That request could not be completed. Try again shortly.');
        return;
      }

      setStatus('sent');
      setMessage(body.message ?? 'If that email address has an account, a reset link is on its way.');
    } catch {
      setStatus('error');
      setMessage('We could not reach the server. Check your connection and try again.');
    }
  }

  if (status === 'sent') {
    return (
      <div className="border-s-[3px] border-status-success bg-status-successSubtle px-05 py-04" role="status">
        <p className="text-body-01 text-content-primary">{message}</p>
        <p className="mt-02 text-helper-01 text-content-secondary">
          The link expires shortly after it is issued. Request another if it has.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-05" noValidate>
      {status === 'error' ? (
        <div className="border-s-[3px] border-status-danger bg-status-dangerSubtle px-05 py-04" role="alert">
          <p className="text-body-01 text-content-primary">{message}</p>
        </div>
      ) : null}

      <div>
        <label htmlFor="forgot-email" className="field-label">
          Email address
        </label>
        <input
          id="forgot-email"
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          required
          autoComplete="username"
          autoFocus
          className="input"
        />
      </div>

      <button type="submit" disabled={status === 'submitting'} className="btn-primary w-full justify-center">
        {status === 'submitting' ? 'Sending…' : 'Send reset link'}
      </button>
    </form>
  );
}
