import type { ContentStatus, Prisma, PrismaClient } from '@cheezious/database';
import { deepEqual } from '@cheezious/utilities';
import { ApiError } from '@cheezious/validation';

/**
 * Content versioning.
 *
 * Three properties matter here, and each one exists because losing it would be
 * expensive for the customer:
 *
 *   1. **History is append-only.** Restoring an old version writes a *new*
 *      version whose data is a copy of the old one. Nothing is ever destroyed,
 *      so "restore the version from before last Tuesday's mistake" always works
 *      — even if someone has already restored something else since.
 *
 *   2. **Draft and published are separate.** A record's own columns are the
 *      working copy. The public site reads `publishedVersion.data`. Editing a
 *      published page therefore cannot change production until someone
 *      deliberately publishes.
 *
 *   3. **Unpublished changes are visible.** `hasUnpublishedChanges` is computed
 *      by comparing the working copy against the published snapshot, so the CMS
 *      can tell an editor their edits are not live yet.
 */

export interface VersionSnapshot {
  [key: string]: unknown;
}

export interface CreateVersionInput {
  entityType: string;
  entityId: string;
  data: VersionSnapshot;
  status: ContentStatus;
  createdById?: string | null;
  note?: string | null;
  restoredFromVersionId?: string | null;
}

export class VersioningService {
  constructor(private readonly prisma: PrismaClient) {}

  /**
   * Write a new version.
   *
   * The version number is derived inside the same transaction as the insert, and
   * the table carries a unique constraint on (entityType, entityId,
   * versionNumber), so two editors saving simultaneously cannot produce two
   * version 7s — one of them retries.
   */
  async createVersion(input: CreateVersionInput, tx?: Prisma.TransactionClient) {
    const client = tx ?? this.prisma;

    const latest = await client.contentVersion.findFirst({
      where: { entityType: input.entityType, entityId: input.entityId },
      orderBy: { versionNumber: 'desc' },
      select: { versionNumber: true },
    });

    return client.contentVersion.create({
      data: {
        entityType: input.entityType,
        entityId: input.entityId,
        versionNumber: (latest?.versionNumber ?? 0) + 1,
        data: input.data as Prisma.InputJsonValue,
        status: input.status,
        createdById: input.createdById ?? null,
        note: input.note ?? null,
        restoredFromVersionId: input.restoredFromVersionId ?? null,
      },
    });
  }

  async listVersions(entityType: string, entityId: string, limit = 50) {
    return this.prisma.contentVersion.findMany({
      where: { entityType, entityId },
      orderBy: { versionNumber: 'desc' },
      take: limit,
      include: { createdBy: { select: { id: true, name: true, email: true } } },
    });
  }

  async getVersion(versionId: string) {
    const version = await this.prisma.contentVersion.findUnique({
      where: { id: versionId },
      include: { createdBy: { select: { id: true, name: true, email: true } } },
    });
    if (!version) throw ApiError.notFound('Version');
    return version;
  }

  /**
   * Compare two versions field by field.
   *
   * Returns only fields that differ, classified as added, removed or changed, so
   * the CMS revision panel can render a readable diff instead of two blobs of
   * JSON side by side.
   */
  async diff(fromVersionId: string, toVersionId: string): Promise<VersionDiff> {
    const [from, to] = await Promise.all([
      this.getVersion(fromVersionId),
      this.getVersion(toVersionId),
    ]);

    if (from.entityType !== to.entityType || from.entityId !== to.entityId) {
      throw ApiError.conflict('Those versions belong to different content.');
    }

    return {
      from: {
        id: from.id,
        versionNumber: from.versionNumber,
        createdAt: from.createdAt,
        author: from.createdBy,
      },
      to: {
        id: to.id,
        versionNumber: to.versionNumber,
        createdAt: to.createdAt,
        author: to.createdBy,
      },
      fields: diffSnapshots(from.data as VersionSnapshot, to.data as VersionSnapshot),
    };
  }
}

export interface VersionDiffField {
  field: string;
  change: 'added' | 'removed' | 'changed';
  from: unknown;
  to: unknown;
}

export interface VersionDiff {
  from: { id: string; versionNumber: number; createdAt: Date; author: unknown };
  to: { id: string; versionNumber: number; createdAt: Date; author: unknown };
  fields: VersionDiffField[];
}

export function diffSnapshots(from: VersionSnapshot, to: VersionSnapshot): VersionDiffField[] {
  const keys = [...new Set([...Object.keys(from), ...Object.keys(to)])].sort();
  const fields: VersionDiffField[] = [];

  for (const key of keys) {
    const before = from[key];
    const after = to[key];
    if (deepEqual(before, after)) continue;

    const wasAbsent = before === undefined || before === null;
    const isAbsent = after === undefined || after === null;

    fields.push({
      field: key,
      change: wasAbsent ? 'added' : isAbsent ? 'removed' : 'changed',
      from: before ?? null,
      to: after ?? null,
    });
  }

  return fields;
}

/**
 * Whether the working copy differs from what is published.
 *
 * Volatile bookkeeping columns are excluded: `updatedAt` changes on every write,
 * and comparing it would mark every page as having unpublished changes forever.
 */
const IGNORED_WHEN_COMPARING = new Set([
  'updatedAt',
  'createdAt',
  'updatedById',
  'publishedAt',
  'publishedById',
  'publishedVersionId',
  'hasUnpublishedChanges',
  'scheduledFor',
  'status',
  'translationStatus',
]);

export function hasUnpublishedChanges(
  working: VersionSnapshot,
  published: VersionSnapshot | null | undefined,
): boolean {
  if (!published) return true;

  const keys = new Set([...Object.keys(working), ...Object.keys(published)]);
  for (const key of keys) {
    if (IGNORED_WHEN_COMPARING.has(key)) continue;
    if (!deepEqual(working[key], published[key])) return true;
  }
  return false;
}
