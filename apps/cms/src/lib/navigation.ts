import type { Permission } from '@cheezious/permissions';

/**
 * The CMS sidebar.
 *
 * Grouped the way a publishing organisation actually divides work rather than
 * by database table: Overview is what is on your plate, Content is the
 * newsroom's, Careers is HR's, Partners is Procurement and Expansion's.
 *
 * Every item declares the permission that reveals it. A Procurement Manager
 * signing in sees Partners and nothing else — not a sidebar full of sections
 * that will refuse them. The API enforces the same permissions independently;
 * hiding an item is a courtesy, never the control.
 */

export interface NavItem {
  label: string;
  href: string;
  /** Any one of these permissions reveals the item. */
  permissions: Permission[];
  icon: string;
  /** Key of the counter shown as a badge, resolved from the dashboard payload. */
  badge?: string;
  /** Matches child routes too, so a detail page keeps its parent highlighted. */
  matchPrefix?: boolean;
}

export interface NavGroup {
  key: string;
  label: string;
  items: NavItem[];
}

export const NAVIGATION: NavGroup[] = [
  {
    key: 'overview',
    label: 'Overview',
    items: [
      { label: 'Dashboard', href: '/', permissions: [], icon: 'LayoutDashboard' },
      {
        label: 'My work',
        href: '/my-work',
        permissions: ['pages.read'],
        icon: 'UserSquare',
        badge: 'myWork',
      },
      {
        label: 'Review queue',
        href: '/review',
        permissions: ['pages.read'],
        icon: 'ClipboardCheck',
        badge: 'review',
      },
      {
        label: 'Scheduled',
        href: '/scheduled',
        permissions: ['pages.read'],
        icon: 'CalendarClock',
        badge: 'scheduled',
      },
      { label: 'Recently updated', href: '/recent', permissions: ['pages.read'], icon: 'History' },
    ],
  },
  {
    key: 'content',
    label: 'Content',
    items: [
      {
        label: 'Pages',
        href: '/content/pages',
        permissions: ['pages.read'],
        icon: 'Files',
        matchPrefix: true,
      },
      {
        label: 'Stories',
        href: '/content/stories',
        permissions: ['stories.read'],
        icon: 'BookOpen',
        matchPrefix: true,
      },
      {
        label: 'News',
        href: '/content/news',
        permissions: ['news.read'],
        icon: 'Newspaper',
        matchPrefix: true,
      },
      {
        label: 'Press releases',
        href: '/content/press-releases',
        permissions: ['pressReleases.read'],
        icon: 'ScrollText',
        matchPrefix: true,
      },
      {
        label: 'People',
        href: '/content/people',
        permissions: ['people.read'],
        icon: 'Users',
        matchPrefix: true,
      },
      {
        label: 'Leadership',
        href: '/content/leadership',
        permissions: ['leadership.manage', 'people.read'],
        icon: 'UserCog',
      },
      {
        label: 'Timeline',
        href: '/content/timeline',
        permissions: ['timeline.manage'],
        icon: 'GitCommitHorizontal',
      },
      { label: 'Awards', href: '/content/awards', permissions: ['awards.manage'], icon: 'Award' },
      {
        label: 'Impact',
        href: '/content/impact',
        permissions: ['impact.read'],
        icon: 'Sprout',
        matchPrefix: true,
      },
      {
        label: 'Reports',
        href: '/content/reports',
        permissions: ['reports.read'],
        icon: 'FileBarChart',
        matchPrefix: true,
      },
      {
        label: 'Policies',
        href: '/content/policies',
        permissions: ['policies.read'],
        icon: 'FileCheck',
        matchPrefix: true,
      },
    ],
  },
  {
    key: 'careers',
    label: 'Careers',
    items: [
      {
        label: 'Jobs',
        href: '/careers/jobs',
        permissions: ['careers.read'],
        icon: 'Briefcase',
        matchPrefix: true,
      },
      {
        label: 'Applications',
        href: '/careers/applications',
        permissions: ['applications.read'],
        icon: 'Inbox',
        badge: 'applications',
        matchPrefix: true,
      },
      {
        label: 'Employee stories',
        href: '/careers/employee-stories',
        permissions: ['employeeStories.manage'],
        icon: 'Route',
      },
      {
        label: 'Departments',
        href: '/careers/departments',
        permissions: ['careers.manage'],
        icon: 'Building2',
      },
      {
        label: 'Locations',
        href: '/careers/locations',
        permissions: ['careers.manage'],
        icon: 'MapPin',
      },
    ],
  },
  {
    key: 'partners',
    label: 'Partners',
    items: [
      {
        label: 'Supplier submissions',
        href: '/partners/suppliers',
        permissions: ['suppliers.read'],
        icon: 'Truck',
        badge: 'suppliers',
        matchPrefix: true,
      },
      {
        label: 'Property submissions',
        href: '/partners/properties',
        permissions: ['properties.read'],
        icon: 'Building',
        badge: 'properties',
        matchPrefix: true,
      },
      {
        label: 'Partnership enquiries',
        href: '/partners/partnerships',
        permissions: ['partnerships.read'],
        icon: 'Handshake',
        badge: 'partnerships',
        matchPrefix: true,
      },
    ],
  },
  {
    key: 'media',
    label: 'Media',
    items: [
      {
        label: 'Media library',
        href: '/media',
        permissions: ['media.read'],
        icon: 'Images',
        matchPrefix: true,
      },
      {
        label: 'Brand assets',
        href: '/media/brand',
        permissions: ['media.manageBrandAssets'],
        icon: 'Palette',
      },
      {
        label: 'Documents',
        href: '/media/documents',
        permissions: ['media.read'],
        icon: 'FileText',
      },
    ],
  },
  {
    key: 'structure',
    label: 'Structure',
    items: [
      {
        label: 'Navigation',
        href: '/structure/navigation',
        permissions: ['navigation.manage'],
        icon: 'Menu',
      },
      {
        label: 'Footer',
        href: '/structure/footer',
        permissions: ['navigation.manage'],
        icon: 'PanelBottom',
      },
      {
        label: 'Redirects',
        href: '/structure/redirects',
        permissions: ['redirects.manage'],
        icon: 'CornerDownRight',
      },
    ],
  },
  {
    key: 'forms',
    label: 'Forms',
    items: [
      {
        label: 'Contact submissions',
        href: '/forms/contact',
        permissions: ['contact.read'],
        icon: 'Mail',
        badge: 'contact',
        matchPrefix: true,
      },
      {
        label: 'Form builder',
        href: '/forms/builder',
        permissions: ['forms.manage'],
        icon: 'ListChecks',
      },
      {
        label: 'Submissions',
        href: '/forms/submissions',
        permissions: ['forms.read'],
        icon: 'Database',
      },
    ],
  },
  {
    key: 'localization',
    label: 'Localization',
    items: [
      {
        label: 'Translation status',
        href: '/localization',
        permissions: ['localization.read'],
        icon: 'Languages',
      },
    ],
  },
  {
    key: 'system',
    label: 'System',
    items: [
      {
        label: 'Content health',
        href: '/system/content-health',
        permissions: ['contentHealth.read'],
        icon: 'HeartPulse',
        badge: 'health',
      },
      {
        label: 'Users',
        href: '/system/users',
        permissions: ['users.read'],
        icon: 'UserPlus',
        matchPrefix: true,
      },
      {
        label: 'Roles & permissions',
        href: '/system/roles',
        permissions: ['users.read'],
        icon: 'ShieldCheck',
      },
      {
        label: 'Audit log',
        href: '/system/audit',
        permissions: ['audit.read'],
        icon: 'ScrollText',
      },
      {
        label: 'Settings',
        href: '/system/settings',
        permissions: ['settings.manage'],
        icon: 'Settings',
      },
      {
        label: 'Integrations',
        href: '/system/integrations',
        permissions: ['integrations.manage'],
        icon: 'Plug',
      },
    ],
  },
];

/**
 * Filter navigation to what this user can reach.
 *
 * An item with no declared permissions is visible to anyone signed in. A group
 * whose items are all hidden disappears entirely rather than leaving an empty
 * heading.
 */
export function visibleNavigation(granted: ReadonlySet<string>, isActive = true): NavGroup[] {
  if (!isActive) return [];

  return NAVIGATION.map((group) => ({
    ...group,
    items: group.items.filter(
      (item) =>
        item.permissions.length === 0 ||
        item.permissions.some((permission) => granted.has(permission)),
    ),
  })).filter((group) => group.items.length > 0);
}

/** Whether a nav item should be highlighted for the current path. */
export function isItemActive(item: NavItem, pathname: string): boolean {
  if (item.href === '/') return pathname === '/';
  return item.matchPrefix ? pathname.startsWith(item.href) : pathname === item.href;
}

/** Quick-create actions, gated the same way as the sidebar. */
export const QUICK_CREATE: Array<{
  label: string;
  href: string;
  permissions: Permission[];
  shortcut?: string;
}> = [
  { label: 'Page', href: '/content/pages/new', permissions: ['pages.create'], shortcut: 'P' },
  { label: 'Story', href: '/content/stories/new', permissions: ['stories.create'], shortcut: 'S' },
  {
    label: 'Press release',
    href: '/content/press-releases/new',
    permissions: ['pressReleases.create'],
    shortcut: 'R',
  },
  { label: 'Job', href: '/careers/jobs/new', permissions: ['careers.manage'], shortcut: 'J' },
  { label: 'Person', href: '/content/people/new', permissions: ['people.manage'] },
  { label: 'Report', href: '/content/reports/new', permissions: ['reports.manage'] },
  { label: 'Policy', href: '/content/policies/new', permissions: ['policies.manage'] },
];
