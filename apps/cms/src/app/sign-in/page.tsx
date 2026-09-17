'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { API_URL } from '@/lib/api';

/**
 * Sign-in.
 *
 * Every failure produces the same message, because the API deliberately does not
 * distinguish a wrong password from an unknown account, and the interface must
 * not undo that by being more helpful than the server.
 *
 * The `next` parameter is read from `window.location` at submit time rather than
 * with `useSearchParams`, which would opt the whole route out of server
 * rendering — a sign-in form that only appears once JavaScript has loaded is
 * slower and more fragile than it has any need to be.
 */
export default function SignInPage() {
  const router = useRouter();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [status, setStatus] = useState<'idle' | 'submitting' | 'error'>('idle');
  const [message, setMessage] = useState('');

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setStatus('submitting');
    setMessage('');

    try {
      const response = await fetch(`${API_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ email, password }),
      });

      const body = (await response.json()) as {
        error?: { message: string };
        mustChangePassword?: boolean;
      };

      if (!response.ok) {
        setStatus('error');
        // Whatever the server said, it is the same message for every failure.
        setMessage(body.error?.message ?? 'That email address and password do not match.');
        return;
      }

      // A `next` parameter could otherwise be used to bounce someone to an
      // external site after a successful sign-in, so only in-app paths are
      // honoured.
      const next = new URLSearchParams(window.location.search).get('next');
      const destination =
        body.mustChangePassword === true
          ? '/account/change-password'
          : next && next.startsWith('/') && !next.startsWith('//')
            ? next
            : '/';

      router.push(destination);
      router.refresh();
    } catch {
      setStatus('error');
      setMessage('We could not reach the server. Check your connection and try again.');
    }
  }

  return (
    <div className="flex min-h-screen">
      {/* Identity panel. Dark, quiet, no marketing. */}
      <div className="hidden w-2/5 flex-col justify-between bg-gray-100 p-09 lg:flex">
        <div className="flex items-baseline gap-02">
          <span className="text-heading-03 font-semibold text-content-inverse">Cheezious</span>
          <span className="text-label-01 uppercase tracking-wide text-gray-50">CMS</span>
        </div>

        <div>
          <p className="max-w-sm text-heading-04 text-content-inverse">
            The publishing platform behind the Cheezious corporate site.
          </p>
          <p className="mt-04 max-w-sm text-body-01 text-gray-40">
            Pages, newsroom, careers, partners and reporting — managed in one place.
          </p>
        </div>

        <p className="text-helper-01 text-gray-50">Authorised access only. Activity is logged.</p>
      </div>

      <div className="flex w-full items-center justify-center bg-surface-subtle p-05 lg:w-3/5">
        <div className="w-full max-w-sm">
          <div className="mb-07 lg:hidden">
            <span className="text-heading-03 font-semibold text-content-primary">Cheezious</span>
            <span className="ms-02 text-label-01 uppercase tracking-wide text-content-tertiary">
              CMS
            </span>
          </div>

          <h1 className="text-heading-04 text-content-primary">Sign in</h1>
          <p className="mt-02 text-body-01 text-content-secondary">
            Use your Cheezious CMS account.
          </p>

          {status === 'error' ? (
            <div
              className="mt-05 border-s-[3px] border-status-danger bg-status-dangerSubtle px-05 py-04"
              role="alert"
            >
              <p className="text-body-01 text-content-primary">{message}</p>
            </div>
          ) : null}

          <form onSubmit={handleSubmit} className="mt-06 space-y-05" noValidate>
            <div>
              <label htmlFor="email" className="field-label">
                Email address
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                required
                autoComplete="username"
                className="input"
                aria-invalid={status === 'error' ? true : undefined}
              />
            </div>

            <div>
              <label htmlFor="password" className="field-label">
                Password
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                required
                autoComplete="current-password"
                className="input"
                aria-invalid={status === 'error' ? true : undefined}
              />
            </div>

            <button
              type="submit"
              disabled={status === 'submitting'}
              className="btn-primary w-full justify-center"
            >
              {status === 'submitting' ? 'Signing in…' : 'Sign in'}
            </button>
          </form>

          <p className="mt-05 text-body-compact">
            <Link href="/forgot-password" className="text-interactive no-underline hover:underline">
              Forgotten your password?
            </Link>
          </p>

          <p className="mt-07 text-helper-01 text-content-tertiary">
            Repeated failed attempts temporarily lock the account.
          </p>
        </div>
      </div>
    </div>
  );
}
