import type { AuditAction, Prisma, PrismaClient } from '@cheezious/database';
import { stableStringify } from '@cheezious/utilities';

/**
 * Audit logging.
 *
 * Every administrative action that changes state is recorded here. Two rules
 * govern what gets written:
 *
 *   1. Never log a secret. Password hashes, tokens and session data are stripped
 *      before a diff is computed, not after.
 *   2. Never log personal data from a submission. An audit entry records *that*
 *      an applicant's status changed, not the applicant's phone number, so
 *      reading the audit log does not become a way around `applications.read`.
 */

/** Field names whose values must never reach the audit log. */
const REDACTED_FIELDS = new Set([
  'password',
  'passwordHash',
  'currentPassword',
  'newPassword',
  'token',
  'tokenHash',
  'secret',
  'secretRef',
  'ssoSubject',
]);

/** Personal-data fields recorded as "changed" without their values. */
const PERSONAL_DATA_FIELDS = new Set([
  'email',
  'phone',
  'firstName',
  'lastName',
  'contactName',
  'address',
  'addressLine',
  'coverNote',
  'message',
  'proposal',
  'notes',
  'answers',
  'linkedinUrl',
  'portfolioUrl',
  'ipHash',
  'userAgent',
  'routingEmail',
  'recipientEmails',
  'internalSource',
  'internalReference',
]);

export interface AuditActor {
  id?: string | null;
  email?: string | null;
  ipAddress?: string | null;
  userAgent?: string | null;
}

export interface AuditEntry {
  action: AuditAction;
  entityType: string;
  entityId?: string | null;
  entityLabel?: string | null;
  summary?: string | null;
  before?: Record<string, unknown> | null;
  after?: Record<string, unknown> | null;
  metadata?: Record<string, unknown> | null;
}

export interface FieldChange {
  from: unknown;
  to: unknown;
}

/**
 * Compute a field-level diff between two states, redacting as it goes.
 *
 * Only changed fields are kept, so an audit entry for "renamed a page" does not
 * carry the page's entire body.
 */
export function diffStates(
  before: Record<string, unknown> | null | undefined,
  after: Record<string, unknown> | null | undefined,
): Record<string, FieldChange> | null {
  if (!before && !after) return null;

  const keys = new Set([...Object.keys(before ?? {}), ...Object.keys(after ?? {})]);
  const changes: Record<string, FieldChange> = {};

  for (const key of keys) {
    if (REDACTED_FIELDS.has(key)) continue;

    const from = before?.[key];
    const to = after?.[key];
    if (stableStringify(from) === stableStringify(to)) continue;

    if (PERSONAL_DATA_FIELDS.has(key)) {
      // Record that it changed, never what it changed to.
      changes[key] = { from: '[personal data]', to: '[personal data]' };
      continue;
    }

    changes[key] = { from: summarise(from), to: summarise(to) };
  }

  return Object.keys(changes).length > 0 ? changes : null;
}

/** Keep diffs readable: long text and large arrays are summarised, not inlined. */
function summarise(value: unknown): unknown {
  if (value === null || value === undefined) return null;
  if (typeof value === 'string') {
    return value.length > 200 ? `${value.slice(0, 200)}… (${value.length} characters)` : value;
  }
  if (Array.isArray(value)) {
    return value.length > 10 ? `[${value.length} items]` : value.map(summarise);
  }
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'object') {
    const json = stableStringify(value);
    return json.length > 400 ? `[object, ${json.length} characters]` : value;
  }
  return value;
}

export class AuditService {
  constructor(private readonly prisma: PrismaClient) {}

  /**
   * Write an audit entry.
   *
   * Audit failures never fail the operation being audited — a full disk should
   * not prevent an editor from publishing — but they are logged loudly.
   */
  async record(actor: AuditActor, entry: AuditEntry, tx?: Prisma.TransactionClient): Promise<void> {
    const client = tx ?? this.prisma;
    const changes = diffStates(entry.before, entry.after);

    await client.auditLog.create({
      data: {
        actorId: actor.id ?? null,
        actorEmail: actor.email ?? null,
        action: entry.action,
        entityType: entry.entityType,
        entityId: entry.entityId ?? null,
        entityLabel: entry.entityLabel?.slice(0, 300) ?? null,
        summary: entry.summary?.slice(0, 1000) ?? null,
        // Prisma's InputJsonValue does not model an arbitrary record, so the
        // already-serialisable diff is widened through unknown.
        changes: (changes ?? undefined) as unknown as Prisma.InputJsonValue,
        metadata: (entry.metadata ?? undefined) as unknown as Prisma.InputJsonValue,
        ipAddress: actor.ipAddress ?? null,
        userAgent: actor.userAgent?.slice(0, 500) ?? null,
      },
    });
  }

  /** Lightweight activity feed entry for the CMS dashboard. */
  async activity(
    actorId: string | null,
    verb: string,
    entityType: string,
    entityId: string | null,
    entityLabel: string | null,
    href?: string,
    tx?: Prisma.TransactionClient,
  ): Promise<void> {
    const client = tx ?? this.prisma;
    await client.activityLog.create({
      data: {
        actorId,
        verb,
        entityType,
        entityId,
        entityLabel: entityLabel?.slice(0, 300) ?? null,
        href: href ?? null,
      },
    });
  }
}
