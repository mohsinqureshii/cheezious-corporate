import { headers } from 'next/headers';
import { redirect } from 'next/navigation';

import { Header } from '@/components/shell/Header';
import { Sidebar } from '@/components/shell/Sidebar';
import { cmsFetch, getSession } from '@/lib/api';

/**
 * Authenticated CMS shell.
 *
 * The session is resolved server-side on every request: an editor whose account
 * was disabled a minute ago is redirected to sign-in on their next navigation
 * rather than continuing to work against an API that will refuse them.
 *
 * Inbox counters are loaded here so the sidebar badges reflect what is actually
 * waiting, scoped by the permissions this user holds.
 */
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const cookie = (await headers()).get('cookie') ?? undefined;
  const session = await getSession(cookie);

  if (!session) redirect('/sign-in');

  // An account required to change its password can only reach that one screen.
  if (session.user.mustChangePassword) redirect('/account/change-password');

  const badges = await loadBadges(cookie);

  return (
    <>
      <Header user={session.user} unreadNotifications={session.unreadNotifications} />
      <Sidebar
        permissions={session.user.permissions}
        isActive={session.user.isActive}
        badges={badges}
      />

      <div className="pt-header lg:ps-sidebar">
        <main
          id="cms-main"
          tabIndex={-1}
          className="min-h-[calc(100vh-theme(spacing.header))] focus:outline-none"
        >
          {children}
        </main>
      </div>
    </>
  );
}

/** Sidebar counters. A failure here must not prevent the CMS from loading. */
async function loadBadges(cookie?: string): Promise<Record<string, number | null>> {
  try {
    const dashboard = await cmsFetch<{
      inbox: Record<string, number | null>;
      reviewQueue: { awaitingReview: unknown[]; awaitingApproval: unknown[] } | null;
      contentHealth: { totalIssues: number } | null;
    }>('/api/cms/dashboard', { cookie });

    return {
      applications: dashboard.inbox.applications ?? null,
      suppliers: dashboard.inbox.suppliers ?? null,
      properties: dashboard.inbox.properties ?? null,
      partnerships: dashboard.inbox.partnerships ?? null,
      contact: dashboard.inbox.contact ?? null,
      review: dashboard.reviewQueue
        ? dashboard.reviewQueue.awaitingReview.length +
          dashboard.reviewQueue.awaitingApproval.length
        : null,
      health: dashboard.contentHealth?.totalIssues ?? null,
    };
  } catch {
    return {};
  }
}
