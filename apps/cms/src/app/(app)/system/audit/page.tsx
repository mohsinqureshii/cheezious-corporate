import { AuditTable, type AuditRow } from '@/components/system/AuditTable';
import { ErrorState, PageHeader } from '@/components/ui';
import { cmsFetch } from '@/lib/api';
import { requireUsableSession } from '@/lib/session';
import type { ListMeta } from '@/lib/types';

/**
 * The audit log.
 *
 * Who did what, when, and from where.
 */

export const dynamic = 'force-dynamic';

export const metadata = { title: 'Audit log' };

export default async function AuditPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const { cookie } = await requireUsableSession();

  const query = {
    page: single(params.page) ?? '1',
    pageSize: '50',
    q: single(params.q),
    action: single(params.action),
    entityType: single(params.entityType),
    from: single(params.from),
    to: single(params.to),
  };

  const data = await cmsFetch<{
    items: AuditRow[];
    meta: ListMeta;
    facets: { actions: Array<{ value: string; count: number }> };
  }>('/api/cms/system/audit', { cookie, searchParams: query }).catch(() => null);

  if (!data) {
    return (
      <>
        <PageHeader title="Audit log" />
        <div className="p-06">
          <ErrorState
            title="The audit log could not be loaded"
            description="You may not have permission to read it, or the API is unavailable."
          />
        </div>
      </>
    );
  }

  return (
    <>
      <PageHeader title="Audit log" description="Every change made in the CMS, in order." />
      <AuditTable
        rows={data.items}
        meta={data.meta}
        actionFacets={data.facets.actions}
        initialQuery={{
          q: query.q ?? '',
          action: query.action ?? '',
          entityType: query.entityType ?? '',
          from: query.from ?? '',
          to: query.to ?? '',
        }}
      />
    </>
  );
}

function single(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}
