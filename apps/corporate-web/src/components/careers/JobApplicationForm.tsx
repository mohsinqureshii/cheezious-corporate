'use client';

import type { Locale } from '@cheezious/config';
import { useId, useRef, useState } from 'react';

import { apiOrigin } from '@/lib/urls';

/**
 * Job application form.
 *
 * Posts a multipart request to the backend, which is where every check that
 * matters happens: file type verified by magic bytes, size limits, consent,
 * whether the role is still open, rate limiting and duplicate detection. Nothing
 * here is a security control — this exists to make the process clear and to
 * report the server's answer properly.
 *
 * Client-side file checking is included anyway, because telling someone their
 * 30 MB file is too large before a two-minute upload is basic courtesy.
 */

const MAX_FILE_MB = 10;
const ACCEPTED_TYPES = [
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
];

export interface JobApplicationFormProps {
  locale: Locale;
  jobSlug: string;
  jobTitle: string;
  fields?: Array<{
    name: string;
    label: string;
    type: string;
    isRequired: boolean;
    helpText?: string | null;
  }>;
  submitLabel?: string;
  successMessage?: string;
  privacyPath: string;
}

interface FieldError {
  field: string;
  message: string;
}

export function JobApplicationForm({
  locale,
  jobSlug,
  jobTitle,
  submitLabel = 'Submit application',
  successMessage,
  privacyPath,
}: JobApplicationFormProps) {
  const formId = useId();
  const mountedAt = useRef(Date.now());
  const errorSummaryRef = useRef<HTMLDivElement>(null);

  const [status, setStatus] = useState<'idle' | 'submitting' | 'success' | 'error'>('idle');
  const [errors, setErrors] = useState<FieldError[]>([]);
  const [message, setMessage] = useState('');
  const [reference, setReference] = useState<string | null>(null);
  const [isDuplicate, setIsDuplicate] = useState(false);
  const [fileError, setFileError] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);

  function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    setFileError(null);
    setFileName(file?.name ?? null);
    if (!file) return;

    if (file.size > MAX_FILE_MB * 1024 * 1024) {
      setFileError(
        `That file is ${(file.size / 1024 / 1024).toFixed(1)} MB. The limit is ${MAX_FILE_MB} MB.`,
      );
      return;
    }
    if (!ACCEPTED_TYPES.includes(file.type)) {
      setFileError('Attach a PDF or Word document.');
    }
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (fileError) return;

    setStatus('submitting');
    setErrors([]);

    const form = event.currentTarget;
    const formData = new FormData(form);
    formData.set('consent', String(formData.get('consent') === 'on'));
    formData.set('elapsedMs', String(Date.now() - mountedAt.current));

    try {
      const response = await fetch(
        `${apiOrigin()}/api/public/${locale}/jobs/${encodeURIComponent(jobSlug)}/apply`,
        { method: 'POST', body: formData },
      );

      const body = (await response.json()) as {
        ok?: boolean;
        reference?: string;
        message?: string;
        duplicate?: boolean;
        error?: { message: string; fields?: FieldError[] };
      };

      if (!response.ok) {
        setStatus('error');
        setErrors(body.error?.fields ?? []);
        setMessage(
          body.error?.message ?? 'We could not submit your application. Please try again.',
        );
        // Focus the summary so the failure is announced rather than silently
        // appearing above the fold.
        requestAnimationFrame(() => errorSummaryRef.current?.focus());
        return;
      }

      setStatus('success');
      setReference(body.reference ?? null);
      setIsDuplicate(body.duplicate === true);
      setMessage(body.message ?? successMessage ?? 'Your application has been received.');
    } catch {
      setStatus('error');
      setMessage('We could not reach the server. Check your connection and try again.');
      requestAnimationFrame(() => errorSummaryRef.current?.focus());
    }
  }

  if (status === 'success') {
    return (
      <div
        className="border-s-2 border-signal-success bg-paper-raised p-8"
        role="status"
        aria-live="polite"
      >
        <h3 className="text-heading-md text-ink">
          {isDuplicate ? 'You have already applied' : 'Application received'}
        </h3>
        <p className="mt-3 max-w-prose text-body-md text-ink-soft">{message}</p>
        {reference ? (
          <div className="mt-6 border-t border-ink-line pt-5">
            <p className="text-body-sm text-ink-muted">Your reference</p>
            <p className="mt-1 text-heading-md tabular-nums text-ink">{reference}</p>
            <p className="mt-3 text-body-sm text-ink-muted">
              Keep this reference. Quote it if you contact us about your application for {jobTitle}.
            </p>
          </div>
        ) : null}
      </div>
    );
  }

  const errorFor = (name: string) => errors.find((error) => error.field === name)?.message;
  const inputClass = (name: string) =>
    [
      'w-full rounded border bg-paper-raised px-4 py-3 text-body-md text-ink',
      'transition-colors duration-quick placeholder:text-ink-faint',
      errorFor(name) ? 'border-signal-danger' : 'border-ink-line focus:border-ink',
    ].join(' ');

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-8">
      {status === 'error' ? (
        <div
          ref={errorSummaryRef}
          tabIndex={-1}
          role="alert"
          aria-live="assertive"
          className="border-s-2 border-signal-danger bg-paper-raised p-5 focus:outline-none"
        >
          <p className="text-body-md font-semibold text-ink">{message}</p>
          {errors.length > 0 ? (
            <ul className="mt-3 space-y-1.5">
              {errors.map((error) => (
                <li key={`${error.field}-${error.message}`} className="text-body-sm text-ink-soft">
                  <a href={`#${formId}-${error.field}`} className="underline underline-offset-2">
                    {error.message}
                  </a>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}

      <fieldset className="space-y-6">
        <legend className="sr-only">About you</legend>

        <div className="grid gap-x-gutter gap-y-6 sm:grid-cols-2">
          <div>
            <label
              htmlFor={`${formId}-firstName`}
              className="block text-body-sm font-medium text-ink"
            >
              First name <RequiredMark />
            </label>
            <input
              id={`${formId}-firstName`}
              name="firstName"
              required
              autoComplete="given-name"
              aria-invalid={errorFor('firstName') ? true : undefined}
              aria-describedby={errorFor('firstName') ? `${formId}-firstName-error` : undefined}
              className={['mt-2', inputClass('firstName')].join(' ')}
            />
            <FieldErrorMessage id={`${formId}-firstName-error`} message={errorFor('firstName')} />
          </div>

          <div>
            <label
              htmlFor={`${formId}-lastName`}
              className="block text-body-sm font-medium text-ink"
            >
              Last name <RequiredMark />
            </label>
            <input
              id={`${formId}-lastName`}
              name="lastName"
              required
              autoComplete="family-name"
              aria-invalid={errorFor('lastName') ? true : undefined}
              className={['mt-2', inputClass('lastName')].join(' ')}
            />
            <FieldErrorMessage id={`${formId}-lastName-error`} message={errorFor('lastName')} />
          </div>

          <div>
            <label htmlFor={`${formId}-email`} className="block text-body-sm font-medium text-ink">
              Email address <RequiredMark />
            </label>
            <input
              id={`${formId}-email`}
              name="email"
              type="email"
              required
              autoComplete="email"
              inputMode="email"
              aria-invalid={errorFor('email') ? true : undefined}
              className={['mt-2', inputClass('email')].join(' ')}
            />
            <FieldErrorMessage id={`${formId}-email-error`} message={errorFor('email')} />
          </div>

          <div>
            <label htmlFor={`${formId}-phone`} className="block text-body-sm font-medium text-ink">
              Phone number <RequiredMark />
            </label>
            <input
              id={`${formId}-phone`}
              name="phone"
              type="tel"
              required
              autoComplete="tel"
              inputMode="tel"
              placeholder="0301 234 5678"
              aria-invalid={errorFor('phone') ? true : undefined}
              className={['mt-2', inputClass('phone')].join(' ')}
            />
            <FieldErrorMessage id={`${formId}-phone-error`} message={errorFor('phone')} />
          </div>

          <div>
            <label htmlFor={`${formId}-city`} className="block text-body-sm font-medium text-ink">
              City
            </label>
            <input
              id={`${formId}-city`}
              name="city"
              autoComplete="address-level2"
              className={['mt-2', inputClass('city')].join(' ')}
            />
          </div>

          <div>
            <label
              htmlFor={`${formId}-linkedinUrl`}
              className="block text-body-sm font-medium text-ink"
            >
              LinkedIn profile
            </label>
            <input
              id={`${formId}-linkedinUrl`}
              name="linkedinUrl"
              type="url"
              placeholder="https://"
              className={['mt-2', inputClass('linkedinUrl')].join(' ')}
            />
            <FieldErrorMessage
              id={`${formId}-linkedinUrl-error`}
              message={errorFor('linkedinUrl')}
            />
          </div>
        </div>
      </fieldset>

      <fieldset className="space-y-6">
        <legend className="sr-only">Your CV</legend>

        <div>
          <label htmlFor={`${formId}-cv`} className="block text-body-sm font-medium text-ink">
            CV <RequiredMark />
          </label>
          <p id={`${formId}-cv-help`} className="mt-1 text-body-xs text-ink-faint">
            PDF or Word document, up to {MAX_FILE_MB} MB.
          </p>
          <input
            id={`${formId}-cv`}
            name="cv"
            type="file"
            required
            accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
            onChange={handleFileChange}
            aria-describedby={`${formId}-cv-help${fileError || errorFor('cv') ? ` ${formId}-cv-error` : ''}`}
            aria-invalid={fileError || errorFor('cv') ? true : undefined}
            className="mt-2 w-full text-body-sm text-ink-soft file:me-4 file:rounded file:border-0
                       file:bg-ink file:px-5 file:py-2.5 file:text-body-sm file:font-semibold
                       file:text-paper hover:file:bg-ink-soft"
          />
          {fileName && !fileError ? (
            <p className="mt-2 text-body-xs text-ink-muted">Selected: {fileName}</p>
          ) : null}
          <FieldErrorMessage id={`${formId}-cv-error`} message={fileError ?? errorFor('cv')} />
        </div>

        <div>
          <label
            htmlFor={`${formId}-coverNote`}
            className="block text-body-sm font-medium text-ink"
          >
            Why this role?
          </label>
          <p id={`${formId}-coverNote-help`} className="mt-1 text-body-xs text-ink-faint">
            Optional. A few sentences is plenty.
          </p>
          <textarea
            id={`${formId}-coverNote`}
            name="coverNote"
            rows={5}
            maxLength={2000}
            aria-describedby={`${formId}-coverNote-help`}
            className={['mt-2', inputClass('coverNote')].join(' ')}
          />
        </div>
      </fieldset>

      {/* Honeypot: positioned off-screen rather than display:none, and excluded
          from the tab order and the accessibility tree. */}
      <div aria-hidden="true" className="absolute -left-[9999px] h-px w-px overflow-hidden">
        <label htmlFor={`${formId}-contact-fax`}>Leave this empty</label>
        <input
          id={`${formId}-contact-fax`}
          name="contactFax"
          type="text"
          tabIndex={-1}
          autoComplete="off"
        />
      </div>

      <div className="border-t border-ink-line pt-6">
        <label className="flex items-start gap-3">
          <input
            type="checkbox"
            name="consent"
            required
            className="mt-1 h-4 w-4 shrink-0 accent-brand"
            aria-invalid={errorFor('consent') ? true : undefined}
          />
          <span className="text-body-sm text-ink-soft">
            I consent to Cheezious storing and processing the information in this application for
            recruitment purposes. <RequiredMark />
          </span>
        </label>
        <p className="ms-7 mt-2 text-body-xs text-ink-faint">
          Your application is kept for 12 months and is visible only to the people team.{' '}
          <a href={privacyPath} className="underline underline-offset-2">
            How we handle your information
          </a>
          .
        </p>
        <FieldErrorMessage
          id={`${formId}-consent-error`}
          message={errorFor('consent')}
          className="ms-7"
        />
      </div>

      <div className="flex flex-wrap items-center gap-4">
        <button
          type="submit"
          disabled={status === 'submitting' || Boolean(fileError)}
          className="inline-flex items-center gap-2 rounded bg-ink px-8 py-4 text-body-sm font-semibold
                     text-paper transition-colors duration-quick hover:bg-ink-soft
                     disabled:cursor-not-allowed disabled:opacity-60"
        >
          {status === 'submitting' ? 'Submitting…' : submitLabel}
        </button>
        {status === 'submitting' ? (
          <span role="status" className="text-body-sm text-ink-muted">
            Uploading your application…
          </span>
        ) : null}
      </div>
    </form>
  );
}

function RequiredMark() {
  return (
    <>
      <span className="text-signal-danger" aria-hidden="true">
        *
      </span>
      <span className="sr-only">(required)</span>
    </>
  );
}

function FieldErrorMessage({
  id,
  message,
  className,
}: {
  id: string;
  message?: string | null;
  className?: string;
}) {
  if (!message) return null;
  return (
    <p id={id} className={['mt-2 text-body-sm text-signal-danger', className ?? ''].join(' ')}>
      {message}
    </p>
  );
}
