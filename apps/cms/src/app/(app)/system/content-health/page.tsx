import { ContentHealthList, type HealthIssue } from '@/components/structure/ContentHealthList';
import { ErrorState, PageHeader } from '@/components/ui';
import { cmsFetch } from '@/lib/api';
import { requireUsableSession } from '@/lib/session';
import type { ListMeta } from '@/lib/types';

export const dynamic = 'force-dynamic';

export const metadata = { title: 'Content health' };

export default async function ContentHealthPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const { cookie } = await requireUsableSession();

  const query = {
    page: single(params.page) ?? '1',
    pageSize: '50',
    type: single(params.type),
    severity: single(params.severity),
    includeDismissed: single(params.includeDismissed),
  };

  const data = await cmsFetch<{
    items: HealthIssue[];
    meta: ListMeta;
    facets: { byType: Array<{ type: string; severity: string; count: number }> };
  }>('/api/cms/structure/content-health', { cookie, searchParams: query }).catch(() => null);

  if (!data) {
    return (
      <>
        <PageHeader title="Content health" />
        <div className="p-06">
          <ErrorState title="Content health could not be loaded" description="This section is restricted." />
        </div>
      </>
    );
  }

  return (
    <>
      <PageHeader
        title="Content health"
        description="What the platform can tell is wrong without anybody looking."
      />
      <ContentHealthList
        items={data.items}
        meta={data.meta}
        byType={data.facets.byType}
        initialQuery={{
          type: query.type ?? '',
          severity: query.severity ?? '',
          includeDismissed: query.includeDismissed === 'true',
        }}
      />
    </>
  );
}

function single(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}
