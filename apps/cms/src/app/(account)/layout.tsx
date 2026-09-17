import { headers } from 'next/headers';
import { redirect } from 'next/navigation';

import { Header } from '@/components/shell/Header';
import { Sidebar } from '@/components/shell/Sidebar';
import { getSession } from '@/lib/api';

/**
 * Account screens.
 *
 * Deliberately outside the main application shell, because an account that must
 * change its password is redirected here by that shell — sharing its layout
 * would be a redirect loop.
 *
 * Someone in that state gets a stripped frame with no navigation at all: they
 * have exactly one thing to do, and offering links they cannot follow only
 * invites them to try. Everyone else gets the ordinary shell, because settings
 * are part of the tool rather than a detour out of it.
 */
export default async function AccountLayout({ children }: { children: React.ReactNode }) {
  const cookie = (await headers()).get('cookie') ?? undefined;
  const session = await getSession(cookie);

  if (!session) redirect('/sign-in');

  if (session.user.mustChangePassword) {
    return (
      <>
        <div className="fixed inset-x-0 top-0 z-header flex h-header items-center bg-gray-100 px-05">
          <span className="text-heading-compact font-semibold text-content-inverse">Cheezious</span>
          <span className="ms-02 text-label-01 uppercase tracking-wide text-gray-40">CMS</span>
          <span className="ms-auto truncate text-helper-01 text-gray-40">{session.user.email}</span>
        </div>

        <main id="cms-main" tabIndex={-1} className="pt-header focus:outline-none">
          {children}
        </main>
      </>
    );
  }

  return (
    <>
      <Header user={session.user} unreadNotifications={session.unreadNotifications} />
      <Sidebar permissions={session.user.permissions} isActive={session.user.isActive} badges={{}} />

      <div className="pt-header lg:ps-sidebar">
        <main id="cms-main" tabIndex={-1} className="min-h-[calc(100vh-theme(spacing.header))] focus:outline-none">
          {children}
        </main>
      </div>
    </>
  );
}
