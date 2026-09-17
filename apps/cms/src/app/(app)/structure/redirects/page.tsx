import { RedirectsTable, type RedirectRow } from '@/components/structure/RedirectsTable';
import { ErrorState, PageHeader } from '@/components/ui';
import { cmsFetch } from '@/lib/api';
import { requireUsableSession } from '@/lib/session';
import type { ListMeta } from '@/lib/types';

export const dynamic = 'force-dynamic';

export const metadata = { title: 'Redirects' };

export default async function RedirectsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const { session, cookie } = await requireUsableSession();

  const query = {
    page: single(params.page) ?? '1',
    pageSize: '25',
    q: single(params.q),
    isAutomatic: single(params.isAutomatic),
  };

  const data = await cmsFetch<{
    items: RedirectRow[];
    meta: ListMeta;
    facets: { automatic: number };
  }>('/api/cms/structure/redirects', { cookie, searchParams: query }).catch(() => null);

  if (!data) {
    return (
      <>
        <PageHeader title="Redirects" />
        <div className="p-06">
          <ErrorState
            title="Redirects could not be loaded"
            description="Managing redirects is restricted."
          />
        </div>
      </>
    );
  }

  return (
    <>
      <PageHeader
        title="Redirects"
        description="Where old addresses send people. Renaming a published page leaves one here automatically."
      />
      <RedirectsTable
        rows={data.items}
        meta={data.meta}
        automatic={data.facets.automatic}
        canManage={session.user.permissions.includes('redirects.manage')}
        initialQuery={{ q: query.q ?? '', isAutomatic: query.isAutomatic ?? '' }}
      />
    </>
  );
}

function single(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}
