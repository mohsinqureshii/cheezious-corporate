'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';

import { API_URL } from '@/lib/api';
import { QUICK_CREATE } from '@/lib/navigation';
import type { Principal } from '@/lib/permissions';

/**
 * The CMS header.
 *
 * Fixed, dark, and always present — Carbon's global header. It carries the four
 * things an operator needs from anywhere: search, create, notifications and
 * account.
 *
 * The command palette (Cmd/Ctrl+K) is the productivity feature that matters in
 * a system with this many screens: typing two letters and pressing Enter beats
 * three clicks through a sidebar, every time, for someone who lives here.
 */

export interface HeaderProps {
  user: Principal;
  unreadNotifications: number;
}

export function Header({ user, unreadNotifications }: HeaderProps) {
  const router = useRouter();
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const accountRef = useRef<HTMLDivElement>(null);
  const createRef = useRef<HTMLDivElement>(null);

  const granted = new Set(user.permissions);
  const createActions = QUICK_CREATE.filter((action) =>
    action.permissions.some((permission) => granted.has(permission)),
  );

  // Cmd/Ctrl+K opens the palette from anywhere. `/` is deliberately not bound:
  // it would hijack typing inside the content editor.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setPaletteOpen((open) => !open);
      }
      if (event.key === 'Escape') {
        setPaletteOpen(false);
        setAccountOpen(false);
        setCreateOpen(false);
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, []);

  useEffect(() => {
    if (!accountOpen && !createOpen) return;
    const onPointerDown = (event: PointerEvent) => {
      if (accountRef.current && !accountRef.current.contains(event.target as Node)) setAccountOpen(false);
      if (createRef.current && !createRef.current.contains(event.target as Node)) setCreateOpen(false);
    };
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, [accountOpen, createOpen]);

  async function signOut() {
    await fetch(`${API_URL}/api/auth/logout`, { method: 'POST', credentials: 'include' }).catch(() => undefined);
    router.push('/sign-in');
    router.refresh();
  }

  return (
    <>
      <a href="#cms-main" className="skip-link">
        Skip to content
      </a>

      <header className="fixed inset-x-0 top-0 z-header flex h-header items-center border-b border-gray-80 bg-gray-100">
        <div className="flex items-center gap-02 ps-12 lg:ps-05">
          <Link href="/" className="flex items-baseline gap-02 px-03 text-content-inverse no-underline">
            <span className="text-heading-compact font-semibold">Cheezious</span>
            <span className="text-label-01 uppercase tracking-wide text-gray-40">CMS</span>
          </Link>
        </div>

        <div className="flex-1" />

        <div className="flex items-center">
          {/* Search doubles as the palette trigger so there is one way in. */}
          <button
            type="button"
            onClick={() => setPaletteOpen(true)}
            className="flex h-header items-center gap-03 px-05 text-body-compact text-gray-30
                       transition-colors duration-fast hover:bg-gray-80 hover:text-content-inverse"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <circle cx="7" cy="7" r="4.5" stroke="currentColor" strokeWidth="1.3" />
              <path d="M10.5 10.5L14 14" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
            </svg>
            <span className="hidden sm:inline">Search</span>
            <kbd className="hidden rounded-sm border border-gray-70 px-02 py-[1px] font-mono text-label-01 text-gray-40 md:inline">
              ⌘K
            </kbd>
          </button>

          {createActions.length > 0 ? (
            <div ref={createRef} className="relative">
              <button
                type="button"
                onClick={() => setCreateOpen((open) => !open)}
                aria-expanded={createOpen}
                aria-haspopup="menu"
                className="flex h-header items-center gap-02 bg-interactive px-05 text-body-compact
                           text-content-inverse transition-colors duration-fast hover:bg-interactive-hover"
              >
                Create
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
                  <path d="M2 4l4 4 4-4" stroke="currentColor" strokeWidth="1.3" />
                </svg>
              </button>

              {createOpen ? (
                <ul
                  role="menu"
                  className="absolute end-0 top-full w-56 border border-border-subtle bg-surface-base shadow-menu"
                >
                  {createActions.map((action) => (
                    <li key={action.href} role="none">
                      <Link
                        href={action.href}
                        role="menuitem"
                        className="flex items-center justify-between px-05 py-03 text-body-compact
                                   text-content-primary no-underline hover:bg-surface-hover"
                        onClick={() => setCreateOpen(false)}
                      >
                        {action.label}
                        {action.shortcut ? (
                          <kbd className="font-mono text-label-01 text-content-tertiary">{action.shortcut}</kbd>
                        ) : null}
                      </Link>
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          ) : null}

          <Link
            href="/notifications"
            className="relative flex h-header items-center px-05 text-gray-30
                       transition-colors duration-fast hover:bg-gray-80 hover:text-content-inverse"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <path
                d="M8 2a4 4 0 00-4 4v3l-1 2h10l-1-2V6a4 4 0 00-4-4zM6.5 13a1.5 1.5 0 003 0"
                stroke="currentColor"
                strokeWidth="1.3"
                strokeLinejoin="round"
              />
            </svg>
            {unreadNotifications > 0 ? (
              <span className="absolute right-04 top-02 flex h-4 min-w-4 items-center justify-center rounded-full bg-status-danger px-[3px] text-[10px] font-semibold text-content-inverse tabular">
                {unreadNotifications > 9 ? '9+' : unreadNotifications}
              </span>
            ) : null}
            <span className="sr-only">
              Notifications{unreadNotifications > 0 ? `, ${unreadNotifications} unread` : ''}
            </span>
          </Link>

          <div ref={accountRef} className="relative">
            <button
              type="button"
              onClick={() => setAccountOpen((open) => !open)}
              aria-expanded={accountOpen}
              aria-haspopup="menu"
              className="flex h-header items-center gap-03 px-05 text-body-compact text-gray-30
                         transition-colors duration-fast hover:bg-gray-80 hover:text-content-inverse"
            >
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-gray-70 text-label-01 font-semibold text-content-inverse">
                {initials(user.name)}
              </span>
              <span className="hidden max-w-32 truncate md:inline">{user.name}</span>
            </button>

            {accountOpen ? (
              <div
                role="menu"
                className="absolute end-0 top-full w-64 border border-border-subtle bg-surface-base shadow-menu"
              >
                <div className="border-b border-border-subtle px-05 py-04">
                  <p className="text-heading-compact text-content-primary">{user.name}</p>
                  <p className="mt-01 truncate text-helper-01 text-content-secondary">{user.email}</p>
                  {user.roles.length > 0 ? (
                    <p className="mt-02 text-helper-01 text-content-tertiary">
                      {user.roles.map(humanizeRole).join(', ')}
                    </p>
                  ) : null}
                </div>

                <Link
                  href="/account"
                  role="menuitem"
                  className="block px-05 py-03 text-body-compact text-content-primary no-underline hover:bg-surface-hover"
                  onClick={() => setAccountOpen(false)}
                >
                  Account settings
                </Link>
                <Link
                  href="/account/sessions"
                  role="menuitem"
                  className="block px-05 py-03 text-body-compact text-content-primary no-underline hover:bg-surface-hover"
                  onClick={() => setAccountOpen(false)}
                >
                  Active sessions
                </Link>
                <button
                  type="button"
                  role="menuitem"
                  onClick={signOut}
                  className="block w-full border-t border-border-subtle px-05 py-03 text-left
                             text-body-compact text-content-primary hover:bg-surface-hover"
                >
                  Sign out
                </button>
              </div>
            ) : null}
          </div>
        </div>
      </header>

      {paletteOpen ? <CommandPalette onClose={() => setPaletteOpen(false)} permissions={granted} /> : null}
    </>
  );
}

/**
 * Command palette.
 *
 * Searches content and offers create actions in one list. Results are gated by
 * permission server-side; the create actions are filtered here so nothing
 * unusable is ever offered.
 */
function CommandPalette({ onClose, permissions }: { onClose: () => void; permissions: Set<string> }) {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Array<{ id: string; title: string; href: string; type: string }>>([]);
  const [highlighted, setHighlighted] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const actions = QUICK_CREATE.filter((action) =>
    action.permissions.some((permission) => permissions.has(permission)),
  ).map((action) => ({ id: action.href, title: `Create ${action.label.toLowerCase()}`, href: action.href, type: 'Action' }));

  const filteredActions = query
    ? actions.filter((action) => action.title.toLowerCase().includes(query.toLowerCase()))
    : actions;

  const items = [...filteredActions, ...results];

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Debounced so typing does not issue a request per keystroke.
  useEffect(() => {
    if (query.trim().length < 2) {
      setResults([]);
      return;
    }

    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const response = await fetch(
          `${API_URL}/api/cms/pages?q=${encodeURIComponent(query)}&pageSize=8`,
          { credentials: 'include', signal: controller.signal },
        );
        if (!response.ok) return;
        const body = (await response.json()) as { items: Array<{ id: string; title: string; path: string }> };
        setResults(
          body.items.map((item) => ({
            id: item.id,
            title: item.title,
            href: `/content/pages/${item.id}`,
            type: 'Page',
          })),
        );
      } catch {
        // An aborted or failed search simply shows no results.
      }
    }, 180);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query]);

  useEffect(() => setHighlighted(0), [query]);

  function onKeyDown(event: React.KeyboardEvent) {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setHighlighted((index) => Math.min(index + 1, items.length - 1));
    }
    if (event.key === 'ArrowUp') {
      event.preventDefault();
      setHighlighted((index) => Math.max(index - 1, 0));
    }
    if (event.key === 'Enter' && items[highlighted]) {
      event.preventDefault();
      router.push(items[highlighted]!.href);
      onClose();
    }
  }

  return (
    <div className="fixed inset-0 z-modal flex items-start justify-center bg-gray-100/50 pt-[10vh]" role="dialog" aria-modal="true" aria-label="Command palette">
      <div className="absolute inset-0" onClick={onClose} aria-hidden="true" />

      <div className="relative w-full max-w-xl border border-border-subtle bg-surface-base shadow-modal">
        <input
          ref={inputRef}
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={onKeyDown}
          placeholder="Search pages, or type to create…"
          aria-label="Search or run a command"
          aria-controls="palette-results"
          className="w-full border-0 border-b border-border-subtle bg-transparent px-05 py-04
                     text-body-02 text-content-primary placeholder:text-content-placeholder
                     focus:outline-none"
        />

        <ul id="palette-results" role="listbox" className="max-h-80 overflow-y-auto">
          {items.length === 0 ? (
            <li className="px-05 py-05 text-body-compact text-content-secondary">
              {query.length >= 2 ? 'Nothing matched that.' : 'Start typing to search.'}
            </li>
          ) : (
            items.map((item, index) => (
              <li key={`${item.type}-${item.id}`} role="option" aria-selected={index === highlighted}>
                <Link
                  href={item.href}
                  onClick={onClose}
                  onMouseEnter={() => setHighlighted(index)}
                  className={[
                    'flex items-center justify-between px-05 py-03 text-body-compact no-underline',
                    index === highlighted
                      ? 'bg-interactive-subtle text-content-primary'
                      : 'text-content-primary hover:bg-surface-hover',
                  ].join(' ')}
                >
                  <span className="truncate">{item.title}</span>
                  <span className="ms-04 shrink-0 text-label-01 uppercase text-content-tertiary">{item.type}</span>
                </Link>
              </li>
            ))
          )}
        </ul>

        <div className="flex items-center gap-04 border-t border-border-subtle px-05 py-02 text-label-01 text-content-tertiary">
          <span>↑↓ to navigate</span>
          <span>↵ to open</span>
          <span>esc to close</span>
        </div>
      </div>
    </div>
  );
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return (parts[0] ?? '').slice(0, 2).toUpperCase();
  return `${(parts[0] ?? '')[0] ?? ''}${(parts[parts.length - 1] ?? '')[0] ?? ''}`.toUpperCase();
}

function humanizeRole(role: string): string {
  return role
    .toLowerCase()
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}
