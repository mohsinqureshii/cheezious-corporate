import type { Permission } from './permissions';

/**
 * Editorial workflow.
 *
 * Content does not carry a `published` boolean. It moves through an explicit
 * state machine, and every transition is guarded by a permission and recorded
 * with an actor and a timestamp. Invalid transitions are rejected server-side.
 */

export const CONTENT_STATUSES = [
  'DRAFT',
  'IN_REVIEW',
  'CHANGES_REQUESTED',
  'APPROVED',
  'SCHEDULED',
  'PUBLISHED',
  'UNPUBLISHED',
  'ARCHIVED',
] as const;

export type ContentStatus = (typeof CONTENT_STATUSES)[number];

export type WorkflowAction =
  | 'SUBMIT_FOR_REVIEW'
  | 'REQUEST_CHANGES'
  | 'APPROVE'
  | 'PUBLISH'
  | 'SCHEDULE'
  | 'CANCEL_SCHEDULE'
  | 'UNPUBLISH'
  | 'ARCHIVE'
  | 'RESTORE_TO_DRAFT';

export interface TransitionRule {
  action: WorkflowAction;
  from: readonly ContentStatus[];
  to: ContentStatus;
  /** Permission suffix combined with a resource prefix, e.g. `pages` + `.publish`. */
  requires: 'update' | 'publish';
  label: string;
  /** Shown in the CMS to explain what the transition does. */
  description: string;
  /** Destructive or outward-facing transitions ask for confirmation in the CMS. */
  confirm?: boolean;
}

export const TRANSITIONS: readonly TransitionRule[] = [
  {
    action: 'SUBMIT_FOR_REVIEW',
    from: ['DRAFT', 'CHANGES_REQUESTED'],
    to: 'IN_REVIEW',
    requires: 'update',
    label: 'Submit for review',
    description: 'Hand this content to an editor. You can still edit it while it is in review.',
  },
  {
    action: 'REQUEST_CHANGES',
    from: ['IN_REVIEW', 'APPROVED'],
    to: 'CHANGES_REQUESTED',
    requires: 'update',
    label: 'Request changes',
    description: 'Send this back to the author with a note explaining what needs to change.',
  },
  {
    action: 'APPROVE',
    from: ['IN_REVIEW'],
    to: 'APPROVED',
    requires: 'update',
    label: 'Approve',
    description: 'Mark this as ready. A publisher can then publish or schedule it.',
  },
  {
    action: 'PUBLISH',
    from: ['APPROVED', 'SCHEDULED', 'UNPUBLISHED', 'DRAFT', 'IN_REVIEW', 'CHANGES_REQUESTED'],
    to: 'PUBLISHED',
    requires: 'publish',
    label: 'Publish',
    description: 'Make this visible on the public site immediately.',
    confirm: true,
  },
  {
    action: 'SCHEDULE',
    from: ['APPROVED', 'PUBLISHED', 'UNPUBLISHED', 'DRAFT'],
    to: 'SCHEDULED',
    requires: 'publish',
    label: 'Schedule',
    description: 'Publish automatically at a chosen date and time.',
  },
  {
    action: 'CANCEL_SCHEDULE',
    from: ['SCHEDULED'],
    to: 'APPROVED',
    requires: 'publish',
    label: 'Cancel schedule',
    description: 'Stop the scheduled publication. The content returns to approved.',
  },
  {
    action: 'UNPUBLISH',
    from: ['PUBLISHED', 'SCHEDULED'],
    to: 'UNPUBLISHED',
    requires: 'publish',
    label: 'Unpublish',
    description: 'Remove this from the public site. History and revisions are kept.',
    confirm: true,
  },
  {
    action: 'ARCHIVE',
    from: ['DRAFT', 'CHANGES_REQUESTED', 'APPROVED', 'UNPUBLISHED', 'IN_REVIEW'],
    to: 'ARCHIVED',
    requires: 'update',
    label: 'Archive',
    description: 'Move this out of active workspaces. It can be restored later.',
    confirm: true,
  },
  {
    action: 'RESTORE_TO_DRAFT',
    from: ['ARCHIVED', 'UNPUBLISHED'],
    to: 'DRAFT',
    requires: 'update',
    label: 'Restore to draft',
    description: 'Bring this back into the editorial workflow as a draft.',
  },
];

export class InvalidTransitionError extends Error {
  readonly code = 'INVALID_TRANSITION';
  constructor(
    readonly from: ContentStatus,
    readonly action: WorkflowAction,
  ) {
    super(`Cannot ${action} content that is currently ${from}.`);
    this.name = 'InvalidTransitionError';
  }
}

export function findTransition(from: ContentStatus, action: WorkflowAction): TransitionRule | undefined {
  return TRANSITIONS.find((t) => t.action === action && t.from.includes(from));
}

export function canTransition(from: ContentStatus, action: WorkflowAction): boolean {
  return findTransition(from, action) !== undefined;
}

/** Resolve the target status, throwing when the transition is not legal. */
export function nextStatus(from: ContentStatus, action: WorkflowAction): ContentStatus {
  const transition = findTransition(from, action);
  if (!transition) throw new InvalidTransitionError(from, action);
  return transition.to;
}

/** The permission a given resource requires for a given action. */
export function requiredPermission(resource: string, action: WorkflowAction, from: ContentStatus): Permission {
  const transition = findTransition(from, action);
  if (!transition) throw new InvalidTransitionError(from, action);
  return `${resource}.${transition.requires}` as Permission;
}

/** Transitions legal from a status, filtered to those the actor may perform. */
export function availableTransitions(
  from: ContentStatus,
  resource: string,
  has: (permission: Permission) => boolean,
): TransitionRule[] {
  return TRANSITIONS.filter(
    (t) => t.from.includes(from) && has(`${resource}.${t.requires}` as Permission),
  );
}

/** Statuses whose content is visible on the public site. */
export const PUBLIC_STATUSES: readonly ContentStatus[] = ['PUBLISHED'];

export function isPubliclyVisible(status: ContentStatus): boolean {
  return PUBLIC_STATUSES.includes(status);
}

/** Statuses that represent work still owed by a human. */
export const OPEN_WORK_STATUSES: readonly ContentStatus[] = ['DRAFT', 'IN_REVIEW', 'CHANGES_REQUESTED', 'APPROVED'];

export const STATUS_META: Record<ContentStatus, { label: string; tone: 'neutral' | 'info' | 'warning' | 'success' | 'muted' }> = {
  DRAFT: { label: 'Draft', tone: 'neutral' },
  IN_REVIEW: { label: 'In review', tone: 'info' },
  CHANGES_REQUESTED: { label: 'Changes requested', tone: 'warning' },
  APPROVED: { label: 'Approved', tone: 'info' },
  SCHEDULED: { label: 'Scheduled', tone: 'info' },
  PUBLISHED: { label: 'Published', tone: 'success' },
  UNPUBLISHED: { label: 'Unpublished', tone: 'muted' },
  ARCHIVED: { label: 'Archived', tone: 'muted' },
};
