'use client';

import type { Locale } from '@cheezious/config';
import { useId, useRef, useState } from 'react';

import { apiOrigin } from '@/lib/urls';

/**
 * Public form.
 *
 * The browser validates for convenience; the server validates for correctness.
 * Nothing here is a security control — field constraints, file checks, consent
 * and rate limits are all enforced by the API, and this component's job is to
 * make that enforcement legible to a person filling it in.
 *
 * Two anti-spam measures are included because they cost a real visitor nothing:
 * a honeypot field hidden from people but not from bots, and a render timestamp
 * so the server can reject submissions completed impossibly fast.
 */

export type FormEndpoint = 'suppliers' | 'properties' | 'partnerships' | 'contact';

const ENDPOINT_BY_KEY: Record<string, FormEndpoint> = {
  SUPPLIER_REGISTRATION: 'suppliers',
  PROPERTY_SUBMISSION: 'properties',
  PARTNERSHIP_ENQUIRY: 'partnerships',
  CONTACT: 'contact',
};

export interface FieldDefinition {
  type: string;
  name: string;
  label: string;
  placeholder?: string | null;
  helpText?: string | null;
  isRequired: boolean;
  options?: Array<{ value: string; label: string }> | null;
  validation?: Record<string, unknown> | null;
  width?: string;
}

export interface PublicFormProps {
  formKey: string;
  locale: Locale;
  /** When absent, a sensible default set is used for the known form keys. */
  fields?: FieldDefinition[];
  submitLabel?: string;
  successMessage?: string;
}

interface FieldError {
  field: string;
  message: string;
}

const DEFAULT_FIELDS: Record<FormEndpoint, FieldDefinition[]> = {
  contact: [
    {
      type: 'SELECT',
      name: 'categoryKey',
      label: 'What is your enquiry about?',
      isRequired: true,
      width: 'full',
      options: [
        { value: 'CUSTOMER', label: 'Customer care' },
        { value: 'CORPORATE', label: 'Corporate enquiry' },
        { value: 'MEDIA', label: 'Media enquiry' },
        { value: 'CAREERS', label: 'Careers' },
        { value: 'SUPPLIERS', label: 'Suppliers' },
        { value: 'REAL_ESTATE', label: 'Real estate' },
        { value: 'PARTNERSHIPS', label: 'Partnerships' },
        { value: 'OTHER', label: 'Something else' },
      ],
    },
    { type: 'TEXT', name: 'name', label: 'Your name', isRequired: true, width: 'half' },
    { type: 'EMAIL', name: 'email', label: 'Email address', isRequired: true, width: 'half' },
    { type: 'PHONE', name: 'phone', label: 'Phone number', isRequired: false, width: 'half' },
    { type: 'TEXT', name: 'city', label: 'City', isRequired: false, width: 'half' },
    { type: 'TEXT', name: 'subject', label: 'Subject', isRequired: false, width: 'full' },
    { type: 'TEXTAREA', name: 'message', label: 'Your message', isRequired: true, width: 'full' },
  ],
  suppliers: [
    { type: 'TEXT', name: 'companyName', label: 'Company name', isRequired: true, width: 'half' },
    {
      type: 'TEXT',
      name: 'website',
      label: 'Website',
      isRequired: false,
      width: 'half',
      placeholder: 'https://',
    },
    { type: 'TEXT', name: 'contactName', label: 'Contact name', isRequired: true, width: 'half' },
    { type: 'EMAIL', name: 'email', label: 'Email address', isRequired: true, width: 'half' },
    { type: 'PHONE', name: 'phone', label: 'Phone number', isRequired: true, width: 'half' },
    {
      type: 'SELECT',
      name: 'categoryId',
      label: 'Category',
      isRequired: false,
      width: 'half',
      options: [],
    },
    {
      type: 'TEXTAREA',
      name: 'productsServices',
      label: 'What do you supply?',
      isRequired: true,
      width: 'full',
      helpText: 'Describe the products or services you would supply.',
    },
    {
      type: 'TEXT',
      name: 'citiesServed',
      label: 'Cities served',
      isRequired: false,
      width: 'full',
      helpText: 'Separate multiple cities with commas.',
    },
    {
      type: 'TEXTAREA',
      name: 'certifications',
      label: 'Certifications',
      isRequired: false,
      width: 'full',
    },
    {
      type: 'TEXTAREA',
      name: 'productionCapacity',
      label: 'Production capacity',
      isRequired: false,
      width: 'full',
    },
    {
      type: 'FILE',
      name: 'attachments',
      label: 'Company profile or catalogue',
      isRequired: false,
      width: 'full',
      helpText: 'PDF, Word or images, up to 10 MB each.',
    },
  ],
  properties: [
    { type: 'TEXT', name: 'contactName', label: 'Your name', isRequired: true, width: 'half' },
    { type: 'EMAIL', name: 'email', label: 'Email address', isRequired: true, width: 'half' },
    { type: 'PHONE', name: 'phone', label: 'Phone number', isRequired: true, width: 'half' },
    { type: 'TEXT', name: 'company', label: 'Company', isRequired: false, width: 'half' },
    { type: 'TEXT', name: 'cityName', label: 'City', isRequired: true, width: 'half' },
    {
      type: 'TEXT',
      name: 'area',
      label: 'Area or neighbourhood',
      isRequired: false,
      width: 'half',
    },
    { type: 'TEXTAREA', name: 'address', label: 'Address', isRequired: true, width: 'full' },
    {
      type: 'SELECT',
      name: 'propertyType',
      label: 'Property type',
      isRequired: true,
      width: 'half',
      options: [
        { value: 'HIGH_STREET', label: 'High street' },
        { value: 'SHOPPING_MALL', label: 'Shopping mall' },
        { value: 'STANDALONE', label: 'Standalone' },
        { value: 'FOOD_COURT', label: 'Food court' },
        { value: 'DRIVE_THROUGH', label: 'Drive-through' },
        { value: 'KIOSK', label: 'Kiosk' },
        { value: 'COMMERCIAL_PLAZA', label: 'Commercial plaza' },
        { value: 'OTHER', label: 'Other' },
      ],
    },
    {
      type: 'SELECT',
      name: 'ownership',
      label: 'Your relationship to the property',
      isRequired: true,
      width: 'half',
      options: [
        { value: 'OWNER', label: 'Owner' },
        { value: 'AUTHORISED_AGENT', label: 'Authorised agent' },
        { value: 'DEVELOPER', label: 'Developer' },
        { value: 'OTHER', label: 'Other' },
      ],
    },
    {
      type: 'NUMBER',
      name: 'totalAreaSqft',
      label: 'Total area (sq ft)',
      isRequired: false,
      width: 'half',
    },
    {
      type: 'NUMBER',
      name: 'groundFloorSqft',
      label: 'Ground-floor area (sq ft)',
      isRequired: false,
      width: 'half',
    },
    {
      type: 'NUMBER',
      name: 'frontageFeet',
      label: 'Frontage (ft)',
      isRequired: false,
      width: 'half',
    },
    {
      type: 'NUMBER',
      name: 'parkingSpaces',
      label: 'Parking spaces',
      isRequired: false,
      width: 'half',
    },
    {
      type: 'CHECKBOX',
      name: 'driveThroughFeasible',
      label: 'A drive-through would be feasible here',
      isRequired: false,
      width: 'full',
    },
    {
      type: 'TEXT',
      name: 'expectedRent',
      label: 'Expected rent',
      isRequired: false,
      width: 'half',
    },
    {
      type: 'TEXTAREA',
      name: 'notes',
      label: 'Anything else we should know?',
      isRequired: false,
      width: 'full',
    },
    {
      type: 'FILE',
      name: 'attachments',
      label: 'Photographs or floor plan',
      isRequired: false,
      width: 'full',
      helpText: 'Images or PDF, up to 10 MB each.',
    },
  ],
  partnerships: [
    {
      type: 'TEXT',
      name: 'organisationName',
      label: 'Organisation name',
      isRequired: true,
      width: 'half',
    },
    {
      type: 'TEXT',
      name: 'website',
      label: 'Website',
      isRequired: false,
      width: 'half',
      placeholder: 'https://',
    },
    { type: 'TEXT', name: 'contactName', label: 'Your name', isRequired: true, width: 'half' },
    { type: 'TEXT', name: 'role', label: 'Your role', isRequired: false, width: 'half' },
    { type: 'EMAIL', name: 'email', label: 'Email address', isRequired: true, width: 'half' },
    { type: 'PHONE', name: 'phone', label: 'Phone number', isRequired: false, width: 'half' },
    {
      type: 'TEXTAREA',
      name: 'proposal',
      label: 'What do you have in mind?',
      isRequired: true,
      width: 'full',
    },
  ],
};

const CONSENT_LABEL: Record<FormEndpoint, string> = {
  contact:
    'I consent to Cheezious storing and processing this information to respond to my enquiry.',
  suppliers:
    'I consent to Cheezious storing and processing this information to assess a potential supplier relationship.',
  properties:
    'I consent to Cheezious storing and processing this information to assess the proposed location.',
  partnerships:
    'I consent to Cheezious storing and processing this information to assess a potential partnership.',
};

export function PublicForm({
  formKey,
  locale,
  fields,
  submitLabel,
  successMessage,
}: PublicFormProps) {
  const endpoint = ENDPOINT_BY_KEY[formKey];
  const formId = useId();
  const mountedAt = useRef(Date.now());

  const [status, setStatus] = useState<'idle' | 'submitting' | 'success' | 'error'>('idle');
  const [errors, setErrors] = useState<FieldError[]>([]);
  const [message, setMessage] = useState<string>('');
  const [reference, setReference] = useState<string | null>(null);

  if (!endpoint) {
    return (
      <p className="text-body-sm text-ink-muted">
        This form is not yet configured. Add a form definition in the CMS with key{' '}
        <code>{formKey}</code>.
      </p>
    );
  }

  const resolvedFields = fields ?? DEFAULT_FIELDS[endpoint];

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus('submitting');
    setErrors([]);

    const form = event.currentTarget;
    const formData = new FormData(form);
    formData.set('consent', String(formData.get('consent') === 'on'));
    // Time on screen: a bot completing this in under three seconds is refused
    // by the server.
    formData.set('elapsedMs', String(Date.now() - mountedAt.current));

    try {
      const response = await fetch(`${apiOrigin()}/api/submit/${endpoint}`, {
        method: 'POST',
        body: formData,
      });
      const body = (await response.json()) as {
        ok?: boolean;
        reference?: string;
        message?: string;
        error?: { message: string; fields?: FieldError[] };
      };

      if (!response.ok) {
        setStatus('error');
        setErrors(body.error?.fields ?? []);
        setMessage(body.error?.message ?? 'Something went wrong. Please try again.');

        // Move focus to the first field with a problem so a keyboard or screen
        // reader user is taken straight to it.
        const firstField = body.error?.fields?.[0]?.field;
        if (firstField) {
          form.querySelector<HTMLElement>(`[name="${firstField}"]`)?.focus();
        }
        return;
      }

      setStatus('success');
      setMessage(body.message ?? successMessage ?? 'Thank you. Your submission has been received.');
      setReference(body.reference ?? null);
      form.reset();
    } catch {
      setStatus('error');
      setMessage('We could not reach the server. Check your connection and try again.');
    }
  }

  if (status === 'success') {
    return (
      <div
        className="border-s-2 border-signal-success bg-paper-raised p-8"
        role="status"
        aria-live="polite"
      >
        <h3 className="text-heading-md text-ink">Thank you</h3>
        <p className="mt-3 max-w-prose text-body-md text-ink-soft">{message}</p>
        {reference ? (
          <p className="mt-5 text-body-sm text-ink-muted">
            Your reference: <span className="font-semibold tabular-nums text-ink">{reference}</span>
            <br />
            Keep this for your records.
          </p>
        ) : null}
      </div>
    );
  }

  const errorFor = (name: string) => errors.find((error) => error.field === name)?.message;

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-6">
      {/* Error summary, announced and focusable — the accessible pattern for
          form errors, rather than relying on inline messages alone. */}
      {status === 'error' ? (
        <div
          className="border-s-2 border-signal-danger bg-paper-raised p-5"
          role="alert"
          aria-live="assertive"
          tabIndex={-1}
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

      <div className="grid gap-x-gutter gap-y-6 sm:grid-cols-2">
        {resolvedFields.map((field) => (
          <Field
            key={field.name}
            field={field}
            formId={formId}
            error={errorFor(field.name)}
            locale={locale}
          />
        ))}
      </div>

      {/* Honeypot: off-screen rather than display:none, because some bots skip
          hidden fields. Excluded from the tab order and from assistive tech. */}
      <div aria-hidden="true" className="absolute -left-[9999px] h-px w-px overflow-hidden">
        <label htmlFor={`${formId}-contact-fax`}>Leave this field empty</label>
        <input
          id={`${formId}-contact-fax`}
          type="text"
          name="contactFax"
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
            aria-describedby={`${formId}-consent-help`}
          />
          <span className="text-body-sm text-ink-soft">
            {CONSENT_LABEL[endpoint]}
            <span className="text-signal-danger" aria-hidden="true">
              {' '}
              *
            </span>
          </span>
        </label>
        <p id={`${formId}-consent-help`} className="ms-7 mt-2 text-body-xs text-ink-faint">
          We use this information only to handle your submission. Read our{' '}
          <a
            href={`/${locale}/company/governance/privacy`}
            className="underline underline-offset-2"
          >
            privacy information
          </a>
          .
        </p>
        {errorFor('consent') ? (
          <p className="ms-7 mt-2 text-body-sm text-signal-danger">{errorFor('consent')}</p>
        ) : null}
      </div>

      <div className="flex items-center gap-4">
        <button
          type="submit"
          disabled={status === 'submitting'}
          className="inline-flex items-center gap-2 rounded bg-ink px-8 py-4 text-body-sm font-semibold
                     text-paper transition-colors duration-quick hover:bg-ink-soft
                     disabled:cursor-not-allowed disabled:opacity-60"
        >
          {status === 'submitting' ? 'Sending…' : (submitLabel ?? 'Submit')}
        </button>
        {status === 'submitting' ? (
          <span className="text-body-sm text-ink-muted" role="status">
            Sending your submission…
          </span>
        ) : null}
      </div>
    </form>
  );
}

function Field({
  field,
  formId,
  error,
  locale: _locale,
}: {
  field: FieldDefinition;
  formId: string;
  error?: string;
  locale: Locale;
}) {
  const id = `${formId}-${field.name}`;
  const describedBy = [field.helpText ? `${id}-help` : null, error ? `${id}-error` : null]
    .filter(Boolean)
    .join(' ');

  const baseClass = [
    'w-full rounded border bg-paper-raised px-4 py-3 text-body-md text-ink',
    'transition-colors duration-quick placeholder:text-ink-faint',
    error ? 'border-signal-danger' : 'border-ink-line focus:border-ink',
  ].join(' ');

  const isFullWidth = field.width === 'full' || field.type === 'TEXTAREA' || field.type === 'FILE';

  return (
    <div className={isFullWidth ? 'sm:col-span-2' : ''}>
      <label htmlFor={id} className="block text-body-sm font-medium text-ink">
        {field.label}
        {field.isRequired ? (
          <>
            <span className="text-signal-danger" aria-hidden="true">
              {' '}
              *
            </span>
            <span className="sr-only"> (required)</span>
          </>
        ) : null}
      </label>

      {field.helpText ? (
        <p id={`${id}-help`} className="mt-1 text-body-xs text-ink-faint">
          {field.helpText}
        </p>
      ) : null}

      <div className="mt-2">
        {field.type === 'TEXTAREA' ? (
          <textarea
            id={id}
            name={field.name}
            required={field.isRequired}
            rows={5}
            placeholder={field.placeholder ?? undefined}
            aria-describedby={describedBy || undefined}
            aria-invalid={error ? true : undefined}
            className={baseClass}
          />
        ) : field.type === 'SELECT' ? (
          <select
            id={id}
            name={field.name}
            required={field.isRequired}
            aria-describedby={describedBy || undefined}
            aria-invalid={error ? true : undefined}
            className={baseClass}
            defaultValue=""
          >
            <option value="" disabled>
              Choose an option
            </option>
            {(field.options ?? []).map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        ) : field.type === 'CHECKBOX' ? (
          <label className="flex items-start gap-3">
            <input
              id={id}
              type="checkbox"
              name={field.name}
              className="mt-1 h-4 w-4 shrink-0 accent-brand"
              aria-describedby={describedBy || undefined}
            />
            <span className="text-body-sm text-ink-soft">{field.label}</span>
          </label>
        ) : field.type === 'FILE' ? (
          <input
            id={id}
            type="file"
            name={field.name}
            multiple
            required={field.isRequired}
            accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.webp"
            aria-describedby={describedBy || undefined}
            aria-invalid={error ? true : undefined}
            className="w-full text-body-sm text-ink-soft file:me-4 file:rounded file:border-0
                       file:bg-ink file:px-5 file:py-2.5 file:text-body-sm file:font-semibold
                       file:text-paper hover:file:bg-ink-soft"
          />
        ) : (
          <input
            id={id}
            type={
              field.type === 'EMAIL'
                ? 'email'
                : field.type === 'PHONE'
                  ? 'tel'
                  : field.type === 'NUMBER'
                    ? 'number'
                    : 'text'
            }
            name={field.name}
            required={field.isRequired}
            placeholder={field.placeholder ?? undefined}
            autoComplete={AUTOCOMPLETE[field.name] ?? undefined}
            inputMode={
              field.type === 'NUMBER' ? 'numeric' : field.type === 'PHONE' ? 'tel' : undefined
            }
            aria-describedby={describedBy || undefined}
            aria-invalid={error ? true : undefined}
            className={baseClass}
          />
        )}
      </div>

      {error ? (
        <p id={`${id}-error`} className="mt-2 text-body-sm text-signal-danger">
          {error}
        </p>
      ) : null}
    </div>
  );
}

/** Autofill hints, so returning visitors are not retyping their own details. */
const AUTOCOMPLETE: Record<string, string> = {
  name: 'name',
  contactName: 'name',
  firstName: 'given-name',
  lastName: 'family-name',
  email: 'email',
  phone: 'tel',
  city: 'address-level2',
  cityName: 'address-level2',
  company: 'organization',
  companyName: 'organization',
  organisationName: 'organization',
  website: 'url',
  address: 'street-address',
};
