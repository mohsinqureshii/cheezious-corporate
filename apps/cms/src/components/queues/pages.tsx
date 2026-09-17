import { notFound } from 'next/navigation';

import { QueueTable } from '@/components/queues/QueueTable';
import { SubmissionDetail } from '@/components/queues/SubmissionDetail';
import { ErrorState, PageHeader } from '@/components/ui';
import { CmsApiError, cmsFetch } from '@/lib/api';
import { humanizeStatus, QUEUES, type SubmissionRecord } from '@/lib/queues';
import { requireUsableSession } from '@/lib/session';
import type { ListMeta } from '@/lib/types';

/**
 * Queue screens.
 *
 * Five queues, one implementation. Each route file names its queue and nothing
 * else, so the privacy handling — what the list shows, what is behind the
 * record, how attachments are served — cannot drift between them.
 */

export interface QueueSearchParams {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export interface QueueRecordParams {
  params: Promise<{ id: string }>;
}

interface QueueListResponse {
  items: SubmissionRecord[];
  meta: ListMeta;
  facets: { statuses: Array<{ value: string; count: number }> };
}

export function queueListPage(key: keyof typeof QUEUES) {
  const queue = QUEUES[key]!;

  return async function QueueListPage({ searchParams }: QueueSearchParams) {
    const params = await searchParams;
    const { session, cookie } = await requireUsableSession();

    const query = {
      page: single(params.page) ?? '1',
      pageSize: '25',
      q: single(params.q),
      status: single(params.status),
    };

    let data: QueueListResponse;
    try {
      data = await cmsFetch<QueueListResponse>(`/api/cms/submissions/${queue.path}`, {
        cookie,
        searchParams: query,
      });
    } catch (error) {
      return <QueueError error={error} title={queue.labelPlural} />;
    }

    const granted = new Set(session.user.permissions);
    const waiting = data.facets.statuses.find((facet) => facet.value === 'NEW')?.count ?? 0;

    return (
      <>
        <PageHeader
          title={queue.labelPlural}
          description={
            waiting > 0
              ? `${waiting} new ${waiting === 1 ? 'submission is' : 'submissions are'} waiting to be looked at.`
              : `Everything received through the ${queue.labelPlural.toLowerCase()} form.`
          }
        />

        <QueueTable
          queue={queue}
          rows={data.items}
          meta={data.meta}
          statusFacets={data.facets.statuses.map((facet) => ({
            value: facet.value,
            label: humanizeStatus(facet.value),
            count: facet.count,
          }))}
          initialQuery={{ q: query.q ?? '', status: query.status ?? '' }}
          canExport={queue.exportPermission !== undefined && granted.has(queue.exportPermission)}
        />
      </>
    );
  };
}

export function queueRecordPage(key: keyof typeof QUEUES) {
  const queue = QUEUES[key]!;

  return async function QueueRecordPage({ params }: QueueRecordParams) {
    const { id } = await params;
    const { session, cookie } = await requireUsableSession();

    let submission: SubmissionRecord;
    try {
      const response = await cmsFetch<{ submission?: SubmissionRecord; application?: SubmissionRecord }>(
        `/api/cms/submissions/${queue.path}/${id}`,
        { cookie },
      );
      // Applications predate the queue factory and answer under their own key.
      const record = response.submission ?? response.application;
      if (!record) notFound();
      submission = record;
    } catch (error) {
      if (error instanceof CmsApiError && error.status === 404) notFound();
      return <QueueError error={error} title={queue.label} />;
    }

    // A failure here is not worth blocking the record for: without the list the
    // assignment control simply offers nobody.
    const assignees = await cmsFetch<{ assignees: Array<{ id: string; name: string }> }>(
      '/api/cms/submissions/assignees',
      { cookie },
    )
      .then((response) => response.assignees)
      .catch(() => []);

    const granted = new Set(session.user.permissions);

    return (
      <SubmissionDetail
        queue={queue}
        submission={submission}
        assignees={assignees}
        canManage={granted.has(queue.managePermission)}
      />
    );
  };
}

function QueueError({ error, title }: { error: unknown; title: string }) {
  const forbidden = error instanceof CmsApiError && error.isForbidden;

  return (
    <>
      <PageHeader title={title} />
      <div className="p-06">
        <ErrorState
          title={forbidden ? 'You do not have access to this queue' : 'This could not be loaded'}
          description={
            forbidden
              ? 'These submissions contain personal data and are restricted to the team that works them.'
              : 'The API did not respond. Try reloading in a moment.'
          }
        />
      </div>
    </>
  );
}

function single(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}
