import { FooterEditor, type FooterConfig } from '@/components/structure/FooterEditor';
import { ErrorState, PageHeader } from '@/components/ui';
import { cmsFetch } from '@/lib/api';
import { requireUsableSession } from '@/lib/session';

export const dynamic = 'force-dynamic';

export const metadata = { title: 'Footer' };

export default async function FooterPage() {
  const { session, cookie } = await requireUsableSession();

  const data = await cmsFetch<{ footers: FooterConfig[] }>('/api/cms/structure/footer', {
    cookie,
  }).catch(() => null);

  if (!data) {
    return (
      <>
        <PageHeader title="Footer" />
        <div className="p-06">
          <ErrorState
            title="The footer could not be loaded"
            description="Managing the footer is restricted."
          />
        </div>
      </>
    );
  }

  return (
    <>
      <PageHeader title="Footer" description="What sits at the bottom of every page." />
      <FooterEditor
        footers={data.footers}
        canManage={session.user.permissions.includes('navigation.manage')}
      />
    </>
  );
}
