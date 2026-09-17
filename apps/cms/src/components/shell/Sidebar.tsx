'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';

import { isItemActive, visibleNavigation, type NavItem } from '@/lib/navigation';

/**
 * The CMS sidebar.
 *
 * Carbon's persistent side navigation: always present on desktop, collapsible
 * to an icon rail, and grouped by the work rather than by data model.
 *
 * Only sections this user can reach are rendered, so a Procurement Manager sees
 * a short, relevant sidebar rather than a long one full of dead ends.
 */

export interface SidebarProps {
  permissions: string[];
  isActive: boolean;
  /** Counters shown as badges, keyed by the `badge` field on a nav item. */
  badges?: Record<string, number | null | undefined>;
}

export function Sidebar({ permissions, isActive, badges = {} }: SidebarProps) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  // The collapsed state is a per-person preference, remembered locally. It is a
  // display convenience, so losing it (private window, cleared storage) is fine.
  useEffect(() => {
    try {
      setCollapsed(window.localStorage.getItem('cheezious.cms.sidebarCollapsed') === '1');
    } catch {
      // Storage can be unavailable; the default is simply "expanded".
    }
  }, []);

  useEffect(() => {
    try {
      window.localStorage.setItem('cheezious.cms.sidebarCollapsed', collapsed ? '1' : '0');
    } catch {
      // Not being able to remember the preference must not break navigation.
    }
  }, [collapsed]);

  useEffect(() => setMobileOpen(false), [pathname]);

  const groups = visibleNavigation(new Set(permissions), isActive);

  return (
    <>
      {/* Mobile trigger. The CMS is desktop-first, but must be usable on a tablet. */}
      <button
        type="button"
        className="fixed left-03 top-03 z-header inline-flex h-8 w-8 items-center justify-center
                   bg-gray-90 text-content-inverse lg:hidden"
        aria-expanded={mobileOpen}
        aria-controls="cms-sidebar"
        onClick={() => setMobileOpen((open) => !open)}
      >
        <span className="sr-only">{mobileOpen ? 'Close navigation' : 'Open navigation'}</span>
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
          {mobileOpen ? (
            <path d="M3 3l10 10M13 3L3 13" stroke="currentColor" strokeWidth="1.5" />
          ) : (
            <>
              <path d="M2 4h12M2 8h12M2 12h12" stroke="currentColor" strokeWidth="1.5" />
            </>
          )}
        </svg>
      </button>

      {mobileOpen ? (
        <div
          className="fixed inset-0 z-sidebar bg-gray-100/50 lg:hidden"
          onClick={() => setMobileOpen(false)}
          aria-hidden="true"
        />
      ) : null}

      <nav
        id="cms-sidebar"
        aria-label="Main"
        className={[
          'fixed left-0 top-header z-sidebar flex h-[calc(100vh-theme(spacing.header))] flex-col',
          'border-r border-border-subtle bg-surface-base',
          'transition-[width,transform] duration-moderate ease-productive',
          collapsed ? 'lg:w-sidebar-collapsed' : 'lg:w-sidebar',
          'w-sidebar',
          mobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0',
        ].join(' ')}
      >
        <div className="scrollbar-thin flex-1 overflow-y-auto py-03">
          {groups.map((group) => (
            <div key={group.key} className="mb-05 last:mb-0">
              {/* The group label is hidden when collapsed, but the grouping is
                  preserved for screen readers via the list structure. */}
              {!collapsed ? (
                <h2 className="px-05 py-02 text-label-01 uppercase tracking-wide text-content-tertiary">
                  {group.label}
                </h2>
              ) : (
                <div className="mx-03 my-02 border-t border-border-subtle" aria-hidden="true" />
              )}

              <ul>
                {group.items.map((item) => (
                  <li key={item.href}>
                    <SidebarLink
                      item={item}
                      active={isItemActive(item, pathname)}
                      collapsed={collapsed}
                      badge={item.badge ? badges[item.badge] : undefined}
                    />
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <button
          type="button"
          className="hidden items-center gap-03 border-t border-border-subtle px-05 py-03
                     text-body-compact text-content-secondary transition-colors duration-fast
                     hover:bg-surface-hover lg:flex"
          onClick={() => setCollapsed((value) => !value)}
          aria-label={collapsed ? 'Expand navigation' : 'Collapse navigation'}
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 16 16"
            fill="none"
            aria-hidden="true"
            className={collapsed ? 'rotate-180' : ''}
          >
            <path d="M10 3L5 8l5 5" stroke="currentColor" strokeWidth="1.5" />
          </svg>
          {!collapsed ? <span>Collapse</span> : null}
        </button>
      </nav>
    </>
  );
}

function SidebarLink({
  item,
  active,
  collapsed,
  badge,
}: {
  item: NavItem;
  active: boolean;
  collapsed: boolean;
  badge?: number | null;
}) {
  return (
    <Link
      href={item.href}
      // Carbon marks the active item with a left border rather than a fill, so
      // it stays legible against the hover state.
      className={[
        'relative flex items-center gap-03 px-05 py-03 text-body-compact no-underline',
        'transition-colors duration-fast ease-productive',
        active
          ? 'bg-surface-selected font-semibold text-content-primary before:absolute before:left-0 before:top-0 before:h-full before:w-[3px] before:bg-interactive'
          : 'text-content-secondary hover:bg-surface-hover hover:text-content-primary',
      ].join(' ')}
      {...(active ? { 'aria-current': 'page' as const } : {})}
      title={collapsed ? item.label : undefined}
    >
      <span
        aria-hidden="true"
        className="inline-block h-4 w-4 shrink-0 rounded-sm bg-current opacity-40"
        data-icon={item.icon}
      />

      {!collapsed ? (
        <>
          <span className="flex-1 truncate">{item.label}</span>
          {/* A zero count is not shown: an empty queue is not news. */}
          {typeof badge === 'number' && badge > 0 ? (
            <span className="tag bg-status-danger text-content-inverse tabular">
              {badge > 99 ? '99+' : badge}
              <span className="sr-only"> items need attention</span>
            </span>
          ) : null}
        </>
      ) : typeof badge === 'number' && badge > 0 ? (
        <span className="absolute right-02 top-02 h-2 w-2 rounded-full bg-status-danger">
          <span className="sr-only">{badge} items need attention</span>
        </span>
      ) : null}
    </Link>
  );
}
