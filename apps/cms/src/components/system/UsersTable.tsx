'use client';

import { formatDate, formatRelativeTime } from '@cheezious/utilities';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useState, useTransition } from 'react';

import { DataTable, EmptyState, FilterBar, Pagination, type Column } from '@/components/ui';
import { API_URL } from '@/lib/api';
import type { ListMeta } from '@/lib/types';

/**
 * User administration.
 *
 * Roles are shown on every row, because "who can publish" is the question this
 * screen exists to answer and making someone open each account to find out is
 * how the wrong person keeps a permission for a year.
 *
 * An invited account is issued a temporary password that is shown once, here,
 * to the person doing the inviting. It is never stored in readable form and
 * never emailed from this screen — passing it on is a deliberate act.
 */

export interface UserRow {
  id: string;
  name: string;
  email: string;
  jobTitle: string | null;
  status: string;
  lastLoginAt: string | null;
  createdAt: string;
  mustChangePassword: boolean;
  roles: Array<{ role: { id: string; key: string; name: string } }>;
}

export interface RoleOption {
  id: string;
  key: string;
  name: string;
}

export interface UsersTableProps {
  rows: UserRow[];
  meta: ListMeta;
  roles: RoleOption[];
  canManage: boolean;
  initialQuery: { q: string; status: string; roleKey: string };
}

export function UsersTable({ rows, meta, roles, canManage, initialQuery }: UsersTableProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const [search, setSearch] = useState(initialQuery.q);
  const [inviting, setInviting] = useState(false);
  const [editing, setEditing] = useState<UserRow | null>(null);

  const setParam = useCallback(
    (key: string, value: string | null) => {
      const params = new URLSearchParams(searchParams.toString());
      if (value === null || value === '') params.delete(key);
      else params.set(key, value);
      if (key !== 'page') params.delete('page');
      startTransition(() => router.push(`${pathname}?${params.toString()}`));
    },
    [pathname, router, searchParams],
  );

  const columns: Column<UserRow>[] = [
    {
      key: 'name',
      header: 'Name',
      render: (row) => (
        <span>
          <span className="block text-content-primary">{row.name}</span>
          <span className="block truncate text-helper-01 text-content-tertiary">{row.email}</span>
        </span>
      ),
      width: '24%',
    },
    { key: 'jobTitle', header: 'Job title', render: (row) => row.jobTitle ?? '—' },
    {
      key: 'roles',
      header: 'Roles',
      render: (row) => (
        <span className="flex flex-wrap gap-01">
          {row.roles.length === 0 ? (
            <span className="text-status-warning">No roles</span>
          ) : (
            row.roles.map(({ role }) => (
              <span key={role.id} className="tag bg-gray-20 text-content-primary">
                {role.name}
              </span>
            ))
          )}
        </span>
      ),
      width: '28%',
    },
    {
      key: 'status',
      header: 'Status',
      width: '150px',
      render: (row) => (
        <span className="flex flex-wrap items-center gap-01">
          <span
            className={[
              'tag',
              row.status === 'ACTIVE'
                ? 'bg-status-successSubtle text-content-primary'
                : 'bg-status-dangerSubtle text-content-primary',
            ].join(' ')}
          >
            {row.status === 'ACTIVE' ? 'Active' : 'Disabled'}
          </span>
          {row.mustChangePassword ? (
            <span className="tag bg-status-warningSubtle text-content-primary">
              Password pending
            </span>
          ) : null}
        </span>
      ),
    },
    {
      key: 'lastLoginAt',
      header: 'Last signed in',
      width: '150px',
      render: (row) =>
        row.lastLoginAt ? (
          <time dateTime={row.lastLoginAt} title={formatDate(row.lastLoginAt)}>
            {formatRelativeTime(row.lastLoginAt)}
          </time>
        ) : (
          <span className="text-content-tertiary">Never</span>
        ),
    },
    ...(canManage
      ? [
          {
            key: 'actions',
            header: 'Actions',
            align: 'end' as const,
            width: '90px',
            render: (row: UserRow) => (
              <button
                type="button"
                onClick={() => setEditing(row)}
                className="text-interactive hover:underline"
              >
                Edit
                <span className="sr-only"> {row.name}</span>
              </button>
            ),
          },
        ]
      : []),
  ];

  return (
    <div className="p-06">
      <div className="panel">
        <FilterBar resultCount={meta.total}>
          <form
            onSubmit={(event) => {
              event.preventDefault();
              setParam('q', search);
            }}
            className="flex items-center"
          >
            <label htmlFor="users-search" className="sr-only">
              Search users
            </label>
            <input
              id="users-search"
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search by name or email"
              className="input w-64"
            />
          </form>

          <label htmlFor="users-role" className="sr-only">
            Filter by role
          </label>
          <select
            id="users-role"
            className="select w-56"
            value={initialQuery.roleKey}
            onChange={(event) => setParam('roleKey', event.target.value || null)}
          >
            <option value="">All roles</option>
            {roles.map((role) => (
              <option key={role.id} value={role.key}>
                {role.name}
              </option>
            ))}
          </select>

          <label htmlFor="users-status" className="sr-only">
            Filter by status
          </label>
          <select
            id="users-status"
            className="select w-40"
            value={initialQuery.status}
            onChange={(event) => setParam('status', event.target.value || null)}
          >
            <option value="">Active and disabled</option>
            <option value="ACTIVE">Active</option>
            <option value="DISABLED">Disabled</option>
          </select>

          {canManage ? (
            <button
              type="button"
              className="btn-primary btn-sm ms-auto"
              onClick={() => setInviting(true)}
            >
              Invite someone
            </button>
          ) : null}
        </FilterBar>

        <div
          className={isPending ? 'opacity-60 transition-opacity duration-fast' : undefined}
          aria-busy={isPending}
        >
          <DataTable
            caption="CMS users"
            columns={columns}
            rows={rows}
            emptyState={
              <EmptyState
                title="Nobody matches those filters"
                description="Try a different search."
              />
            }
          />
        </div>

        {meta.total > meta.pageSize ? (
          <Pagination
            page={meta.page}
            pageSize={meta.pageSize}
            total={meta.total}
            onPageChange={(next) => setParam('page', String(next))}
          />
        ) : null}
      </div>

      {inviting ? (
        <InviteDialog
          roles={roles}
          onClose={() => setInviting(false)}
          onDone={() => router.refresh()}
        />
      ) : null}
      {editing ? (
        <EditUserDialog
          user={editing}
          roles={roles}
          onClose={() => setEditing(null)}
          onDone={() => {
            setEditing(null);
            router.refresh();
          }}
        />
      ) : null}
    </div>
  );
}

function Dialog({
  title,
  children,
  onClose,
}: {
  title: string;
  children: React.ReactNode;
  onClose: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-modal flex items-center justify-center bg-gray-100/50 p-05"
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <div className="absolute inset-0" onClick={onClose} aria-hidden="true" />
      <div className="relative max-h-[85vh] w-full max-w-lg overflow-y-auto border border-border-subtle bg-surface-base p-06 shadow-modal">
        <div className="flex items-start justify-between gap-03">
          <h2 className="text-heading-compact text-content-primary">{title}</h2>
          <button type="button" onClick={onClose} className="btn-ghost btn-sm">
            Close
          </button>
        </div>
        <div className="mt-05">{children}</div>
      </div>
    </div>
  );
}

function InviteDialog({
  roles,
  onClose,
  onDone,
}: {
  roles: RoleOption[];
  onClose: () => void;
  onDone: () => void;
}) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [jobTitle, setJobTitle] = useState('');
  const [roleIds, setRoleIds] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [issued, setIssued] = useState<{ name: string; password: string } | null>(null);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError('');

    try {
      const response = await fetch(`${API_URL}/api/cms/system/users`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ name, email, jobTitle: jobTitle || undefined, roleIds }),
      });
      const body = (await response.json()) as {
        user?: { name: string };
        temporaryPassword?: string;
        error?: { message: string; fields?: Array<{ message: string }> };
      };

      if (!response.ok) {
        setError(
          body.error?.fields?.[0]?.message ??
            body.error?.message ??
            'The invitation could not be created.',
        );
        return;
      }

      setIssued({ name: body.user?.name ?? name, password: body.temporaryPassword ?? '' });
      onDone();
    } catch {
      setError('We could not reach the server. Check your connection and try again.');
    } finally {
      setBusy(false);
    }
  }

  if (issued) {
    return (
      <Dialog title="Account created" onClose={onClose}>
        <p className="text-body-01 text-content-primary">
          {issued.name} can now sign in and will be made to choose a new password immediately.
        </p>
        <p className="mt-04 field-label">Temporary password</p>
        <p className="select-all break-all border border-border-subtle bg-surface-subtle px-04 py-03 font-mono text-body-01">
          {issued.password}
        </p>
        <p className="mt-03 text-helper-01 text-content-secondary">
          This is shown once and is not stored in readable form. Pass it on through a channel you
          trust — not in the same message as the sign-in link.
        </p>
        <button type="button" onClick={onClose} className="btn-primary mt-05">
          Done
        </button>
      </Dialog>
    );
  }

  return (
    <Dialog title="Invite someone" onClose={onClose}>
      <form onSubmit={submit} className="space-y-05">
        {error ? (
          <p
            className="border-s-[3px] border-status-danger bg-status-dangerSubtle px-03 py-02 text-helper-01"
            role="alert"
          >
            {error}
          </p>
        ) : null}

        <div>
          <label htmlFor="invite-name" className="field-label">
            Name
          </label>
          <input
            id="invite-name"
            className="input"
            value={name}
            required
            onChange={(event) => setName(event.target.value)}
            // A dialog takes focus when it opens: WAI-ARIA asks for it, and without
            // it a keyboard user is left behind the overlay with nothing focused.
            // eslint-disable-next-line jsx-a11y/no-autofocus
            autoFocus
          />
        </div>

        <div>
          <label htmlFor="invite-email" className="field-label">
            Email address
          </label>
          <input
            id="invite-email"
            type="email"
            className="input"
            value={email}
            required
            onChange={(event) => setEmail(event.target.value)}
          />
        </div>

        <div>
          <label htmlFor="invite-job-title" className="field-label">
            Job title
          </label>
          <input
            id="invite-job-title"
            className="input"
            value={jobTitle}
            onChange={(event) => setJobTitle(event.target.value)}
          />
        </div>

        <RolePicker roles={roles} selected={roleIds} onChange={setRoleIds} />

        <button
          type="submit"
          disabled={busy || roleIds.length === 0 || !name || !email}
          className="btn-primary"
        >
          {busy ? 'Creating…' : 'Create account'}
        </button>
      </form>
    </Dialog>
  );
}

function EditUserDialog({
  user,
  roles,
  onClose,
  onDone,
}: {
  user: UserRow;
  roles: RoleOption[];
  onClose: () => void;
  onDone: () => void;
}) {
  const [name, setName] = useState(user.name);
  const [jobTitle, setJobTitle] = useState(user.jobTitle ?? '');
  const [status, setStatus] = useState(user.status);
  const [roleIds, setRoleIds] = useState(user.roles.map(({ role }) => role.id));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError('');

    try {
      const response = await fetch(`${API_URL}/api/cms/system/users/${user.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ name, jobTitle: jobTitle || null, status, roleIds }),
      });
      if (!response.ok) {
        const body = (await response.json()) as { error?: { message: string } };
        setError(body.error?.message ?? 'The changes could not be saved.');
        return;
      }
      onDone();
    } catch {
      setError('We could not reach the server. Check your connection and try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog title={user.name} onClose={onClose}>
      <form onSubmit={submit} className="space-y-05">
        {error ? (
          <p
            className="border-s-[3px] border-status-danger bg-status-dangerSubtle px-03 py-02 text-helper-01"
            role="alert"
          >
            {error}
          </p>
        ) : null}

        <p className="text-helper-01 text-content-secondary">{user.email}</p>

        <div>
          <label htmlFor="edit-name" className="field-label">
            Name
          </label>
          <input
            id="edit-name"
            className="input"
            value={name}
            required
            onChange={(event) => setName(event.target.value)}
          />
        </div>

        <div>
          <label htmlFor="edit-job-title" className="field-label">
            Job title
          </label>
          <input
            id="edit-job-title"
            className="input"
            value={jobTitle}
            onChange={(event) => setJobTitle(event.target.value)}
          />
        </div>

        <div>
          <label htmlFor="edit-status" className="field-label">
            Status
          </label>
          <select
            id="edit-status"
            className="select"
            value={status}
            onChange={(event) => setStatus(event.target.value)}
          >
            <option value="ACTIVE">Active</option>
            <option value="DISABLED">Disabled</option>
          </select>
          <p className="field-helper">
            Disabling an account ends its sessions immediately — it does not wait for them to
            expire.
          </p>
        </div>

        <RolePicker roles={roles} selected={roleIds} onChange={setRoleIds} />

        <button type="submit" disabled={busy} className="btn-primary">
          {busy ? 'Saving…' : 'Save changes'}
        </button>
      </form>
    </Dialog>
  );
}

function RolePicker({
  roles,
  selected,
  onChange,
}: {
  roles: RoleOption[];
  selected: string[];
  onChange: (ids: string[]) => void;
}) {
  return (
    <fieldset>
      <legend className="field-label">Roles</legend>
      <p className="field-helper mb-02">
        Roles decide what this person can do. Give the narrowest set that lets them do their job.
      </p>
      <div className="max-h-56 space-y-02 overflow-y-auto border border-border-subtle p-03">
        {roles.map((role) => (
          <label key={role.id} className="flex items-center gap-03">
            <input
              type="checkbox"
              className="checkbox"
              checked={selected.includes(role.id)}
              onChange={(event) =>
                onChange(
                  event.target.checked
                    ? [...selected, role.id]
                    : selected.filter((id) => id !== role.id),
                )
              }
            />
            <span className="text-body-compact text-content-primary">{role.name}</span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}
