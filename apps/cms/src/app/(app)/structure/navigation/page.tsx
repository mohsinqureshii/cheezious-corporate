import { NavigationEditor, type Navigation } from '@/components/structure/NavigationEditor';
import { ErrorState, PageHeader } from '@/components/ui';
import { cmsFetch } from '@/lib/api';
import { requireUsableSession } from '@/lib/session';

export const dynamic = 'force-dynamic';

export const metadata = { title: 'Navigation' };

export default async function NavigationPage() {
  const { session, cookie } = await requireUsableSession();

  const data = await cmsFetch<{ navigations: Navigation[] }>('/api/cms/structure/navigation', { cookie }).catch(
    () => null,
  );

  if (!data) {
    return (
      <>
        <PageHeader title="Navigation" />
        <div className="p-06">
          <ErrorState title="Navigation could not be loaded" description="Managing navigation is restricted." />
        </div>
      </>
    );
  }

  return (
    <>
      <PageHeader title="Navigation" description="The menus visitors use to find their way around." />
      <NavigationEditor
        navigations={data.navigations}
        canManage={session.user.permissions.includes('navigation.manage')}
      />
    </>
  );
}
