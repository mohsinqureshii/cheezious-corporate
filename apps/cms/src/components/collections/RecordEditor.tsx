'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';

import { MediaPicker } from '@/components/collections/MediaPicker';
import { ReferenceSelect } from '@/components/collections/ReferenceSelect';
import { RichTextField } from '@/components/collections/RichTextField';
import { WorkflowBar } from '@/components/collections/WorkflowBar';
import { StatusTag, UnpublishedChangesTag } from '@/components/ui';
import { API_URL } from '@/lib/api';
import { collectionHref, groupFields, type CollectionDescriptor, type FieldSpec, type RecordRow } from '@/lib/collections';

/**
 * The record editor.
 *
 * Built from the collection's own field description, so a story, a policy and a
 * job posting are edited by the same code and behave the same way — the same
 * save semantics, the same unsaved-changes warning, the same workflow bar.
 *
 * Saving is explicit rather than automatic. Autosave suits a page composition,
 * where the working copy is separate from what is published; here a save is a
 * deliberate act by someone who has finished a thought, and an editor who walks
 * away mid-sentence should not have that sentence recorded as their intent.
 */

export interface RecordEditorProps {
  collection: CollectionDescriptor;
  record: RecordRow | null;
  transitions: Array<{ action: string; label: string; requires: string; tone?: string }>;
  canEdit: boolean;
  /** Where to go after creating a record. */
  listHref: string;
}

type Draft = Record<string, unknown>;

export function RecordEditor({ collection, record, transitions, canEdit, listHref }: RecordEditorProps) {
  const router = useRouter();
  const isNew = record === null;

  const initial = useMemo(() => draftFrom(collection, record), [collection, record]);
  const [draft, setDraft] = useState<Draft>(initial);
  const [status, setStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [message, setMessage] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const savedRef = useRef(false);

  const dirty = useMemo(() => JSON.stringify(draft) !== JSON.stringify(initial), [draft, initial]);

  // A browser-level guard, because the in-app one cannot catch a closed tab.
  useEffect(() => {
    if (!dirty) return;
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [dirty]);

  const set = useCallback((name: string, value: unknown) => {
    setStatus('idle');
    setDraft((current) => ({ ...current, [name]: value }));
  }, []);

  async function save() {
    setStatus('saving');
    setMessage('');
    setFieldErrors({});

    const payload = payloadFrom(collection, draft, isNew);

    try {
      const response = await fetch(
        isNew
          ? `${API_URL}/api/cms/content/${collection.path}`
          : `${API_URL}/api/cms/content/${collection.path}/${record.id}`,
        {
          method: isNew ? 'POST' : 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify(payload),
        },
      );

      const body = (await response.json()) as {
        item?: RecordRow;
        error?: { message: string; fields?: Array<{ field: string; message: string }> };
      };

      if (!response.ok) {
        setStatus('error');
        setFieldErrors(Object.fromEntries((body.error?.fields ?? []).map((error) => [error.field, error.message])));
        setMessage(
          body.error?.fields?.length
            ? 'Some fields need attention.'
            : (body.error?.message ?? 'This could not be saved.'),
        );
        return;
      }

      savedRef.current = true;
      setStatus('saved');

      if (isNew && body.item) {
        router.replace(collectionHref(collection.path, body.item.id));
      }
      router.refresh();
    } catch {
      setStatus('error');
      setMessage('We could not reach the server. Check your connection and try again.');
    }
  }

  const groups = groupFields(collection.fields);
  const title = String(draft[collection.labelField] ?? '') || `New ${collection.label.toLowerCase()}`;

  return (
    <div className="flex min-h-[calc(100vh-theme(spacing.header))] flex-col">
      {/* --- Editor bar ------------------------------------------------- */}
      <div className="sticky top-header z-sticky flex flex-wrap items-center gap-04 border-b border-border-subtle bg-surface-base px-06 py-04">
        <div className="min-w-0">
          <p className="truncate text-heading-compact text-content-primary">{title}</p>
          <p className="mt-01 flex items-center gap-02 text-helper-01 text-content-secondary">
            <span>{collection.label}</span>
            {collection.workflow && record ? (
              <>
                <StatusTag status={String(record.status)} size="sm" />
                {record.hasUnpublishedChanges === true && record.status === 'PUBLISHED' ? (
                  <UnpublishedChangesTag />
                ) : null}
              </>
            ) : null}
            {dirty ? <span className="text-status-warning">Unsaved changes</span> : null}
          </p>
        </div>

        <div className="ms-auto flex flex-wrap items-center gap-03">
          {status === 'saved' && !dirty ? (
            <span className="text-body-compact text-status-success" role="status">
              Saved
            </span>
          ) : null}

          <a href={listHref} className="btn-ghost no-underline">
            {collection.labelPlural}
          </a>

          {canEdit ? (
            <button type="button" onClick={save} disabled={!dirty || status === 'saving'} className="btn-primary">
              {status === 'saving' ? 'Saving…' : 'Save'}
            </button>
          ) : null}
        </div>
      </div>

      {status === 'error' && message ? (
        <div className="border-s-[3px] border-status-danger bg-status-dangerSubtle px-06 py-04" role="alert">
          <p className="text-body-01 text-content-primary">{message}</p>
        </div>
      ) : null}

      {!canEdit ? (
        <div className="border-s-[3px] border-status-info bg-status-infoSubtle px-06 py-04" role="status">
          <p className="text-body-01 text-content-primary">
            You can read this {collection.label.toLowerCase()} but not change it.
          </p>
        </div>
      ) : null}

      <div className="grid flex-1 gap-06 p-06 xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="space-y-06">
          {groups
            .filter((group) => group.key === 'content')
            .map((group) => (
              <FieldGroup
                key={group.key}
                title={group.label}
                fields={group.fields}
                draft={draft}
                errors={fieldErrors}
                canEdit={canEdit}
                onChange={set}
              />
            ))}
        </div>

        <div className="space-y-06">
          {collection.workflow && record ? (
            <WorkflowBar
              collectionPath={collection.path}
              recordId={record.id}
              status={String(record.status)}
              scheduledFor={(record.scheduledFor as string | null) ?? null}
              transitions={transitions}
              dirty={dirty}
            />
          ) : null}

          {groups
            .filter((group) => group.key !== 'content')
            .map((group) => (
              <FieldGroup
                key={group.key}
                title={group.label}
                fields={group.fields}
                draft={draft}
                errors={fieldErrors}
                canEdit={canEdit}
                onChange={set}
              />
            ))}
        </div>
      </div>
    </div>
  );
}

function FieldGroup({
  title,
  fields,
  draft,
  errors,
  canEdit,
  onChange,
}: {
  title: string;
  fields: FieldSpec[];
  draft: Draft;
  errors: Record<string, string>;
  canEdit: boolean;
  onChange: (name: string, value: unknown) => void;
}) {
  return (
    <section className="panel p-06">
      <h2 className="text-heading-compact text-content-primary">{title}</h2>
      <div className="mt-05 space-y-05">
        {fields.map((field) => (
          <Field
            key={field.name}
            field={field}
            value={draft[field.name]}
            error={errors[field.name]}
            canEdit={canEdit}
            onChange={(value) => onChange(field.name, value)}
          />
        ))}
      </div>
    </section>
  );
}

function Field({
  field,
  value,
  error,
  canEdit,
  onChange,
}: {
  field: FieldSpec;
  value: unknown;
  error?: string;
  canEdit: boolean;
  onChange: (value: unknown) => void;
}) {
  const id = `field-${field.name}`;
  const disabled = !canEdit;

  if (field.type === 'richtext') {
    return (
      <div>
        <RichTextField
          id={id}
          label={field.label}
          value={typeof value === 'string' ? value : ''}
          help={field.help}
          disabled={disabled}
          onChange={onChange}
        />
        {error ? <p className="field-error">{error}</p> : null}
      </div>
    );
  }

  if (field.type === 'media') {
    return (
      <div>
        <MediaPicker
          label={field.label}
          help={field.help}
          disabled={disabled}
          value={typeof value === 'string' ? value : null}
          onChange={onChange}
        />
        {error ? <p className="field-error">{error}</p> : null}
      </div>
    );
  }

  if (field.type === 'reference' && field.collection) {
    return (
      <div>
        <ReferenceSelect
          collection={field.collection}
          label={field.label}
          help={field.help}
          disabled={disabled}
          value={typeof value === 'string' ? value : null}
          onChange={onChange}
        />
        {error ? <p className="field-error">{error}</p> : null}
      </div>
    );
  }

  if (field.type === 'boolean') {
    return (
      <div>
        <label className="flex items-start gap-03">
          <input
            type="checkbox"
            className="checkbox mt-01"
            checked={value === true}
            disabled={disabled}
            onChange={(event) => onChange(event.target.checked)}
          />
          <span>
            <span className="block text-body-compact text-content-primary">{field.label}</span>
            {field.help ? <span className="block text-helper-01 text-content-secondary">{field.help}</span> : null}
          </span>
        </label>
        {error ? <p className="field-error">{error}</p> : null}
      </div>
    );
  }

  if (field.type === 'select') {
    return (
      <div>
        <label htmlFor={id} className="field-label">
          {field.label}
        </label>
        <select
          id={id}
          className="select"
          value={typeof value === 'string' ? value : ''}
          disabled={disabled}
          onChange={(event) => onChange(event.target.value || null)}
        >
          {!field.required ? <option value="">Not set</option> : null}
          {field.options?.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        {error ? <p className="field-error">{error}</p> : field.help ? <p className="field-helper">{field.help}</p> : null}
      </div>
    );
  }

  if (field.type === 'textarea') {
    return (
      <div>
        <label htmlFor={id} className="field-label">
          {field.label}
        </label>
        <textarea
          id={id}
          className={['textarea', error ? 'input-invalid' : ''].join(' ')}
          rows={3}
          maxLength={field.max}
          value={typeof value === 'string' ? value : ''}
          disabled={disabled}
          onChange={(event) => onChange(event.target.value)}
        />
        {error ? <p className="field-error">{error}</p> : field.help ? <p className="field-helper">{field.help}</p> : null}
      </div>
    );
  }

  const inputType =
    field.type === 'number' ? 'number' : field.type === 'date' ? 'date' : field.type === 'datetime' ? 'datetime-local' : field.type === 'url' ? 'url' : 'text';

  return (
    <div>
      <label htmlFor={id} className="field-label">
        {field.label}
        {field.required ? <span className="text-status-danger"> *</span> : null}
      </label>
      <input
        id={id}
        type={inputType}
        className={['input', error ? 'input-invalid' : '', field.type === 'slug' ? 'font-mono' : ''].join(' ')}
        maxLength={field.max}
        value={toInputValue(value, field.type)}
        disabled={disabled}
        onChange={(event) =>
          onChange(field.type === 'number' ? (event.target.value === '' ? null : Number(event.target.value)) : event.target.value)
        }
      />
      {error ? <p className="field-error">{error}</p> : field.help ? <p className="field-helper">{field.help}</p> : null}
    </div>
  );
}

/** A record's values, restricted to the fields the collection declares. */
function draftFrom(collection: CollectionDescriptor, record: RecordRow | null): Draft {
  const draft: Draft = {};

  for (const field of collection.fields) {
    const value = record?.[field.name];
    draft[field.name] =
      value === undefined || value === null
        ? field.type === 'boolean'
          ? false
          : ''
        : value;
  }

  if (collection.localized && !draft.locale) draft.locale = 'en';

  return draft;
}

/**
 * The write payload.
 *
 * Empty strings become null so clearing a field clears it, rather than storing
 * an empty string that later renders as a blank line. Dates go as ISO so the
 * server's coercion has something unambiguous to work with.
 */
function payloadFrom(collection: CollectionDescriptor, draft: Draft, isNew: boolean): Record<string, unknown> {
  const payload: Record<string, unknown> = {};

  for (const field of collection.fields) {
    const value = draft[field.name];

    // `locale` is fixed at creation: changing it afterwards would move the
    // record into another language's namespace behind the editor's back.
    if (field.name === 'locale' && !isNew) continue;

    if (field.type === 'boolean') {
      payload[field.name] = value === true;
      continue;
    }

    if (value === '' || value === undefined) {
      if (isNew) continue;
      payload[field.name] = field.required ? '' : null;
      continue;
    }

    if ((field.type === 'date' || field.type === 'datetime') && typeof value === 'string') {
      payload[field.name] = new Date(value).toISOString();
      continue;
    }

    payload[field.name] = value;
  }

  return payload;
}

function toInputValue(value: unknown, type: FieldSpec['type']): string {
  if (value === null || value === undefined) return '';
  if (type === 'date' && typeof value === 'string') return value.slice(0, 10);
  if (type === 'datetime' && typeof value === 'string') return value.slice(0, 16);
  return String(value);
}
