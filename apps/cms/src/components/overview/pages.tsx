import { WorkSection, type WorkItem } from '@/components/overview/WorkList';
import { ErrorState, PageHeader } from '@/components/ui';
import { cmsFetch } from '@/lib/api';
import { requireUsableSession } from '@/lib/session';

/**
 * Overview screens.
 *
 * What is on your plate, what is waiting on someone else, what goes live soon,
 * and what changed recently. They are separate screens rather than four tabs on
 * the dashboard because each one is a different person's morning: an author
 * opens My work, a reviewer opens Review, Communications opens Scheduled.
 */

interface DashboardResponse {
  myWork: {
    drafts: WorkItem[];
    changesRequested: WorkItem[];
    scheduled: WorkItem[];
    recentlyEdited: WorkItem[];
  };
  reviewQueue: { awaitingReview: WorkItem[]; awaitingApproval: WorkItem[]; agingCount: number };
  publishing: {
    today: WorkItem[];
    thisWeek: WorkItem[];
    recentlyPublished: WorkItem[];
    failedJobs: Array<{ id: string; entityType: string; entityId: string; lastError: string | null }>;
  };
}

async function dashboard(cookie?: string): Promise<DashboardResponse | null> {
  return cmsFetch<DashboardResponse>('/api/cms/dashboard', { cookie }).catch(() => null);
}

function Unavailable({ title }: { title: string }) {
  return (
    <>
      <PageHeader title={title} />
      <div className="p-06">
        <ErrorState
          title="This could not be loaded"
          description="The API did not respond. Try reloading in a moment."
        />
      </div>
    </>
  );
}

export function myWorkPage() {
  return async function MyWorkPage() {
    const { session, cookie } = await requireUsableSession();
    const data = await dashboard(cookie);
    if (!data) return <Unavailable title="My work" />;

    const { drafts, changesRequested, scheduled, recentlyEdited } = data.myWork;
    const outstanding = drafts.length + changesRequested.length;

    return (
      <>
        <PageHeader
          title="My work"
          description={
            outstanding > 0
              ? `${outstanding} item${outstanding === 1 ? '' : 's'} waiting on you, ${session.user.name.split(' ')[0]}.`
              : 'Nothing is waiting on you.'
          }
        />

        <div className="space-y-06 p-06">
          <WorkSection
            title="Changes requested"
            description="A reviewer has asked for something. These come first."
            items={changesRequested}
            emptyTitle="Nothing sent back"
            emptyDescription="No reviewer has asked you for changes."
          />
          <WorkSection
            title="Your drafts"
            items={drafts}
            emptyTitle="No drafts"
            emptyDescription="Anything you start and have not submitted appears here."
          />
          <WorkSection
            title="Scheduled"
            items={scheduled}
            showScheduled
            emptyTitle="Nothing scheduled"
            emptyDescription="Content you have scheduled to publish appears here."
          />
          <WorkSection
            title="Recently edited by you"
            items={recentlyEdited}
            emptyTitle="Nothing yet"
            emptyDescription="The last things you touched appear here."
          />
        </div>
      </>
    );
  };
}

export function reviewPage() {
  return async function ReviewPage() {
    const { cookie } = await requireUsableSession();
    const data = await dashboard(cookie);
    if (!data) return <Unavailable title="Review queue" />;

    const { awaitingReview, awaitingApproval, agingCount } = data.reviewQueue;
    const total = awaitingReview.length + awaitingApproval.length;

    return (
      <>
        <PageHeader
          title="Review queue"
          description={
            total > 0
              ? `${total} item${total === 1 ? '' : 's'} waiting${agingCount > 0 ? `, ${agingCount} of them for more than a few days` : ''}.`
              : 'Nothing is waiting for review.'
          }
        />

        <div className="space-y-06 p-06">
          <WorkSection
            title="Waiting for review"
            description="Submitted by an author and not yet looked at."
            items={awaitingReview}
            emptyTitle="Nothing to review"
            emptyDescription="Work submitted for review appears here."
          />
          <WorkSection
            title="Waiting for approval"
            description="Reviewed, and now needing someone who can approve it."
            items={awaitingApproval}
            emptyTitle="Nothing to approve"
            emptyDescription="Reviewed work waiting on approval appears here."
          />
        </div>
      </>
    );
  };
}

export function scheduledPage() {
  return async function ScheduledPage() {
    const { cookie } = await requireUsableSession();
    const data = await dashboard(cookie);
    if (!data) return <Unavailable title="Scheduled" />;

    const { today, thisWeek, failedJobs } = data.publishing;

    return (
      <>
        <PageHeader
          title="Scheduled"
          description="What the site will publish by itself, and when."
        />

        <div className="space-y-06 p-06">
          {failedJobs.length > 0 ? (
            <div className="border-s-[3px] border-status-danger bg-status-dangerSubtle px-05 py-04" role="alert">
              <p className="text-heading-compact text-content-primary">
                {failedJobs.length} scheduled publish failed
              </p>
              <ul className="mt-02 space-y-01">
                {failedJobs.map((job) => (
                  <li key={job.id} className="text-helper-01 text-content-secondary">
                    {job.entityType} {job.entityId}
                    {job.lastError ? ` — ${job.lastError}` : ''}
                  </li>
                ))}
              </ul>
              <p className="mt-02 text-helper-01 text-content-secondary">
                These did not go live. Open the item and publish it, or reschedule it.
              </p>
            </div>
          ) : null}

          <WorkSection
            title="Today"
            items={today}
            showScheduled
            emptyTitle="Nothing today"
            emptyDescription="Nothing is scheduled to publish in the next 24 hours."
          />
          <WorkSection
            title="This week"
            items={thisWeek}
            showScheduled
            emptyTitle="Nothing this week"
            emptyDescription="Nothing is scheduled to publish in the next seven days."
          />
        </div>
      </>
    );
  };
}

export function recentPage() {
  return async function RecentPage() {
    const { cookie } = await requireUsableSession();
    const data = await dashboard(cookie);
    if (!data) return <Unavailable title="Recently updated" />;

    return (
      <>
        <PageHeader title="Recently updated" description="What has changed across the site lately." />

        <div className="space-y-06 p-06">
          <WorkSection
            title="Recently published"
            items={data.publishing.recentlyPublished}
            emptyTitle="Nothing published yet"
            emptyDescription="Published content appears here as it goes live."
          />
          <WorkSection
            title="Recently edited by you"
            items={data.myWork.recentlyEdited}
            emptyTitle="Nothing yet"
            emptyDescription="The last things you touched appear here."
          />
        </div>
      </>
    );
  };
}
