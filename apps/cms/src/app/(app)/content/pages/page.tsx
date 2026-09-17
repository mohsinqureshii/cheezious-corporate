import { headers } from 'next/headers';
import Link from 'next/link';

import { PagesTable } from '@/components/content/PagesTable';
import { PageHeader } from '@/components/ui';
import { cmsFetch, getSession } from '@/lib/api';
import type { ListMeta, PageRow, StatusFacet } from '@/lib/types';

/**
 * Pages list.
 *
 * The first screen Corporate Communications opens. Server-rendered with the
 * filters applied from the URL, so a filtered view is a shareable link — "the
 * Urdu pages still in review" is something one editor can send another.
 */

export const dynamic = 'force-dynamic';

export const metadata = { title: 'Pages' };

interface PagesResponse {
  items: PageRow[];
  meta: ListMeta;
  facets: { statuses: StatusFacet[] };
}

export default async function PagesListPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const cookie = (await headers()).get('cookie') ?? undefined;

  const query = {
    page: single(params.page) ?? '1',
    pageSize: '25',
    q: single(params.q),
    status: single(params.status),
    locale: single(params.locale),
    type: single(params.type),
    hasUnpublishedChanges: single(params.unpublished),
    sortBy: single(params.sortBy) ?? 'updatedAt',
    sortDir: single(params.sortDir) ?? 'desc',
  };

  const [session, data] = await Promise.all([
    getSession(cookie),
    cmsFetch<PagesResponse>('/api/cms/pages', { cookie, searchParams: query }).catch(() => null),
  ]);

  const granted = new Set(session?.user.permissions ?? []);
  const canCreate = granted.has('pages.create');

  if (!data) {
    return (
      <>
        <PageHeader title="Pages" />
        <div className="p-06">
          <div className="border-s-[3px] border-status-danger bg-status-dangerSubtle px-05 py-04" role="alert">
            <p className="text-heading-compact">Pages could not be loaded</p>
            <p className="mt-01 text-body-01 text-content-secondary">
              The API did not respond. Try reloading in a moment.
            </p>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <PageHeader
        title="Pages"
        description="Every page on the corporate site, in both languages."
        actions={
          canCreate ? (
            <Link href="/content/pages/new" className="btn-primary no-underline">
              Create page
            </Link>
          ) : undefined
        }
      />

      <PagesTable
        rows={data.items}
        meta={data.meta}
        statusFacets={data.facets.statuses}
        canCreate={canCreate}
        canPublish={granted.has('pages.publish')}
        canDelete={granted.has('pages.delete')}
        initialQuery={{
          q: query.q ?? '',
          status: query.status ?? '',
          locale: query.locale ?? '',
          unpublished: query.hasUnpublishedChanges === 'true',
        }}
      />
    </>
  );
}

function single(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}
