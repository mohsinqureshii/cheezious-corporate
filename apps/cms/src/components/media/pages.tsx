import { MediaLibrary, type MediaAsset } from '@/components/media/MediaLibrary';
import { ErrorState, PageHeader } from '@/components/ui';
import { CmsApiError, cmsFetch } from '@/lib/api';
import { requireUsableSession } from '@/lib/session';
import type { ListMeta } from '@/lib/types';

/**
 * Media screens.
 *
 * One library, three views of it: everything, the brand assets third parties
 * are given, and the documents. They are separate routes because they are
 * separate jobs — nobody looking for the logo wants to scroll past four hundred
 * restaurant photographs.
 */

export interface MediaSearchParams {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

interface MediaResponse {
  items: MediaAsset[];
  meta: ListMeta;
  facets: { kinds: Array<{ value: string; count: number }>; missingAltText: number };
}

export function mediaPage(options: {
  title: string;
  description: string;
  fixed?: Record<string, string>;
}) {
  return async function MediaPage({ searchParams }: MediaSearchParams) {
    const params = await searchParams;
    const { session, cookie } = await requireUsableSession();

    const query = {
      page: single(params.page) ?? '1',
      pageSize: '48',
      q: single(params.q),
      kind: single(params.kind),
      missingAltText: single(params.missingAltText),
      ...(options.fixed ?? {}),
    };

    let data: MediaResponse;
    try {
      data = await cmsFetch<MediaResponse>('/api/cms/media', { cookie, searchParams: query });
    } catch (error) {
      const forbidden = error instanceof CmsApiError && error.isForbidden;
      return (
        <>
          <PageHeader title={options.title} />
          <div className="p-06">
            <ErrorState
              title={forbidden ? 'You do not have access to the media library' : 'This could not be loaded'}
              description={
                forbidden
                  ? 'An administrator can grant it if you need it.'
                  : 'The API did not respond. Try reloading in a moment.'
              }
            />
          </div>
        </>
      );
    }

    const granted = new Set(session.user.permissions);

    return (
      <>
        <PageHeader title={options.title} description={options.description} />
        <MediaLibrary
          items={data.items}
          meta={data.meta}
          facets={data.facets}
          initialQuery={{
            q: query.q ?? '',
            kind: query.kind ?? '',
            missingAltText: query.missingAltText === 'true',
          }}
          canUpload={granted.has('media.upload')}
          canUpdate={granted.has('media.update')}
          canDelete={granted.has('media.delete')}
          canManageBrand={granted.has('media.manageBrandAssets')}
        />
      </>
    );
  };
}

function single(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}
