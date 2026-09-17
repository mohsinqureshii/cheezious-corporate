import { CreatePageForm, type ParentOption } from '@/components/editor/CreatePageForm';
import { ErrorState, PageHeader } from '@/components/ui';
import { cmsFetch } from '@/lib/api';
import { requireUsableSession } from '@/lib/session';

/**
 * Create a page.
 *
 * A separate route rather than a dialog, because choosing where a page lives is
 * a decision that deserves a screen and a back button.
 */

export const dynamic = 'force-dynamic';

export const metadata = { title: 'Create page' };

export default async function CreatePageRoute() {
  const { session, cookie } = await requireUsableSession();

  if (!session.user.permissions.includes('pages.create')) {
    return (
      <>
        <PageHeader title="Create page" />
        <div className="p-06">
          <ErrorState
            title="You cannot create pages"
            description="Your roles do not include it. An administrator can change that."
          />
        </div>
      </>
    );
  }

  // Sections are the plausible parents: a landing page or a section index.
  const parents = await cmsFetch<{ items: ParentOption[] }>('/api/cms/pages', {
    cookie,
    searchParams: { pageSize: '100', sortBy: 'path', sortDir: 'asc', locale: 'en' },
  })
    .then((response) => response.items)
    .catch(() => []);

  return (
    <>
      <PageHeader
        title="Create page"
        description="Where it lives and what it is called. The content comes next."
        breadcrumb={[{ label: 'Pages', href: '/content/pages' }, { label: 'Create' }]}
      />
      <CreatePageForm parents={parents} />
    </>
  );
}
