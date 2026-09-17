import { formatRelativeTime } from '@cheezious/utilities';
import { headers } from 'next/headers';
import Link from 'next/link';

import { PageHeader, StatusTag, UnpublishedChangesTag } from '@/components/ui';
import { cmsFetch, getSession } from '@/lib/api';
import { QUICK_CREATE } from '@/lib/navigation';

/**
 * The CMS dashboard.
 *
 * Answers, in order: what is mine, what is waiting on someone, what goes live
 * today, what arrived overnight, and what is broken. Deliberately not an
 * analytics screen — a publishing team opens the CMS to find their work, not to
 * look at a chart.
 */

export const dynamic = 'force-dynamic';

interface PageCard {
  id: string;
  title: string;
  path: string;
  locale: string;
  status: string;
  hasUnpublishedChanges: boolean;
  publishedAt: string | null;
  scheduledFor: string | null;
  updatedAt: string;
  updatedBy: { id: string; name: string } | null;
}

interface DashboardData {
  myWork: {
    drafts: PageCard[];
    changesRequested: PageCard[];
    scheduled: PageCard[];
    recentlyEdited: PageCard[];
  } | null;
  reviewQueue: {
    awaitingReview: PageCard[];
    awaitingApproval: PageCard[];
    agingCount: number;
  } | null;
  publishing: {
    today: PageCard[];
    thisWeek: PageCard[];
    recentlyPublished: PageCard[];
    failedJobs: Array<{
      id: string;
      kind: string;
      entityType: string | null;
      lastError: string | null;
      attempts: number;
      updatedAt: string;
    }>;
  } | null;
  inbox: Record<string, number | null>;
  activity: {
    entries: Array<{
      id: string;
      verb: string;
      entityType: string;
      entityLabel: string | null;
      href: string | null;
      createdAt: string;
      actor: { id: string; name: string } | null;
    }>;
    canSeeAuditLog: boolean;
  };
  contentHealth: {
    issues: Array<{ type: string; label: string; count: number; severity: string }>;
    totalIssues: number;
  } | null;
  system: {
    pendingJobs: number;
    failedJobs: number;
    activeSessions: number;
    totalUsers: number;
  } | null;
}

export default async function DashboardPage() {
  const cookie = (await headers()).get('cookie') ?? undefined;
  const [session, data] = await Promise.all([
    getSession(cookie),
    cmsFetch<DashboardData>('/api/cms/dashboard', { cookie }).catch(() => null),
  ]);

  const firstName = session?.user.name.split(' ')[0] ?? 'there';
  const granted = new Set(session?.user.permissions ?? []);
  const createActions = QUICK_CREATE.filter((action) =>
    action.permissions.some((permission) => granted.has(permission)),
  );

  if (!data) {
    return (
      <>
        <PageHeader title="Dashboard" />
        <div className="p-06">
          <div
            className="border-s-[3px] border-status-danger bg-status-dangerSubtle px-05 py-04"
            role="alert"
          >
            <p className="text-heading-compact">The dashboard could not be loaded</p>
            <p className="mt-01 text-body-01 text-content-secondary">
              The API did not respond. Your work is unaffected — try reloading in a moment.
            </p>
          </div>
        </div>
      </>
    );
  }

  const inboxItems = [
    {
      key: 'applications',
      label: 'Job applications',
      href: '/careers/applications',
      count: data.inbox.applications,
    },
    {
      key: 'suppliers',
      label: 'Supplier submissions',
      href: '/partners/suppliers',
      count: data.inbox.suppliers,
    },
    {
      key: 'properties',
      label: 'Property submissions',
      href: '/partners/properties',
      count: data.inbox.properties,
    },
    {
      key: 'partnerships',
      label: 'Partnership enquiries',
      href: '/partners/partnerships',
      count: data.inbox.partnerships,
    },
    {
      key: 'contact',
      label: 'Contact submissions',
      href: '/forms/contact',
      count: data.inbox.contact,
    },
    // A queue this user cannot read is omitted entirely rather than shown as zero.
  ].filter((item) => item.count !== null && item.count !== undefined);

  const myWorkTotal = data.myWork
    ? data.myWork.drafts.length + data.myWork.changesRequested.length + data.myWork.scheduled.length
    : 0;

  return (
    <>
      <PageHeader
        title={`Good ${timeOfDay()}, ${firstName}`}
        description={
          myWorkTotal > 0
            ? `You have ${myWorkTotal} item${myWorkTotal === 1 ? '' : 's'} in progress.`
            : 'Nothing is waiting on you right now.'
        }
        actions={
          createActions.length > 0 ? (
            <Link href={createActions[0]!.href} className="btn-primary no-underline">
              Create {createActions[0]!.label.toLowerCase()}
            </Link>
          ) : undefined
        }
      />

      <div className="grid gap-05 p-06 xl:grid-cols-3">
        {/* --- Primary column ------------------------------------------- */}
        <div className="space-y-05 xl:col-span-2">
          {data.myWork ? (
            <Panel
              title="My work"
              action={{ label: 'View all', href: '/my-work' }}
              empty={
                myWorkTotal === 0 && data.myWork.recentlyEdited.length === 0
                  ? {
                      title: 'Nothing in progress',
                      description: 'Content you create or edit will appear here.',
                      action: createActions[0]
                        ? {
                            label: `Create ${createActions[0].label.toLowerCase()}`,
                            href: createActions[0].href,
                          }
                        : undefined,
                    }
                  : undefined
              }
            >
              <Section
                label="Changes requested"
                pages={data.myWork.changesRequested}
                tone="warning"
              />
              <Section label="Drafts" pages={data.myWork.drafts} />
              <Section label="Scheduled" pages={data.myWork.scheduled} />
              {myWorkTotal === 0 ? (
                <Section label="Recently edited" pages={data.myWork.recentlyEdited} />
              ) : null}
            </Panel>
          ) : null}

          {data.reviewQueue ? (
            <Panel
              title="Review queue"
              action={{ label: 'Open queue', href: '/review' }}
              badge={
                data.reviewQueue.agingCount > 0
                  ? {
                      label: `${data.reviewQueue.agingCount} waiting over a week`,
                      tone: 'warning' as const,
                    }
                  : undefined
              }
              empty={
                data.reviewQueue.awaitingReview.length === 0 &&
                data.reviewQueue.awaitingApproval.length === 0
                  ? {
                      title: 'Nothing awaiting review',
                      description: 'Submitted content will appear here.',
                    }
                  : undefined
              }
            >
              <Section label="Awaiting review" pages={data.reviewQueue.awaitingReview} />
              <Section label="Awaiting approval" pages={data.reviewQueue.awaitingApproval} />
            </Panel>
          ) : null}

          {data.publishing ? (
            <Panel
              title="Publishing"
              action={{ label: 'Scheduled content', href: '/scheduled' }}
              empty={
                data.publishing.today.length === 0 &&
                data.publishing.thisWeek.length === 0 &&
                data.publishing.recentlyPublished.length === 0
                  ? {
                      title: 'Nothing scheduled',
                      description: 'Scheduled and recently published content appears here.',
                    }
                  : undefined
              }
            >
              {/* A failed scheduled publish is invisible unless it is shown
                  first, above everything that went fine. */}
              {data.publishing.failedJobs.length > 0 ? (
                <div className="mb-04 border-s-[3px] border-status-danger bg-status-dangerSubtle px-05 py-04">
                  <p className="text-heading-compact text-content-primary">
                    {data.publishing.failedJobs.length} publishing job
                    {data.publishing.failedJobs.length === 1 ? '' : 's'} failed
                  </p>
                  <ul className="mt-02 space-y-01">
                    {data.publishing.failedJobs.slice(0, 3).map((job) => (
                      <li key={job.id} className="text-body-compact text-content-secondary">
                        {job.kind} · {job.lastError ?? 'Unknown error'} ({job.attempts} attempts)
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}

              <Section label="Publishing today" pages={data.publishing.today} showScheduled />
              <Section label="Later this week" pages={data.publishing.thisWeek} showScheduled />
              <Section label="Recently published" pages={data.publishing.recentlyPublished} />
            </Panel>
          ) : null}
        </div>

        {/* --- Secondary column ------------------------------------------ */}
        <div className="space-y-05">
          {inboxItems.length > 0 ? (
            <Panel title="Inbox">
              <ul className="divide-y divide-border-subtle">
                {inboxItems.map((item) => (
                  <li key={item.key}>
                    <Link
                      href={item.href}
                      className="flex items-center justify-between px-05 py-04 no-underline hover:bg-surface-hover"
                    >
                      <span className="text-body-01 text-content-primary">{item.label}</span>
                      <span
                        className={[
                          'tabular text-heading-02',
                          item.count && item.count > 0
                            ? 'text-content-primary'
                            : 'text-content-tertiary',
                        ].join(' ')}
                      >
                        {item.count ?? 0}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </Panel>
          ) : null}

          {createActions.length > 0 ? (
            <Panel title="Quick create">
              <ul className="grid grid-cols-2 gap-px bg-border-subtle">
                {createActions.map((action) => (
                  <li key={action.href} className="bg-surface-base">
                    <Link
                      href={action.href}
                      className="block px-05 py-04 text-body-compact text-interactive no-underline hover:bg-surface-hover"
                    >
                      {action.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </Panel>
          ) : null}

          {data.contentHealth && data.contentHealth.issues.length > 0 ? (
            <Panel
              title="Content health"
              action={{ label: 'View all', href: '/system/content-health' }}
            >
              <ul className="divide-y divide-border-subtle">
                {data.contentHealth.issues.slice(0, 6).map((issue) => (
                  <li key={issue.type} className="flex items-center justify-between px-05 py-03">
                    <span className="flex items-center gap-03 text-body-compact text-content-primary">
                      <span
                        aria-hidden="true"
                        className={[
                          'inline-block h-1.5 w-1.5 rounded-full',
                          issue.severity === 'error' ? 'bg-status-danger' : '',
                          issue.severity === 'warning' ? 'bg-status-warning' : '',
                          issue.severity === 'info' ? 'bg-status-info' : '',
                        ].join(' ')}
                      />
                      {issue.label}
                    </span>
                    <span className="tabular text-body-compact text-content-secondary">
                      {issue.count}
                    </span>
                  </li>
                ))}
              </ul>
            </Panel>
          ) : null}

          <Panel
            title="Recent activity"
            action={
              data.activity.canSeeAuditLog
                ? { label: 'Audit log', href: '/system/audit' }
                : undefined
            }
            empty={
              data.activity.entries.length === 0
                ? {
                    title: 'No recent activity',
                    description: 'Changes made in the CMS appear here.',
                  }
                : undefined
            }
          >
            <ul className="divide-y divide-border-subtle">
              {data.activity.entries.slice(0, 10).map((entry) => (
                <li key={entry.id} className="px-05 py-03">
                  <p className="text-body-compact text-content-primary">
                    <span className="font-medium">{entry.actor?.name ?? 'Someone'}</span>{' '}
                    {entry.verb}{' '}
                    {entry.href ? (
                      <Link
                        href={entry.href}
                        className="text-interactive no-underline hover:underline"
                      >
                        {entry.entityLabel ?? entry.entityType}
                      </Link>
                    ) : (
                      (entry.entityLabel ?? entry.entityType)
                    )}
                  </p>
                  <p className="mt-01 text-helper-01 text-content-tertiary">
                    {formatRelativeTime(entry.createdAt)}
                  </p>
                </li>
              ))}
            </ul>
          </Panel>

          {data.system ? (
            <Panel title="System">
              <dl className="grid grid-cols-2 gap-px bg-border-subtle">
                <Stat label="Pending jobs" value={data.system.pendingJobs} />
                <Stat
                  label="Failed jobs"
                  value={data.system.failedJobs}
                  alert={data.system.failedJobs > 0}
                />
                <Stat label="Active sessions" value={data.system.activeSessions} />
                <Stat label="Active users" value={data.system.totalUsers} />
              </dl>
            </Panel>
          ) : null}
        </div>
      </div>
    </>
  );
}

function Panel({
  title,
  action,
  badge,
  empty,
  children,
}: {
  title: string;
  action?: { label: string; href: string };
  badge?: { label: string; tone: 'warning' | 'info' };
  empty?: { title: string; description?: string; action?: { label: string; href: string } };
  children: React.ReactNode;
}) {
  return (
    <section className="panel">
      <div className="flex items-center justify-between border-b border-border-subtle px-05 py-03">
        <div className="flex items-center gap-03">
          <h2 className="text-heading-02 text-content-primary">{title}</h2>
          {badge ? (
            <span
              className={[
                'tag',
                badge.tone === 'warning'
                  ? 'bg-status-warningSubtle text-gray-90'
                  : 'bg-status-infoSubtle text-status-info',
              ].join(' ')}
            >
              {badge.label}
            </span>
          ) : null}
        </div>
        {action ? (
          <Link
            href={action.href}
            className="text-body-compact text-interactive no-underline hover:underline"
          >
            {action.label}
          </Link>
        ) : null}
      </div>

      {empty ? (
        <div className="px-05 py-08 text-center">
          <p className="text-heading-compact text-content-primary">{empty.title}</p>
          {empty.description ? (
            <p className="mt-01 text-body-01 text-content-secondary">{empty.description}</p>
          ) : null}
          {empty.action ? (
            <Link href={empty.action.href} className="btn-tertiary btn-sm mt-04 no-underline">
              {empty.action.label}
            </Link>
          ) : null}
        </div>
      ) : (
        children
      )}
    </section>
  );
}

function Section({
  label,
  pages,
  tone,
  showScheduled = false,
}: {
  label: string;
  pages: PageCard[];
  tone?: 'warning';
  showScheduled?: boolean;
}) {
  if (pages.length === 0) return null;

  return (
    <div className="border-b border-border-subtle last:border-b-0">
      <p
        className={[
          'px-05 pt-03 text-label-01 uppercase tracking-wide',
          tone === 'warning' ? 'text-status-danger' : 'text-content-tertiary',
        ].join(' ')}
      >
        {label} ({pages.length})
      </p>
      <ul>
        {pages.map((page) => (
          <li key={page.id}>
            <Link
              href={`/content/pages/${page.id}`}
              className="flex items-center justify-between gap-04 px-05 py-03 no-underline hover:bg-surface-hover"
            >
              <span className="min-w-0 flex-1">
                <span className="block truncate text-body-01 text-content-primary">
                  {page.title}
                </span>
                <span className="block truncate text-helper-01 text-content-tertiary">
                  {page.path} · {page.locale.toUpperCase()}
                  {page.updatedBy ? ` · ${page.updatedBy.name}` : ''}
                </span>
              </span>

              <span className="flex shrink-0 items-center gap-02">
                {page.hasUnpublishedChanges && page.status === 'PUBLISHED' ? (
                  <UnpublishedChangesTag />
                ) : null}
                <StatusTag status={page.status} size="sm" />
                <span className="hidden w-24 text-end text-helper-01 text-content-tertiary sm:inline">
                  {showScheduled && page.scheduledFor
                    ? formatRelativeTime(page.scheduledFor)
                    : formatRelativeTime(page.updatedAt)}
                </span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

function Stat({ label, value, alert = false }: { label: string; value: number; alert?: boolean }) {
  return (
    <div className="bg-surface-base px-05 py-04">
      <dt className="text-label-01 text-content-secondary">{label}</dt>
      <dd
        className={[
          'mt-01 text-heading-03 tabular',
          alert ? 'text-status-danger' : 'text-content-primary',
        ].join(' ')}
      >
        {value}
      </dd>
    </div>
  );
}

function timeOfDay(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'morning';
  if (hour < 18) return 'afternoon';
  return 'evening';
}
