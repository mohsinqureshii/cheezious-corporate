'use client';

import { useMemo, useState } from 'react';

import { API_URL } from '@/lib/api';

/**
 * Roles and permissions.
 *
 * A matrix rather than a list, because the question people actually have is
 * comparative — "what can an Author do that an Editor cannot" — and a hundred
 * checkboxes on eleven separate pages will not answer it.
 *
 * High-risk permissions are marked. Publishing, deleting, granting roles and
 * reading personal data are not the same kind of decision as editing a page,
 * and the interface should not present them as though they were.
 */

export interface Role {
  id: string;
  key: string;
  name: string;
  description: string | null;
  isSystem: boolean;
  userCount: number;
  permissions: string[];
}

export interface PermissionGroup {
  key: string;
  label: string;
  permissions: Array<{ key: string; isHighRisk: boolean }>;
}

export interface RoleMatrixProps {
  roles: Role[];
  catalogue: PermissionGroup[];
  canManage: boolean;
}

export function RoleMatrix({ roles: initialRoles, catalogue, canManage }: RoleMatrixProps) {
  const [roles, setRoles] = useState(initialRoles);
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [highRiskOnly, setHighRiskOnly] = useState(false);

  const groups = useMemo(
    () =>
      catalogue
        .map((group) => ({
          ...group,
          permissions: highRiskOnly ? group.permissions.filter((permission) => permission.isHighRisk) : group.permissions,
        }))
        .filter((group) => group.permissions.length > 0),
    [catalogue, highRiskOnly],
  );

  function startEditing(role: Role) {
    setEditing(role.id);
    setDraft(new Set(role.permissions));
    setError('');
  }

  async function save(role: Role) {
    setBusy(true);
    setError('');
    try {
      const response = await fetch(`${API_URL}/api/cms/system/roles/${role.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ permissions: [...draft] }),
      });
      if (!response.ok) {
        const body = (await response.json()) as { error?: { message: string } };
        setError(body.error?.message ?? 'The role could not be saved.');
        return;
      }
      setRoles((current) =>
        current.map((entry) => (entry.id === role.id ? { ...entry, permissions: [...draft] } : entry)),
      );
      setEditing(null);
    } catch {
      setError('We could not reach the server. Check your connection and try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="p-06">
      {error ? (
        <div className="mb-05 border-s-[3px] border-status-danger bg-status-dangerSubtle px-05 py-04" role="alert">
          <p className="text-body-01 text-content-primary">{error}</p>
        </div>
      ) : null}

      <div className="mb-05 flex flex-wrap items-center gap-04">
        <label className="flex items-center gap-02 text-body-compact text-content-secondary">
          <input
            type="checkbox"
            className="checkbox"
            checked={highRiskOnly}
            onChange={(event) => setHighRiskOnly(event.target.checked)}
          />
          Show only high-risk permissions
        </label>
        <p className="text-helper-01 text-content-tertiary">
          Publishing, deleting, granting roles and reading personal data are marked. Hiding a control in the
          interface is never the control — the API checks every one of these independently.
        </p>
      </div>

      <div className="panel scrollbar-thin overflow-x-auto">
        <table className="data-table">
          <caption className="sr-only">Roles and the permissions each one holds</caption>
          <thead>
            <tr>
              <th scope="col" className="sticky start-0 z-10 bg-surface-subtle">
                Permission
              </th>
              {roles.map((role) => (
                <th key={role.id} scope="col" className="min-w-28 text-center align-bottom">
                  <span className="block text-content-primary">{role.name}</span>
                  <span className="block text-helper-01 font-normal text-content-tertiary">
                    {role.userCount} user{role.userCount === 1 ? '' : 's'}
                  </span>
                  {canManage && !role.isSystem ? (
                    editing === role.id ? (
                      <span className="mt-01 flex justify-center gap-02">
                        <button type="button" className="text-helper-01 text-interactive" disabled={busy} onClick={() => save(role)}>
                          Save
                        </button>
                        <button type="button" className="text-helper-01 text-content-secondary" onClick={() => setEditing(null)}>
                          Cancel
                        </button>
                      </span>
                    ) : (
                      <button
                        type="button"
                        className="mt-01 text-helper-01 font-normal text-interactive"
                        onClick={() => startEditing(role)}
                      >
                        Edit
                      </button>
                    )
                  ) : null}
                </th>
              ))}
            </tr>
          </thead>

          {groups.map((group) => (
            <tbody key={group.key}>
              <tr>
                <th
                  scope="colgroup"
                  colSpan={roles.length + 1}
                  className="sticky start-0 bg-surface-subtle text-start text-label-01 uppercase tracking-wide text-content-tertiary"
                >
                  {group.label}
                </th>
              </tr>
              {group.permissions.map((permission) => (
                <tr key={permission.key}>
                  <th scope="row" className="sticky start-0 bg-surface-base text-start font-normal">
                    <span className="font-mono text-helper-01 text-content-primary">{permission.key}</span>
                    {permission.isHighRisk ? (
                      <span className="ms-02 tag bg-status-warningSubtle text-content-primary">High risk</span>
                    ) : null}
                  </th>
                  {roles.map((role) => {
                    const held = editing === role.id ? draft.has(permission.key) : role.permissions.includes(permission.key);
                    return (
                      <td key={role.id} className="text-center">
                        {editing === role.id ? (
                          <input
                            type="checkbox"
                            className="checkbox"
                            checked={held}
                            aria-label={`${permission.key} for ${role.name}`}
                            onChange={(event) =>
                              setDraft((current) => {
                                const next = new Set(current);
                                if (event.target.checked) next.add(permission.key);
                                else next.delete(permission.key);
                                return next;
                              })
                            }
                          />
                        ) : held ? (
                          <span className="text-status-success" title={`${role.name} holds ${permission.key}`}>
                            ✓<span className="sr-only">{`${role.name} holds ${permission.key}`}</span>
                          </span>
                        ) : (
                          <span className="text-content-tertiary">
                            ·<span className="sr-only">{`${role.name} does not hold ${permission.key}`}</span>
                          </span>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          ))}
        </table>
      </div>

      <div className="mt-05 grid gap-04 md:grid-cols-2 xl:grid-cols-3">
        {roles.map((role) => (
          <div key={role.id} className="panel p-05">
            <p className="text-heading-compact text-content-primary">{role.name}</p>
            <p className="mt-01 font-mono text-helper-01 text-content-tertiary">{role.key}</p>
            {role.description ? (
              <p className="mt-02 text-body-01 text-content-secondary">{role.description}</p>
            ) : null}
            {role.isSystem ? (
              <p className="mt-02 text-helper-01 text-content-tertiary">
                A system role. Its permissions are fixed so the platform cannot be locked out of itself.
              </p>
            ) : null}
          </div>
        ))}
      </div>
    </div>
  );
}
