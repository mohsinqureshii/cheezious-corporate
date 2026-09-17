'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { API_URL } from '@/lib/api';

/**
 * The navigation editor.
 *
 * A menu is a tree, so it is edited as one: each item shows where it points and,
 * when that is broken, says so. An item aimed at a deleted or unpublished page
 * is the most common way a corporate site acquires a 404, and it is invisible
 * until a visitor finds it — so it is surfaced here rather than discovered
 * there.
 *
 * Reordering is saved in one request, so dragging does not produce a burst of
 * writes and a half-applied order.
 */

export interface NavigationItem {
  id: string;
  kind: string;
  label: string;
  descriptor: string | null;
  pageId: string | null;
  externalUrl: string | null;
  opensInNewTab: boolean;
  isCallToAction: boolean;
  parentId: string | null;
  sortOrder: number;
  isVisible: boolean;
  page: { id: string; title: string; path: string; status: string } | null;
  problem: string | null;
}

export interface Navigation {
  id: string;
  key: string;
  label: string;
  location: string;
  locale: string;
  isEnabled: boolean;
  items: NavigationItem[];
}

export function NavigationEditor({
  navigations,
  canManage,
}: {
  navigations: Navigation[];
  canManage: boolean;
}) {
  const [selected, setSelected] = useState(navigations[0]?.id ?? '');
  const navigation = navigations.find((entry) => entry.id === selected) ?? navigations[0];

  if (!navigation) {
    return (
      <div className="p-06">
        <p className="text-body-01 text-content-secondary">No navigation is configured yet.</p>
      </div>
    );
  }

  const problems = navigation.items.filter((item) => item.problem !== null);
  const roots = navigation.items.filter((item) => item.parentId === null);

  return (
    <div className="p-06">
      <div className="mb-05 flex flex-wrap items-center gap-04">
        <label htmlFor="navigation-picker" className="field-label mb-0">
          Menu
        </label>
        <select
          id="navigation-picker"
          className="select w-72"
          value={navigation.id}
          onChange={(event) => setSelected(event.target.value)}
        >
          {navigations.map((entry) => (
            <option key={entry.id} value={entry.id}>
              {entry.label} — {entry.location.toLowerCase()} ({entry.locale})
            </option>
          ))}
        </select>
        {!navigation.isEnabled ? (
          <span className="tag bg-status-warningSubtle text-content-primary">Disabled</span>
        ) : null}
      </div>

      {problems.length > 0 ? (
        <div
          className="mb-05 border-s-[3px] border-status-danger bg-status-dangerSubtle px-05 py-04"
          role="alert"
        >
          <p className="text-heading-compact text-content-primary">
            {problems.length} item{problems.length === 1 ? '' : 's'} will not work
          </p>
          <ul className="mt-02 space-y-01">
            {problems.map((item) => (
              <li key={item.id} className="text-helper-01 text-content-secondary">
                <strong className="font-medium text-content-primary">{item.label}</strong> —{' '}
                {item.problem}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="panel">
        <ul className="divide-y divide-border-subtle">
          {roots.map((item) => (
            <NavigationRow
              key={item.id}
              item={item}
              children={navigation.items.filter((child) => child.parentId === item.id)}
              grandchildren={navigation.items}
              canManage={canManage}
            />
          ))}
        </ul>
      </div>

      <p className="mt-04 text-helper-01 text-content-tertiary">
        Changes here are live as soon as they are saved. The menu is not versioned, so a mistake is
        corrected rather than rolled back.
      </p>
    </div>
  );
}

function NavigationRow({
  item,
  children,
  grandchildren,
  canManage,
  depth = 0,
}: {
  item: NavigationItem;
  children: NavigationItem[];
  grandchildren: NavigationItem[];
  canManage: boolean;
  depth?: number;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function toggleVisible() {
    setBusy(true);
    try {
      await fetch(`${API_URL}/api/cms/structure/navigation/items/${item.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ isVisible: !item.isVisible }),
      });
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <li className="px-05 py-03" style={{ paddingInlineStart: `${20 + depth * 24}px` }}>
        <div className="flex flex-wrap items-center gap-03">
          <span className="flex-1 min-w-0">
            <span className="flex flex-wrap items-center gap-02">
              <span
                className={
                  item.isVisible
                    ? 'text-body-compact text-content-primary'
                    : 'text-body-compact text-content-tertiary line-through'
                }
              >
                {item.label}
              </span>
              <span className="text-label-01 uppercase text-content-tertiary">
                {item.kind.toLowerCase()}
              </span>
              {item.isCallToAction ? (
                <span className="tag bg-interactive-subtle text-content-primary">CTA</span>
              ) : null}
              {item.problem ? (
                <span className="tag bg-status-dangerSubtle text-content-primary">Broken</span>
              ) : null}
            </span>
            <span className="mt-01 block truncate font-mono text-helper-01 text-content-tertiary">
              {item.page?.path ?? item.externalUrl ?? '—'}
            </span>
          </span>

          {canManage ? (
            <button
              type="button"
              onClick={toggleVisible}
              disabled={busy}
              className="btn-ghost btn-sm"
            >
              {item.isVisible ? 'Hide' : 'Show'}
              <span className="sr-only"> {item.label}</span>
            </button>
          ) : null}
        </div>
      </li>

      {children.map((child) => (
        <NavigationRow
          key={child.id}
          item={child}
          children={grandchildren.filter((entry) => entry.parentId === child.id)}
          grandchildren={grandchildren}
          canManage={canManage}
          depth={depth + 1}
        />
      ))}
    </>
  );
}
