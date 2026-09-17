'use client';

import { getBlockSpec, validateBlock } from '@cheezious/page-builder';
import { useMemo, useState } from 'react';

/**
 * Block inspector.
 *
 * Renders an editing form for whichever block is selected, driven by the block
 * registry rather than by sixty hand-written forms. Adding a block type to
 * `@cheezious/page-builder` therefore gives it an editor automatically, which is
 * what keeps the block library extensible without the CMS falling behind it.
 *
 * Validation runs against the same Zod schema the server enforces, so an editor
 * is told about a problem while typing rather than when they press save.
 */

export interface BlockInspectorProps {
  blockKey: string;
  data: Record<string, unknown>;
  canEdit: boolean;
  onChange: (data: Record<string, unknown>) => void;
}

/** Fields the renderer handles structurally; editing them raw would be noise. */
const HIDDEN_FIELDS = new Set(['assetId']);

/** Constrained design-system choices, rendered as selects rather than free text. */
const ENUM_OPTIONS: Record<string, Array<{ value: string; label: string }>> = {
  tone: [
    { value: 'light', label: 'Light' },
    { value: 'muted', label: 'Muted' },
    { value: 'dark', label: 'Dark' },
    { value: 'accent', label: 'Accent (yellow)' },
  ],
  spacing: [
    { value: 'compact', label: 'Compact' },
    { value: 'standard', label: 'Standard' },
    { value: 'generous', label: 'Generous' },
  ],
  width: [
    { value: 'narrow', label: 'Narrow' },
    { value: 'standard', label: 'Standard' },
    { value: 'wide', label: 'Wide' },
    { value: 'full', label: 'Full bleed' },
  ],
  columns: [
    { value: '2', label: 'Two columns' },
    { value: '3', label: 'Three columns' },
    { value: '4', label: 'Four columns' },
  ],
  aspectRatio: [
    { value: '21:9', label: '21:9 — cinematic' },
    { value: '16:9', label: '16:9 — wide' },
    { value: '3:2', label: '3:2 — editorial' },
    { value: '4:3', label: '4:3' },
    { value: '1:1', label: '1:1 — square' },
    { value: '4:5', label: '4:5 — portrait' },
  ],
  mediaPosition: [
    { value: 'left', label: 'Image on the left' },
    { value: 'right', label: 'Image on the right' },
  ],
  align: [
    { value: 'start', label: 'Left' },
    { value: 'center', label: 'Centred' },
  ],
  layout: [
    { value: 'grid', label: 'Grid' },
    { value: 'list', label: 'List' },
    { value: 'editorial', label: 'Editorial' },
    { value: 'split', label: 'Split' },
    { value: 'overlay', label: 'Overlay' },
    { value: 'rows', label: 'Rows' },
    { value: 'cards', label: 'Cards' },
    { value: 'vertical', label: 'Vertical' },
    { value: 'horizontal', label: 'Horizontal' },
    { value: 'masonry', label: 'Masonry' },
    { value: 'carousel', label: 'Carousel' },
    { value: 'below', label: 'Text below image' },
  ],
};

/** Fields whose content is long-form prose. */
const RICH_TEXT_FIELDS = new Set(['body', 'left', 'right', 'answer', 'fullBio', 'description']);
const MULTILINE_FIELDS = new Set([
  'standfirst',
  'intro',
  'summary',
  'statement',
  'text',
  'excerpt',
  'usageNotes',
]);

export function BlockInspector({ blockKey, data, canEdit, onChange }: BlockInspectorProps) {
  const spec = getBlockSpec(blockKey);
  const [touched, setTouched] = useState<Set<string>>(new Set());

  // Live validation against the server's own schema.
  const validation = useMemo(() => validateBlock(blockKey, data), [blockKey, data]);
  const errors = useMemo(() => {
    if (validation.ok) return {} as Record<string, string>;
    return Object.fromEntries(
      validation.errors.map((error) => [error.field.split('.')[0] ?? error.field, error.message]),
    );
  }, [validation]);

  if (!spec) {
    return (
      <p className="text-body-01 text-status-danger">
        This block type ({blockKey}) is no longer registered. Remove it, or restore the block
        definition.
      </p>
    );
  }

  const fields = editableFieldsFor(data, spec.key);

  function set(field: string, value: unknown) {
    setTouched((current) => new Set(current).add(field));
    onChange({ ...data, [field]: value });
  }

  return (
    <div className="space-y-05">
      <div className="border-b border-border-subtle pb-04">
        <h2 className="text-heading-02 text-content-primary">{spec.name}</h2>
        <p className="mt-01 text-helper-01 text-content-secondary">{spec.description}</p>
      </div>

      {!validation.ok && touched.size > 0 ? (
        <div className="border-s-[3px] border-status-warning bg-status-warningSubtle px-04 py-03">
          <p className="text-body-compact text-content-primary">This block is not complete yet</p>
          <ul className="mt-01 space-y-01">
            {validation.errors.slice(0, 4).map((error) => (
              <li
                key={`${error.field}-${error.message}`}
                className="text-helper-01 text-content-secondary"
              >
                {error.field === '_root'
                  ? error.message
                  : `${humanize(error.field)}: ${error.message}`}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {fields.map((field) => (
        <Field
          key={field}
          name={field}
          value={data[field]}
          error={touched.has(field) ? errors[field] : undefined}
          canEdit={canEdit}
          onChange={(value) => set(field, value)}
        />
      ))}

      {fields.length === 0 ? (
        <p className="text-body-01 text-content-secondary">
          This block has no editable settings — its content comes from the records it displays.
        </p>
      ) : null}
    </div>
  );
}

function Field({
  name,
  value,
  error,
  canEdit,
  onChange,
}: {
  name: string;
  value: unknown;
  error?: string;
  canEdit: boolean;
  onChange: (value: unknown) => void;
}) {
  const id = `block-field-${name}`;
  const label = humanize(name);

  // --- Booleans -------------------------------------------------------------
  if (typeof value === 'boolean') {
    return (
      <div>
        <label className="flex items-start gap-03">
          <input
            type="checkbox"
            checked={value}
            disabled={!canEdit}
            onChange={(event) => onChange(event.target.checked)}
            className="checkbox mt-01"
          />
          <span className="text-body-compact text-content-primary">{label}</span>
        </label>
      </div>
    );
  }

  // --- Constrained choices --------------------------------------------------
  const options = ENUM_OPTIONS[name];
  if (options && (typeof value === 'string' || value === undefined)) {
    return (
      <div>
        <label htmlFor={id} className="field-label">
          {label}
        </label>
        <select
          id={id}
          value={typeof value === 'string' ? value : ''}
          disabled={!canEdit}
          onChange={(event) => onChange(event.target.value)}
          className="select"
        >
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        {/* The design system is enforced here: an editor chooses a named option,
            never an arbitrary colour or pixel value. */}
      </div>
    );
  }

  // --- Numbers --------------------------------------------------------------
  if (typeof value === 'number') {
    return (
      <div>
        <label htmlFor={id} className="field-label">
          {label}
        </label>
        <input
          id={id}
          type="number"
          value={value}
          disabled={!canEdit}
          onChange={(event) => onChange(Number(event.target.value))}
          className={['input', error ? 'input-invalid' : ''].join(' ')}
        />
        {error ? <p className="field-error">{error}</p> : null}
      </div>
    );
  }

  // --- Repeating groups -----------------------------------------------------
  if (Array.isArray(value)) {
    return (
      <RepeaterField
        name={name}
        label={label}
        items={value}
        canEdit={canEdit}
        onChange={onChange}
        error={error}
      />
    );
  }

  // --- Nested objects (media, links, a single quote) ------------------------
  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>;
    return (
      <fieldset className="border border-border-subtle p-04">
        <legend className="px-02 text-label-01 uppercase tracking-wide text-content-secondary">
          {label}
        </legend>
        <div className="space-y-04">
          {Object.keys(record)
            .filter((key) => !HIDDEN_FIELDS.has(key))
            .map((key) => (
              <Field
                key={key}
                name={key}
                value={record[key]}
                canEdit={canEdit}
                onChange={(nested) => onChange({ ...record, [key]: nested })}
              />
            ))}
        </div>
        {error ? <p className="field-error">{error}</p> : null}
      </fieldset>
    );
  }

  // --- Text -----------------------------------------------------------------
  const isRichText = RICH_TEXT_FIELDS.has(name);
  const isMultiline = MULTILINE_FIELDS.has(name);
  const text = typeof value === 'string' ? value : '';

  if (isRichText || isMultiline) {
    return (
      <div>
        <label htmlFor={id} className="field-label">
          {label}
        </label>
        <textarea
          id={id}
          value={text}
          disabled={!canEdit}
          rows={isRichText ? 8 : 3}
          onChange={(event) => onChange(event.target.value)}
          className={[
            'textarea',
            isRichText ? 'font-mono text-helper-01' : '',
            error ? 'input-invalid' : '',
          ].join(' ')}
        />
        {isRichText ? (
          <p className="field-helper">
            Basic HTML is allowed. Scripts, inline styles and event handlers are removed when saved.
          </p>
        ) : null}
        {error ? <p className="field-error">{error}</p> : null}
      </div>
    );
  }

  return (
    <div>
      <label htmlFor={id} className="field-label">
        {label}
      </label>
      <input
        id={id}
        value={text}
        disabled={!canEdit}
        onChange={(event) => onChange(event.target.value)}
        className={['input', error ? 'input-invalid' : ''].join(' ')}
      />
      {error ? <p className="field-error">{error}</p> : null}
    </div>
  );
}

/** Editor for a repeating group: statistics, pillars, steps, FAQ entries. */
function RepeaterField({
  name,
  label,
  items,
  canEdit,
  onChange,
  error,
}: {
  name: string;
  label: string;
  items: unknown[];
  canEdit: boolean;
  onChange: (value: unknown[]) => void;
  error?: string;
}) {
  const [expanded, setExpanded] = useState<number | null>(items.length > 0 ? 0 : null);

  // A list of plain strings (tags, ids) edits as a comma-separated field.
  if (items.every((item) => typeof item === 'string')) {
    return (
      <div>
        <label htmlFor={`block-field-${name}`} className="field-label">
          {label}
        </label>
        <input
          id={`block-field-${name}`}
          value={(items as string[]).join(', ')}
          disabled={!canEdit}
          onChange={(event) =>
            onChange(
              event.target.value
                .split(',')
                .map((part) => part.trim())
                .filter(Boolean),
            )
          }
          className="input"
        />
        <p className="field-helper">Separate with commas.</p>
      </div>
    );
  }

  const template =
    items[0] && typeof items[0] === 'object' ? (items[0] as Record<string, unknown>) : {};

  return (
    <fieldset className="border border-border-subtle p-04">
      <legend className="px-02 text-label-01 uppercase tracking-wide text-content-secondary">
        {label} ({items.length})
      </legend>

      <ol className="space-y-02">
        {items.map((item, index) => {
          const record = (item ?? {}) as Record<string, unknown>;
          const isOpen = expanded === index;

          return (
            <li key={index} className="border border-border-subtle">
              <div className="flex items-center justify-between gap-02 bg-gray-10 px-03 py-02">
                <button
                  type="button"
                  onClick={() => setExpanded(isOpen ? null : index)}
                  className="flex-1 truncate text-left text-body-compact text-content-primary"
                  aria-expanded={isOpen}
                >
                  {index + 1}.{' '}
                  {String(record.label ?? record.title ?? record.question ?? record.name ?? 'Item')}
                </button>

                {canEdit ? (
                  <div className="flex items-center gap-01">
                    <button
                      type="button"
                      className="px-02 text-helper-01 text-content-secondary hover:text-content-primary disabled:opacity-30"
                      disabled={index === 0}
                      onClick={() => {
                        const next = [...items];
                        [next[index - 1], next[index]] = [next[index]!, next[index - 1]!];
                        onChange(next);
                      }}
                    >
                      ↑<span className="sr-only">Move up</span>
                    </button>
                    <button
                      type="button"
                      className="px-02 text-helper-01 text-content-secondary hover:text-content-primary disabled:opacity-30"
                      disabled={index === items.length - 1}
                      onClick={() => {
                        const next = [...items];
                        [next[index], next[index + 1]] = [next[index + 1]!, next[index]!];
                        onChange(next);
                      }}
                    >
                      ↓<span className="sr-only">Move down</span>
                    </button>
                    <button
                      type="button"
                      className="px-02 text-helper-01 text-content-secondary hover:text-status-danger"
                      onClick={() => onChange(items.filter((_, position) => position !== index))}
                    >
                      ✕<span className="sr-only">Remove item {index + 1}</span>
                    </button>
                  </div>
                ) : null}
              </div>

              {isOpen ? (
                <div className="space-y-04 p-04">
                  {Object.keys(record).map((key) => (
                    <Field
                      key={key}
                      name={key}
                      value={record[key]}
                      canEdit={canEdit}
                      onChange={(value) => {
                        const next = [...items];
                        next[index] = { ...record, [key]: value };
                        onChange(next);
                      }}
                    />
                  ))}
                </div>
              ) : null}
            </li>
          );
        })}
      </ol>

      {canEdit ? (
        <button
          type="button"
          onClick={() => {
            // New items inherit the shape of the first, with values cleared, so
            // an editor never has to know the underlying schema.
            const blank = Object.fromEntries(
              Object.entries(template).map(([key, value]) => [
                key,
                typeof value === 'string'
                  ? ''
                  : typeof value === 'number'
                    ? 0
                    : typeof value === 'boolean'
                      ? value
                      : Array.isArray(value)
                        ? []
                        : value,
              ]),
            );
            onChange([...items, blank]);
            setExpanded(items.length);
          }}
          className="btn-tertiary btn-sm mt-03 w-full justify-center"
        >
          Add item
        </button>
      ) : null}

      {error ? <p className="field-error">{error}</p> : null}
    </fieldset>
  );
}

/**
 * Which fields to offer.
 *
 * Derived from the block's own defaults so the form matches the schema exactly,
 * with structural fields the renderer owns filtered out.
 */
function editableFieldsFor(data: Record<string, unknown>, _blockKey: string): string[] {
  return Object.keys(data).filter((key) => !HIDDEN_FIELDS.has(key));
}

function humanize(value: string): string {
  return value
    .replace(/([A-Z])/g, ' $1')
    .replace(/^./, (character) => character.toUpperCase())
    .trim();
}
