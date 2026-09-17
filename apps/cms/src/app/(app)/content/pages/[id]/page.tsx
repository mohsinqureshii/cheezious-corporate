import { headers } from 'next/headers';
import { notFound } from 'next/navigation';

import { PageEditor, type EditorPage } from '@/components/editor/PageEditor';
import { cmsFetch, CmsApiError, getSession } from '@/lib/api';

/**
 * Page editor route.
 *
 * The available transitions come from the API, which computes them from the
 * page's current status *and* this user's permissions — so the editor never
 * renders an action that would be refused.
 */

export const dynamic = 'force-dynamic';

interface EditorResponse {
  page: EditorPage;
  versions: Array<{
    id: string;
    versionNumber: number;
    createdAt: string;
    note: string | null;
    createdBy: { name: string } | null;
  }>;
  availableTransitions: Array<{
    action: string;
    label: string;
    description: string;
    confirm?: boolean;
  }>;
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const cookie = (await headers()).get('cookie') ?? undefined;

  try {
    const data = await cmsFetch<EditorResponse>(`/api/cms/pages/${id}`, { cookie });
    return { title: data.page.title };
  } catch {
    return { title: 'Page' };
  }
}

export default async function PageEditorRoute({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const cookie = (await headers()).get('cookie') ?? undefined;

  const [session, data] = await Promise.all([
    getSession(cookie),
    cmsFetch<EditorResponse>(`/api/cms/pages/${id}`, { cookie }).catch((error: unknown) => {
      if (error instanceof CmsApiError && error.status === 404) return null;
      throw error;
    }),
  ]);

  if (!data) notFound();

  const granted = new Set(session?.user.permissions ?? []);

  return (
    <PageEditor
      page={data.page}
      transitions={data.availableTransitions}
      versions={data.versions}
      canUpdate={granted.has('pages.update')}
      siteUrl={process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'}
    />
  );
}
