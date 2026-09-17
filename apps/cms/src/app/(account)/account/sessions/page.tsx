import { SessionList, type SessionRow } from '@/components/account/SessionList';
import { ErrorState, PageHeader } from '@/components/ui';
import { cmsFetch } from '@/lib/api';
import { requireUsableSession } from '@/lib/session';

/**
 * Active sessions.
 *
 * Loaded server-side so the list is accurate the moment the page appears — a
 * security screen that shows stale state is worse than none.
 */

export const dynamic = 'force-dynamic';

export const metadata = { title: 'Active sessions' };

export default async function SessionsPage() {
  const { cookie } = await requireUsableSession();

  const data = await cmsFetch<{ sessions: SessionRow[] }>('/api/auth/sessions', { cookie }).catch(() => null);

  return (
    <>
      <PageHeader
        title="Active sessions"
        description="Everywhere your account is currently signed in."
        breadcrumb={[{ label: 'Account', href: '/account' }, { label: 'Active sessions' }]}
      />

      <div className="p-06">
        <div className="max-w-3xl">
          {data ? (
            <SessionList sessions={data.sessions} />
          ) : (
            <ErrorState
              title="Sessions could not be loaded"
              description="The API did not respond. Try reloading in a moment."
            />
          )}

          <p className="mt-05 text-helper-01 text-content-tertiary">
            Do not recognise a session? End it, then change your password — changing it signs out every other
            device.
          </p>
        </div>
      </div>
    </>
  );
}
