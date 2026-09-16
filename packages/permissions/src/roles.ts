import { ALL_PERMISSIONS, type Permission } from './permissions';

/**
 * Seeded roles.
 *
 * These are *starting points* written into the database by the seed. Once seeded
 * they are ordinary rows: an administrator can edit their permissions, rename
 * them or add new roles entirely through the CMS. Only SUPER_ADMIN is marked
 * `isSystem` so that a customer cannot lock themselves out of their own platform.
 */

export const SYSTEM_ROLES = {
  SUPER_ADMIN: 'SUPER_ADMIN',
  ADMIN: 'ADMIN',
  CORPORATE_COMMUNICATIONS: 'CORPORATE_COMMUNICATIONS',
  EDITOR: 'EDITOR',
  AUTHOR: 'AUTHOR',
  HR_MANAGER: 'HR_MANAGER',
  PR_MANAGER: 'PR_MANAGER',
  PROCUREMENT_MANAGER: 'PROCUREMENT_MANAGER',
  EXPANSION_MANAGER: 'EXPANSION_MANAGER',
  REVIEWER: 'REVIEWER',
  VIEWER: 'VIEWER',
} as const;

export type SystemRoleKey = keyof typeof SYSTEM_ROLES;

const READ_ONLY: Permission[] = [
  'pages.read',
  'stories.read',
  'news.read',
  'pressReleases.read',
  'people.read',
  'careers.read',
  'impact.read',
  'reports.read',
  'policies.read',
  'media.read',
  'localization.read',
];

const AUTHOR_PERMISSIONS: Permission[] = [
  ...READ_ONLY,
  'pages.create',
  'pages.update',
  'stories.create',
  'stories.update',
  'news.create',
  'news.update',
  'media.upload',
  'media.update',
];

const EDITOR_PERMISSIONS: Permission[] = [
  ...AUTHOR_PERMISSIONS,
  'pages.restore',
  'stories.delete',
  'news.delete',
  'pressReleases.create',
  'pressReleases.update',
  'people.manage',
  'timeline.manage',
  'awards.manage',
  'employeeStories.manage',
  'localization.manage',
  'contentHealth.read',
];

export const ROLE_DEFINITIONS: Record<
  SystemRoleKey,
  { name: string; description: string; isSystem: boolean; permissions: Permission[] | 'ALL' }
> = {
  SUPER_ADMIN: {
    name: 'Super Administrator',
    description:
      'Unrestricted access to every capability, including roles, users and settings. Cannot be deleted.',
    isSystem: true,
    permissions: 'ALL',
  },
  ADMIN: {
    name: 'Administrator',
    description: 'Full platform administration: content, users, settings, redirects and audit.',
    isSystem: false,
    permissions: ALL_PERMISSIONS.filter((p) => p !== 'roles.manage'),
  },
  CORPORATE_COMMUNICATIONS: {
    name: 'Corporate Communications',
    description:
      'Owns the corporate narrative: pages, navigation, newsroom, leadership, reports and boilerplate — without engineering.',
    isSystem: false,
    permissions: [
      ...EDITOR_PERMISSIONS,
      'pages.publish',
      'pages.delete',
      'stories.publish',
      'news.publish',
      'pressReleases.publish',
      'pressReleases.delete',
      'people.publish',
      'leadership.manage',
      'locations.manage',
      'impact.manage',
      'reports.manage',
      'policies.manage',
      'mediaCoverage.manage',
      'media.delete',
      'media.manageBrandAssets',
      'navigation.manage',
      'redirects.manage',
      'settings.manage',
      'contact.read',
      'contact.manage',
      'forms.read',
    ],
  },
  EDITOR: {
    name: 'Editor',
    description: 'Reviews and improves content, and moves it through the editorial workflow.',
    isSystem: false,
    permissions: EDITOR_PERMISSIONS,
  },
  AUTHOR: {
    name: 'Author',
    description: 'Creates and edits drafts, and submits them for review. Cannot publish.',
    isSystem: false,
    permissions: AUTHOR_PERMISSIONS,
  },
  HR_MANAGER: {
    name: 'HR Manager',
    description:
      'Runs careers end to end: job postings, careers content, employee stories and applications.',
    isSystem: false,
    permissions: [
      ...READ_ONLY,
      'pages.update',
      'careers.manage',
      'careers.publish',
      'applications.read',
      'applications.manage',
      'applications.export',
      'employeeStories.manage',
      'people.manage',
      'media.upload',
      'media.update',
      'forms.read',
    ],
  },
  PR_MANAGER: {
    name: 'PR Manager',
    description:
      'Runs the newsroom and media centre: press releases, news, fact sheets, media contacts and press assets.',
    isSystem: false,
    permissions: [
      ...READ_ONLY,
      'news.create',
      'news.update',
      'news.delete',
      'news.publish',
      'pressReleases.create',
      'pressReleases.update',
      'pressReleases.delete',
      'pressReleases.publish',
      'stories.create',
      'stories.update',
      'stories.publish',
      'mediaCoverage.manage',
      'people.manage',
      'awards.manage',
      'media.upload',
      'media.update',
      'media.manageBrandAssets',
      'settings.manage',
      'contact.read',
    ],
  },
  PROCUREMENT_MANAGER: {
    name: 'Procurement Manager',
    description: 'Receives, qualifies and progresses supplier submissions.',
    isSystem: false,
    permissions: ['suppliers.read', 'suppliers.manage', 'suppliers.export', 'pages.read', 'media.read', 'forms.read'],
  },
  EXPANSION_MANAGER: {
    name: 'Expansion Manager',
    description: 'Receives, reviews and progresses real-estate property submissions.',
    isSystem: false,
    permissions: [
      'properties.read',
      'properties.manage',
      'properties.export',
      'partnerships.read',
      'partnerships.manage',
      'locations.manage',
      'pages.read',
      'media.read',
      'forms.read',
    ],
  },
  REVIEWER: {
    name: 'Reviewer',
    description: 'Reviews submitted content and approves it or requests changes. Cannot publish.',
    isSystem: false,
    permissions: [...READ_ONLY, 'pages.update', 'stories.update', 'news.update', 'pressReleases.update', 'contentHealth.read'],
  },
  VIEWER: {
    name: 'Viewer',
    description: 'Read-only access to content. Cannot see personal data from submissions.',
    isSystem: false,
    permissions: READ_ONLY,
  },
};

export function permissionsForRole(key: SystemRoleKey): Permission[] {
  const definition = ROLE_DEFINITIONS[key];
  return definition.permissions === 'ALL' ? [...ALL_PERMISSIONS] : definition.permissions;
}
