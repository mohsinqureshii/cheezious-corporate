import { STATUS_META, type ContentStatus } from '@cheezious/permissions';
import Link from 'next/link';
import type { ReactNode } from 'react';

/**
 * CMS interface primitives.
 *
 * The pieces every screen is built from, so density, status language and empty
 * states stay identical across thirty-odd list views.
 */

// ---------------------------------------------------------------------------
// Status
// ---------------------------------------------------------------------------

const TONE_CLASSES: Record<string, string> = {
  neutral: 'bg-gray-20 text-content-primary',
  info: 'bg-status-infoSubtle text-status-info',
  warning: 'bg-status-warningSubtle text-gray-90',
  success: 'bg-status-successSubtle text-status-success',
  muted: 'bg-gray-10 text-content-tertiary',
  danger: 'bg-status-dangerSubtle text-status-danger',
};

type Tone = 'neutral' | 'info' | 'warning' | 'success' | 'muted' | 'danger';

/**
 * Tones for statuses outside the editorial workflow.
 *
 * Applications, supplier submissions and property leads have their own
 * lifecycles. Without this they would all render neutral grey, which would make
 * the single most-scanned column in every queue useless.
 */
const SUBMISSION_TONES: Record<string, Tone> = {
  // Shared across queues
  NEW: 'info',
  REVIEWING: 'warning',
  ARCHIVED: 'muted',
  REJECTED: 'danger',
  // Applications
  SHORTLISTED: 'info',
  INTERVIEW: 'info',
  OFFER: 'success',
  HIRED: 'success',
  WITHDRAWN: 'muted',
  // Suppliers
  QUALIFIED: 'info',
  CONTACTED: 'info',
  APPROVED: 'success',
  // Properties
  INTERESTING: 'info',
  SITE_VISIT: 'warning',
  ACCEPTED: 'success',
  // Partnerships
  IN_DISCUSSION: 'warning',
  DECLINED: 'danger',
  // Contact
  IN_PROGRESS: 'warning',
  ANSWERED: 'success',
  CLOSED: 'muted',
  SPAM: 'danger',
  // Jobs
  OPEN: 'success',
  PAUSED: 'warning',
};

/**
 * Status tag.
 *
 * Carries a dot as well as a colour: colour alone excludes anyone with a colour
 * vision deficiency, and status is the single most scanned column in every list
 * in this application.
 */
/**
 * Resolve a status to a tone.
 *
 * Extracted so the return type is the full `Tone` union: assigning the
 * expression inline lets TypeScript narrow it to the editorial subset and then
 * reject the `danger` branch below.
 */
function resolveTone(status: string): Tone {
  const meta = STATUS_META[status as ContentStatus];
  if (meta) return meta.tone;
  return SUBMISSION_TONES[status] ?? 'neutral';
}

export function StatusTag({
  status,
  size = 'default',
}: {
  status: ContentStatus | string;
  size?: 'default' | 'sm';
}) {
  const meta = STATUS_META[status as ContentStatus];
  const label = meta?.label ?? humanize(status);
  const tone = resolveTone(status);

  return (
    <span
      className={[
        'tag',
        TONE_CLASSES[tone] ?? TONE_CLASSES.neutral,
        size === 'sm' ? 'text-[11px]' : '',
      ].join(' ')}
    >
      <span
        aria-hidden="true"
        className={[
          'inline-block h-1.5 w-1.5 rounded-full',
          tone === 'success' ? 'bg-status-success' : '',
          tone === 'warning' ? 'bg-status-warning' : '',
          tone === 'info' ? 'bg-status-info' : '',
          tone === 'danger' ? 'bg-status-danger' : '',
          tone === 'neutral' ? 'bg-gray-60' : '',
          tone === 'muted' ? 'bg-gray-40' : '',
        ].join(' ')}
      />
      {label}
    </span>
  );
}

/** Marks a published record that has edits not yet live. */
export function UnpublishedChangesTag() {
  return (
    <span
      className="tag bg-status-warningSubtle text-gray-90"
      title="This page has edits that are not live yet"
    >
      <span
        aria-hidden="true"
        className="inline-block h-1.5 w-1.5 rounded-full bg-status-warning"
      />
      Unpublished changes
    </span>
  );
}

// ---------------------------------------------------------------------------
// Page furniture
// ---------------------------------------------------------------------------

export function PageHeader({
  title,
  description,
  breadcrumb,
  actions,
}: {
  title: string;
  description?: string;
  breadcrumb?: Array<{ label: string; href?: string }>;
  actions?: ReactNode;
}) {
  return (
    <div className="page-header">
      {breadcrumb && breadcrumb.length > 0 ? (
        <nav aria-label="Breadcrumb" className="mb-02">
          <ol className="flex flex-wrap items-center gap-02 text-label-01">
            {breadcrumb.map((crumb, index) => (
              <li key={`${crumb.label}-${index}`} className="flex items-center gap-02">
                {crumb.href ? (
                  <Link href={crumb.href} className="text-interactive no-underline hover:underline">
                    {crumb.label}
                  </Link>
                ) : (
                  <span className="text-content-secondary">{crumb.label}</span>
                )}
                {index < breadcrumb.length - 1 ? (
                  <span aria-hidden="true" className="text-content-tertiary">
                    /
                  </span>
                ) : null}
              </li>
            ))}
          </ol>
        </nav>
      ) : null}

      <div className="flex flex-wrap items-start justify-between gap-04">
        <div>
          <h1 className="text-heading-04 text-content-primary">{title}</h1>
          {description ? (
            <p className="mt-02 max-w-2xl text-body-01 text-content-secondary">{description}</p>
          ) : null}
        </div>
        {actions ? <div className="flex flex-wrap items-center gap-03">{actions}</div> : null}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Data table
// ---------------------------------------------------------------------------

export interface Column<T> {
  key: string;
  header: string;
  /** Renders the cell. Kept explicit so no column silently prints [object Object]. */
  render: (row: T) => ReactNode;
  width?: string;
  align?: 'start' | 'end';
  sortable?: boolean;
}

export function DataTable<T extends { id: string }>({
  columns,
  rows,
  selectable = false,
  selectedIds = [],
  onToggle,
  onToggleAll,
  rowHref,
  emptyState,
  caption,
}: {
  columns: Array<Column<T>>;
  rows: T[];
  selectable?: boolean;
  selectedIds?: string[];
  onToggle?: (id: string) => void;
  onToggleAll?: () => void;
  rowHref?: (row: T) => string;
  emptyState?: ReactNode;
  caption: string;
}) {
  if (rows.length === 0 && emptyState) {
    return <>{emptyState}</>;
  }

  const allSelected = rows.length > 0 && selectedIds.length === rows.length;

  return (
    // `relative` matters: the visually-hidden spans inside cells are
    // absolutely positioned, and without a positioned ancestor their
    // containing block is the page — so they escape this container's clip and
    // make the whole document scroll sideways by the width of the table.
    <div className="scrollbar-thin relative overflow-x-auto">
      <table className="data-table">
        {/* Every table is captioned for screen readers; sighted users get the
            page heading instead. */}
        <caption className="sr-only">{caption}</caption>

        <thead>
          <tr>
            {selectable ? (
              <th scope="col" className="w-10">
                <input
                  type="checkbox"
                  className="checkbox"
                  checked={allSelected}
                  onChange={onToggleAll}
                  aria-label={allSelected ? 'Deselect all rows' : 'Select all rows'}
                />
              </th>
            ) : null}
            {columns.map((column) => (
              <th
                key={column.key}
                scope="col"
                style={column.width ? { width: column.width } : undefined}
                className={column.align === 'end' ? 'text-right' : undefined}
              >
                {column.header}
              </th>
            ))}
          </tr>
        </thead>

        <tbody>
          {rows.map((row) => {
            const selected = selectedIds.includes(row.id);
            return (
              <tr key={row.id} data-selected={selected}>
                {selectable ? (
                  <td>
                    <input
                      type="checkbox"
                      className="checkbox"
                      checked={selected}
                      onChange={() => onToggle?.(row.id)}
                      aria-label={`Select row ${row.id}`}
                    />
                  </td>
                ) : null}

                {columns.map((column, index) => (
                  <td
                    key={column.key}
                    className={column.align === 'end' ? 'text-right' : undefined}
                  >
                    {/* The first column links to the record, so the primary
                        action is discoverable without hunting for an icon. */}
                    {index === 0 && rowHref ? (
                      <Link
                        href={rowHref(row)}
                        className="font-medium text-interactive no-underline hover:underline"
                      >
                        {column.render(row)}
                      </Link>
                    ) : (
                      column.render(row)
                    )}
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ---------------------------------------------------------------------------
// States
// ---------------------------------------------------------------------------

/**
 * Empty state.
 *
 * Always tells the user what this screen is for and offers the action that
 * fills it. "No data" is not an empty state, it is a dead end.
 */
export function EmptyState({
  title,
  description,
  action,
  icon,
}: {
  title: string;
  description?: string;
  action?: { label: string; href: string };
  icon?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center border border-dashed border-border-subtle bg-surface-base px-06 py-10 text-center">
      {icon ? <div className="mb-04 text-content-tertiary">{icon}</div> : null}
      <h2 className="text-heading-02 text-content-primary">{title}</h2>
      {description ? (
        <p className="mt-02 max-w-md text-body-01 text-content-secondary">{description}</p>
      ) : null}
      {action ? (
        <Link href={action.href} className="btn-primary mt-05 no-underline">
          {action.label}
        </Link>
      ) : null}
    </div>
  );
}

export function ErrorState({
  title = 'Something went wrong',
  description,
  onRetry,
}: {
  title?: string;
  description?: string;
  onRetry?: () => void;
}) {
  return (
    <div
      className="border-s-[3px] border-status-danger bg-status-dangerSubtle px-05 py-04"
      role="alert"
    >
      <p className="text-heading-compact text-content-primary">{title}</p>
      {description ? (
        <p className="mt-02 text-body-01 text-content-secondary">{description}</p>
      ) : null}
      {onRetry ? (
        <button type="button" onClick={onRetry} className="btn-tertiary btn-sm mt-04">
          Try again
        </button>
      ) : null}
    </div>
  );
}

/** Skeleton rows, sized to the real table so the layout does not jump on load. */
export function TableSkeleton({ columns, rows = 8 }: { columns: number; rows?: number }) {
  return (
    <div className="overflow-hidden" aria-busy="true" aria-live="polite">
      <span className="sr-only">Loading…</span>
      <table className="data-table">
        <tbody>
          {Array.from({ length: rows }).map((_, rowIndex) => (
            <tr key={rowIndex}>
              {Array.from({ length: columns }).map((__, columnIndex) => (
                <td key={columnIndex}>
                  <span
                    className="block h-4 animate-pulse rounded-sm bg-gray-20"
                    style={{ width: `${40 + ((rowIndex * 7 + columnIndex * 13) % 50)}%` }}
                  />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Inline notification, Carbon's standard banner for in-page messaging. */
export function InlineNotification({
  kind = 'info',
  title,
  children,
  onDismiss,
}: {
  kind?: 'info' | 'success' | 'warning' | 'error';
  title: string;
  children?: ReactNode;
  onDismiss?: () => void;
}) {
  const styles: Record<string, string> = {
    info: 'border-status-info bg-status-infoSubtle',
    success: 'border-status-success bg-status-successSubtle',
    warning: 'border-status-warning bg-status-warningSubtle',
    error: 'border-status-danger bg-status-dangerSubtle',
  };

  return (
    <div
      className={['flex items-start gap-04 border-s-[3px] px-05 py-04', styles[kind]].join(' ')}
      role={kind === 'error' ? 'alert' : 'status'}
    >
      <div className="flex-1">
        <p className="text-heading-compact text-content-primary">{title}</p>
        {children ? (
          <div className="mt-01 text-body-01 text-content-secondary">{children}</div>
        ) : null}
      </div>
      {onDismiss ? (
        <button
          type="button"
          onClick={onDismiss}
          className="shrink-0 text-content-secondary hover:text-content-primary"
          aria-label="Dismiss"
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
            <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.3" />
          </svg>
        </button>
      ) : null}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Filters and pagination
// ---------------------------------------------------------------------------

export function FilterBar({
  children,
  resultCount,
}: {
  children: ReactNode;
  resultCount?: number;
}) {
  return (
    <div className="flex flex-wrap items-center gap-03 border-b border-border-subtle bg-surface-base px-05 py-03">
      {children}
      {typeof resultCount === 'number' ? (
        <span className="ms-auto text-body-compact text-content-secondary tabular">
          {resultCount} {resultCount === 1 ? 'item' : 'items'}
        </span>
      ) : null}
    </div>
  );
}

export function Pagination({
  page,
  pageSize,
  total,
  onPageChange,
}: {
  page: number;
  pageSize: number;
  total: number;
  onPageChange: (page: number) => void;
}) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const first = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const last = Math.min(page * pageSize, total);

  return (
    <nav
      aria-label="Pagination"
      className="flex items-center justify-between border-t border-border-subtle bg-surface-base px-05 py-03"
    >
      <p className="text-body-compact text-content-secondary tabular">
        {first}–{last} of {total}
      </p>

      <div className="flex items-center gap-02">
        <button
          type="button"
          className="btn-ghost btn-sm"
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
        >
          Previous
        </button>
        <span className="px-03 text-body-compact text-content-secondary tabular">
          Page {page} of {totalPages}
        </span>
        <button
          type="button"
          className="btn-ghost btn-sm"
          disabled={page >= totalPages}
          onClick={() => onPageChange(page + 1)}
        >
          Next
        </button>
      </div>
    </nav>
  );
}

/**
 * Bulk action bar.
 *
 * Carbon's pattern: it replaces the table header when a selection exists, so
 * the available actions appear exactly where the user is already looking.
 */
export function BulkActions({
  count,
  onCancel,
  children,
}: {
  count: number;
  onCancel: () => void;
  children: ReactNode;
}) {
  if (count === 0) return null;

  return (
    <div className="flex items-center justify-between bg-interactive px-05 py-02 text-content-inverse">
      <p className="text-body-compact tabular">
        {count} {count === 1 ? 'item' : 'items'} selected
      </p>
      <div className="flex items-center gap-03">
        {children}
        <button
          type="button"
          onClick={onCancel}
          className="text-body-compact underline underline-offset-2"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

/** Warns before a high-risk action. Requires typed confirmation for the worst. */
export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = 'Confirm',
  danger = false,
  requireTypedConfirmation,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  description: ReactNode;
  confirmLabel?: string;
  danger?: boolean;
  requireTypedConfirmation?: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-modal flex items-center justify-center bg-gray-100/50 p-05"
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-title"
    >
      <div className="absolute inset-0" onClick={onCancel} aria-hidden="true" />

      <div className="relative w-full max-w-md border border-border-subtle bg-surface-base shadow-modal">
        <div className="px-06 py-05">
          <h2 id="confirm-title" className="text-heading-03 text-content-primary">
            {title}
          </h2>
          <div className="mt-03 text-body-01 text-content-secondary">{description}</div>

          {requireTypedConfirmation ? (
            <div className="mt-05">
              <label htmlFor="confirm-input" className="field-label">
                Type <span className="font-mono font-semibold">{requireTypedConfirmation}</span> to
                confirm
              </label>
              <input id="confirm-input" className="input" autoComplete="off" />
            </div>
          ) : null}
        </div>

        <div className="flex justify-end gap-03 border-t border-border-subtle px-06 py-04">
          <button type="button" onClick={onCancel} className="btn-tertiary">
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className={danger ? 'btn-danger' : 'btn-primary'}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

function humanize(value: string): string {
  return value
    .toLowerCase()
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}
