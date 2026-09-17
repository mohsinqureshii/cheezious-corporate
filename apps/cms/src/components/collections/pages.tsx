import Link from 'next/link';
import { notFound } from 'next/navigation';

import { CollectionTable } from '@/components/collections/CollectionTable';
import { RecordEditor } from '@/components/collections/RecordEditor';
import { ErrorState, PageHeader } from '@/components/ui';
import { CmsApiError, cmsFetch } from '@/lib/api';
import {
  collectionHref,
  type CollectionItemResponse,
  type CollectionListResponse,
} from '@/lib/collections';
import { requireUsableSession } from '@/lib/session';

/**
 * Collection screens.
 *
 * Every collection route in the CMS is three lines calling one of these. The
 * screens themselves are identical because the collections are described rather
 * than hand-written — what differs between a story and a policy is data, not
 * code.
 */

export interface SearchParams {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

/** The list screen for a collection. */
export function collectionListPage(collectionPath: string) {
  return async function CollectionListPage({ searchParams }: SearchParams) {
    const params = await searchParams;
    const { session, cookie } = await requireUsableSession();

    const query = {
      page: single(params.page) ?? '1',
      pageSize: '25',
      q: single(params.q),
      status: single(params.status),
      locale: single(params.locale),
      published: single(params.published),
      sortDir: single(params.sortDir) ?? 'desc',
      sortBy: single(params.sortBy),
    };

    let data: CollectionListResponse;
    try {
      data = await cmsFetch<CollectionListResponse>(`/api/cms/content/${collectionPath}`, {
        cookie,
        searchParams: query,
      });
    } catch (error) {
      return <CollectionError error={error} />;
    }

    const granted = new Set(session.user.permissions);
    // The API is the authority; this only decides whether to offer the button.
    const canCreate = [...granted].some(
      (permission) =>
        permission.endsWith('.create') ||
        permission.endsWith('.manage') ||
        permission.endsWith('.update'),
    );

    return (
      <>
        <PageHeader
          title={data.collection.labelPlural}
          actions={
            canCreate ? (
              <Link
                href={`${collectionHref(collectionPath)}/new`}
                className="btn-primary no-underline"
              >
                Create {data.collection.label.toLowerCase()}
              </Link>
            ) : undefined
          }
        />

        <CollectionTable
          collection={data.collection}
          rows={data.items}
          meta={data.meta}
          statusFacets={data.facets.statuses}
          canCreate={canCreate}
          initialQuery={{
            q: query.q ?? '',
            status: query.status ?? '',
            locale: query.locale ?? '',
            published: query.published ?? '',
          }}
        />
      </>
    );
  };
}

/** The editor screen. `new` creates; anything else is a record id. */
export interface RecordParams {
  params: Promise<{ id: string }>;
}

export function collectionRecordPage(collectionPath: string) {
  return async function CollectionRecordPage({ params }: RecordParams) {
    const { id } = await params;
    const { session, cookie } = await requireUsableSession();
    const granted = new Set(session.user.permissions);

    if (id === 'new') {
      // The descriptor comes from the list endpoint, which is also the cheapest
      // way to confirm this user may see the collection at all.
      let list: CollectionListResponse;
      try {
        list = await cmsFetch<CollectionListResponse>(`/api/cms/content/${collectionPath}`, {
          cookie,
          searchParams: { pageSize: '1' },
        });
      } catch (error) {
        return <CollectionError error={error} />;
      }

      return (
        <RecordEditor
          collection={list.collection}
          record={null}
          transitions={[]}
          canEdit
          listHref={collectionHref(collectionPath)}
        />
      );
    }

    let data: CollectionItemResponse;
    try {
      data = await cmsFetch<CollectionItemResponse>(`/api/cms/content/${collectionPath}/${id}`, {
        cookie,
      });
    } catch (error) {
      if (error instanceof CmsApiError && error.status === 404) notFound();
      return <CollectionError error={error} />;
    }

    const canEdit = [...granted].some(
      (permission) =>
        permission.endsWith('.update') ||
        permission.endsWith('.manage') ||
        permission.endsWith('.create'),
    );

    return (
      <RecordEditor
        collection={data.collection}
        record={data.item}
        transitions={data.transitions ?? []}
        canEdit={canEdit}
        listHref={collectionHref(collectionPath)}
      />
    );
  };
}

function CollectionError({ error }: { error: unknown }) {
  const forbidden = error instanceof CmsApiError && error.isForbidden;

  return (
    <>
      <PageHeader title={forbidden ? 'Not available to you' : 'Something went wrong'} />
      <div className="p-06">
        <ErrorState
          title={forbidden ? 'You do not have access to this section' : 'This could not be loaded'}
          description={
            forbidden
              ? 'Your roles do not include it. An administrator can change that if you need it.'
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
