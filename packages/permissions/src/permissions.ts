/**
 * Granular permission catalogue.
 *
 * Authorisation is expressed exclusively in terms of these permission keys.
 * Roles are a convenience for *assigning* permissions — no code branches on a
 * role name, so a customer can create "Regional PR Manager" tomorrow without a
 * deployment.
 */

export const PERMISSIONS = {
  // --- Pages & composition -------------------------------------------------
  'pages.read': 'View pages and their revisions',
  'pages.create': 'Create new pages',
  'pages.update': 'Edit page content, blocks and settings',
  'pages.delete': 'Delete (archive) pages',
  'pages.publish': 'Publish, schedule and unpublish pages',
  'pages.restore': 'Restore a page to an earlier revision',

  // --- Editorial content ---------------------------------------------------
  'stories.read': 'View stories',
  'stories.create': 'Create stories',
  'stories.update': 'Edit stories',
  'stories.delete': 'Delete stories',
  'stories.publish': 'Publish and schedule stories',

  'news.read': 'View company news',
  'news.create': 'Create company news',
  'news.update': 'Edit company news',
  'news.delete': 'Delete company news',
  'news.publish': 'Publish and schedule company news',

  'pressReleases.read': 'View press releases',
  'pressReleases.create': 'Create press releases',
  'pressReleases.update': 'Edit press releases',
  'pressReleases.delete': 'Delete press releases',
  'pressReleases.publish': 'Publish and schedule press releases',

  'mediaCoverage.manage': 'Manage third-party media coverage entries',

  // --- People --------------------------------------------------------------
  'people.read': 'View people records',
  'people.manage': 'Create and edit people records',
  // See the note beside the policy permissions: the editorial workflow needs
  // `<prefix>.update` as well as `<prefix>.publish`.
  'people.update': 'Edit a profile and submit it for review',
  'people.publish': 'Publish people profiles',
  'leadership.manage': 'Manage leadership groups, ordering and featured leaders',
  'employeeStories.manage': 'Manage employee stories',

  // --- Company records -----------------------------------------------------
  'timeline.manage': 'Manage the corporate timeline',
  'awards.manage': 'Manage awards and recognition',
  'locations.manage': 'Manage regions, cities and corporate footprint data',

  // --- Careers -------------------------------------------------------------
  'careers.read': 'View careers content and jobs',
  'careers.manage': 'Create and edit jobs and careers content',
  'careers.publish': 'Open, pause and close jobs',
  'applications.read': 'View job applications (contains personal data)',
  'applications.manage': 'Change applicant status and add internal notes',
  'applications.export': 'Export job application data',
  'applications.delete': 'Delete job applications and applicant files',

  // --- Impact, reports, policies -------------------------------------------
  'impact.read': 'View impact pillars, metrics and stories',
  'impact.manage': 'Manage impact pillars, metrics and stories',
  'reports.read': 'View reports and publications',
  'reports.manage': 'Manage reports and publications',
  'policies.read': 'View policies',
  'policies.manage': 'Manage policies and policy versions',
  // The editorial workflow derives the permission it needs as
  // `<prefix>.update` and `<prefix>.publish`, so a content type that runs the
  // workflow must have both, whatever else it has. Without them no transition
  // is possible for anybody, super administrator included.
  'policies.update': 'Edit a policy and submit it for review',
  'policies.publish': 'Publish and unpublish policies',

  // --- Partners & lead generation ------------------------------------------
  'suppliers.read': 'View supplier submissions (contains contact data)',
  'suppliers.manage': 'Progress supplier submissions and add internal notes',
  'suppliers.export': 'Export supplier submission data',
  'properties.read': 'View real-estate property submissions',
  'properties.manage': 'Progress property submissions and add internal notes',
  'properties.export': 'Export property submission data',
  'partnerships.read': 'View partnership enquiries',
  'partnerships.manage': 'Progress partnership enquiries',

  // --- Forms & contact -----------------------------------------------------
  'forms.read': 'View form definitions and submissions',
  'forms.manage': 'Create and edit form definitions',
  'forms.export': 'Export form submissions',
  'contact.read': 'View contact submissions',
  'contact.manage': 'Progress contact submissions',

  // --- Media ---------------------------------------------------------------
  'media.read': 'Browse the media library',
  'media.upload': 'Upload media assets',
  'media.update': 'Edit media metadata, alt text and folders',
  'media.delete': 'Delete media assets',
  'media.manageBrandAssets': 'Manage brand assets and their public download status',

  // --- Structure -----------------------------------------------------------
  'navigation.manage': 'Manage navigation, mega menu and footer',
  'redirects.manage': 'Manage redirects and slug history',

  // --- Localization --------------------------------------------------------
  'localization.read': 'View translation status',
  'localization.manage': 'Manage translations and translation status',

  // --- System --------------------------------------------------------------
  'users.read': 'View CMS users',
  'users.manage': 'Invite, disable and edit CMS users',
  'roles.manage': 'Create roles and change role permissions',
  'settings.manage': 'Change site settings, boilerplate and feature flags',
  'integrations.manage': 'Manage integrations and webhooks',
  'audit.read': 'Read the audit log',
  'contentHealth.read': 'View content health reports',
  'system.read': 'View system health and background job status',
} as const;

export type Permission = keyof typeof PERMISSIONS;

export const ALL_PERMISSIONS = Object.keys(PERMISSIONS) as Permission[];

export function isPermission(value: string): value is Permission {
  return value in PERMISSIONS;
}

export function describePermission(permission: Permission): string {
  return PERMISSIONS[permission];
}

/**
 * Permissions that grant control over the platform itself or over personal data.
 * The CMS warns explicitly before granting any of these.
 */
export const HIGH_RISK_PERMISSIONS: readonly Permission[] = [
  'users.manage',
  'roles.manage',
  'settings.manage',
  'integrations.manage',
  'pages.publish',
  'pages.delete',
  'applications.read',
  'applications.export',
  'applications.delete',
  'suppliers.export',
  'properties.export',
  'forms.export',
  'media.delete',
  'redirects.manage',
];

export function isHighRisk(permission: Permission): boolean {
  return HIGH_RISK_PERMISSIONS.includes(permission);
}

/** Permissions that expose personal data and therefore carry privacy obligations. */
export const PERSONAL_DATA_PERMISSIONS: readonly Permission[] = [
  'applications.read',
  'applications.manage',
  'applications.export',
  'applications.delete',
  'suppliers.read',
  'suppliers.manage',
  'suppliers.export',
  'properties.read',
  'properties.manage',
  'properties.export',
  'partnerships.read',
  'partnerships.manage',
  'contact.read',
  'contact.manage',
  'forms.read',
  'forms.export',
];

/** Grouping used to render the CMS permission matrix. */
export const PERMISSION_GROUPS: Array<{ key: string; label: string; permissions: Permission[] }> = [
  { key: 'pages', label: 'Pages', permissions: ['pages.read', 'pages.create', 'pages.update', 'pages.delete', 'pages.publish', 'pages.restore'] },
  { key: 'editorial', label: 'Editorial', permissions: ['stories.read', 'stories.create', 'stories.update', 'stories.delete', 'stories.publish', 'news.read', 'news.create', 'news.update', 'news.delete', 'news.publish', 'pressReleases.read', 'pressReleases.create', 'pressReleases.update', 'pressReleases.delete', 'pressReleases.publish', 'mediaCoverage.manage'] },
  { key: 'people', label: 'People & leadership', permissions: ['people.read', 'people.update', 'people.manage', 'people.publish', 'leadership.manage', 'employeeStories.manage'] },
  { key: 'company', label: 'Company records', permissions: ['timeline.manage', 'awards.manage', 'locations.manage'] },
  { key: 'careers', label: 'Careers', permissions: ['careers.read', 'careers.manage', 'careers.publish', 'applications.read', 'applications.manage', 'applications.export', 'applications.delete'] },
  { key: 'impact', label: 'Impact & publications', permissions: ['impact.read', 'impact.manage', 'reports.read', 'reports.manage', 'policies.read', 'policies.update', 'policies.manage', 'policies.publish'] },
  { key: 'partners', label: 'Partners & leads', permissions: ['suppliers.read', 'suppliers.manage', 'suppliers.export', 'properties.read', 'properties.manage', 'properties.export', 'partnerships.read', 'partnerships.manage'] },
  { key: 'forms', label: 'Forms & contact', permissions: ['forms.read', 'forms.manage', 'forms.export', 'contact.read', 'contact.manage'] },
  { key: 'media', label: 'Media', permissions: ['media.read', 'media.upload', 'media.update', 'media.delete', 'media.manageBrandAssets'] },
  { key: 'structure', label: 'Structure', permissions: ['navigation.manage', 'redirects.manage'] },
  { key: 'localization', label: 'Localization', permissions: ['localization.read', 'localization.manage'] },
  { key: 'system', label: 'System', permissions: ['users.read', 'users.manage', 'roles.manage', 'settings.manage', 'integrations.manage', 'audit.read', 'contentHealth.read', 'system.read'] },
];
