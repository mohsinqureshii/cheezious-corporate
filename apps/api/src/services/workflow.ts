import type { Prisma, PrismaClient } from '@cheezious/database';
import {
  findTransition,
  nextStatus,
  type Ability,
  type ContentStatus,
  type Permission,
  type WorkflowAction,
} from '@cheezious/permissions';
import { ApiError } from '@cheezious/validation';

import { AuditService, type AuditActor } from '../lib/audit';

import { VersioningService, type VersionSnapshot } from './versioning';

/**
 * Editorial workflow execution.
 *
 * A transition is applied only when three things hold: the transition is legal
 * from the current status, the actor holds the permission it requires, and any
 * transition-specific preconditions are met (a schedule needs a future date; a
 * publish needs something to publish). Each check produces a distinct, readable
 * error so an editor is told what to fix rather than "forbidden".
 */

export interface TransitionRequest {
  entityType: string;
  entityId: string;
  action: WorkflowAction;
  currentStatus: ContentStatus;
  /** Required when scheduling. */
  scheduledFor?: Date | null;
  note?: string | null;
  /** Snapshot of the working copy, captured as the published version on publish. */
  snapshot: VersionSnapshot;
  entityLabel: string;
}

export interface TransitionOutcome {
  status: ContentStatus;
  publishedVersionId?: string | null;
  publishedAt?: Date | null;
  scheduledFor?: Date | null;
  firstPublish: boolean;
}

/** Maps entity types to the permission prefix that governs them. */
const PERMISSION_PREFIX: Record<string, string> = {
  page: 'pages',
  story: 'stories',
  news: 'news',
  pressRelease: 'pressReleases',
  person: 'people',
  policy: 'policies',
  job: 'careers',
};

export class WorkflowService {
  private readonly versioning: VersioningService;
  private readonly audit: AuditService;

  constructor(private readonly prisma: PrismaClient) {
    this.versioning = new VersioningService(prisma);
    this.audit = new AuditService(prisma);
  }

  /** The permission an action requires for a given entity type. */
  permissionFor(entityType: string, action: WorkflowAction, from: ContentStatus): Permission {
    const prefix = PERMISSION_PREFIX[entityType] ?? entityType;
    const transition = findTransition(from, action);
    if (!transition) {
      throw new ApiError('INVALID_TRANSITION', `Cannot ${humanise(action)} content that is ${humanise(from)}.`);
    }
    return `${prefix}.${transition.requires}` as Permission;
  }

  /**
   * Validate a requested transition without applying it.
   *
   * Called before the database transaction opens, so an invalid request costs
   * nothing and produces a precise message.
   */
  assertAllowed(request: TransitionRequest, ability: Ability): void {
    const transition = findTransition(request.currentStatus, request.action);
    if (!transition) {
      throw new ApiError(
        'INVALID_TRANSITION',
        `You cannot ${humanise(request.action)} content that is ${humanise(request.currentStatus)}.`,
      );
    }

    const permission = this.permissionFor(request.entityType, request.action, request.currentStatus);
    if (!ability.can(permission)) {
      throw new ApiError('FORBIDDEN', `You do not have permission to ${humanise(request.action)} this content.`);
    }

    if (request.action === 'SCHEDULE') {
      if (!request.scheduledFor) {
        throw ApiError.validation([
          { field: 'scheduledFor', message: 'Choose the date and time to publish.' },
        ]);
      }
      if (request.scheduledFor.getTime() <= Date.now()) {
        throw ApiError.validation([
          { field: 'scheduledFor', message: 'The scheduled time must be in the future.' },
        ]);
      }
    }

    if (request.action === 'REQUEST_CHANGES' && !request.note?.trim()) {
      throw ApiError.validation([
        { field: 'note', message: 'Explain what needs to change so the author knows what to do.' },
      ]);
    }
  }

  /**
   * Apply a transition inside a transaction.
   *
   * Publishing captures the working copy as an immutable version and points the
   * record at it. Everything the public site serves comes from that snapshot, so
   * a subsequent edit cannot leak to production.
   */
  async apply(
    request: TransitionRequest,
    actor: AuditActor,
    tx: Prisma.TransactionClient,
    options: { wasEverPublished: boolean },
  ): Promise<TransitionOutcome> {
    const to = nextStatus(request.currentStatus, request.action);
    const now = new Date();

    let publishedVersionId: string | null | undefined;
    let publishedAt: Date | null | undefined;
    let scheduledFor: Date | null | undefined;
    let firstPublish = false;

    if (request.action === 'PUBLISH') {
      const version = await this.versioning.createVersion(
        {
          entityType: request.entityType,
          entityId: request.entityId,
          data: request.snapshot,
          status: 'PUBLISHED',
          createdById: actor.id ?? null,
          note: request.note ?? 'Published',
        },
        tx,
      );
      publishedVersionId = version.id;
      publishedAt = now;
      scheduledFor = null;
      firstPublish = !options.wasEverPublished;
    }

    if (request.action === 'SCHEDULE') {
      scheduledFor = request.scheduledFor ?? null;

      // The worker publishes on this key; the unique constraint makes enqueueing
      // idempotent, so rescheduling twice cannot publish twice.
      await tx.publishingJob.upsert({
        where: { idempotencyKey: `publish:${request.entityType}:${request.entityId}` },
        create: {
          kind: 'PUBLISH',
          entityType: request.entityType,
          entityId: request.entityId,
          runAt: scheduledFor ?? now,
          idempotencyKey: `publish:${request.entityType}:${request.entityId}`,
          createdById: actor.id ?? null,
        },
        update: { runAt: scheduledFor ?? now, status: 'PENDING', attempts: 0, lastError: null },
      });
    }

    if (request.action === 'CANCEL_SCHEDULE' || request.action === 'PUBLISH') {
      await tx.publishingJob.updateMany({
        where: {
          idempotencyKey: `publish:${request.entityType}:${request.entityId}`,
          status: 'PENDING',
        },
        data: { status: 'CANCELLED' },
      });
      if (request.action === 'CANCEL_SCHEDULE') scheduledFor = null;
    }

    if (request.action === 'UNPUBLISH') {
      // The record keeps its published version for history, but stops being
      // served: the public queries filter on status, not on the pointer.
      publishedAt = null;
      scheduledFor = null;
    }

    await tx.workflowEvent.create({
      data: {
        entityType: request.entityType,
        entityId: request.entityId,
        action: request.action,
        fromStatus: request.currentStatus,
        toStatus: to,
        note: request.note ?? null,
        actorId: actor.id ?? null,
        actorName: actor.email ?? null,
      },
    });

    await this.audit.record(
      actor,
      {
        action: auditActionFor(request.action),
        entityType: request.entityType,
        entityId: request.entityId,
        entityLabel: request.entityLabel,
        summary: `${humanise(request.currentStatus)} → ${humanise(to)}${request.note ? `: ${request.note}` : ''}`,
        metadata: {
          action: request.action,
          ...(scheduledFor ? { scheduledFor: scheduledFor.toISOString() } : {}),
        },
      },
      tx,
    );

    return { status: to, publishedVersionId, publishedAt, scheduledFor, firstPublish };
  }

  /** Notify the people who need to know a transition happened. */
  async notify(
    request: TransitionRequest,
    toStatus: ContentStatus,
    actorId: string | null,
    tx: Prisma.TransactionClient,
    recipients: { authorId?: string | null; reviewerIds?: string[] },
  ): Promise<void> {
    const targets = new Set<string>();

    if (request.action === 'SUBMIT_FOR_REVIEW') {
      for (const id of recipients.reviewerIds ?? []) targets.add(id);
    } else if (recipients.authorId) {
      targets.add(recipients.authorId);
    }

    // Nobody needs a notification about their own action.
    if (actorId) targets.delete(actorId);
    if (targets.size === 0) return;

    const kind = notificationKindFor(request.action);
    if (!kind) return;

    await tx.notification.createMany({
      data: [...targets].map((userId) => ({
        userId,
        kind,
        title: notificationTitle(request.action, request.entityLabel),
        body: request.note ?? null,
        entityType: request.entityType,
        entityId: request.entityId,
        href: `/content/${request.entityType}/${request.entityId}`,
      })),
    });
  }
}

function humanise(value: string): string {
  return value.toLowerCase().replace(/_/g, ' ');
}

function auditActionFor(action: WorkflowAction) {
  switch (action) {
    case 'PUBLISH':
      return 'PUBLISH' as const;
    case 'UNPUBLISH':
      return 'UNPUBLISH' as const;
    case 'SCHEDULE':
      return 'SCHEDULE' as const;
    case 'CANCEL_SCHEDULE':
      return 'CANCEL_SCHEDULE' as const;
    case 'APPROVE':
      return 'APPROVE' as const;
    case 'REQUEST_CHANGES':
      return 'REQUEST_CHANGES' as const;
    case 'SUBMIT_FOR_REVIEW':
      return 'SUBMIT_FOR_REVIEW' as const;
    case 'ARCHIVE':
      return 'ARCHIVE' as const;
    default:
      return 'STATUS_CHANGED' as const;
  }
}

function notificationKindFor(action: WorkflowAction) {
  switch (action) {
    case 'SUBMIT_FOR_REVIEW':
      return 'SUBMITTED_FOR_REVIEW' as const;
    case 'REQUEST_CHANGES':
      return 'CHANGES_REQUESTED' as const;
    case 'APPROVE':
      return 'APPROVED' as const;
    case 'SCHEDULE':
      return 'SCHEDULED' as const;
    case 'PUBLISH':
      return 'PUBLISHED' as const;
    default:
      return null;
  }
}

function notificationTitle(action: WorkflowAction, label: string): string {
  switch (action) {
    case 'SUBMIT_FOR_REVIEW':
      return `"${label}" is ready for review`;
    case 'REQUEST_CHANGES':
      return `Changes requested on "${label}"`;
    case 'APPROVE':
      return `"${label}" was approved`;
    case 'SCHEDULE':
      return `"${label}" is scheduled to publish`;
    case 'PUBLISH':
      return `"${label}" is now live`;
    default:
      return `"${label}" was updated`;
  }
}
