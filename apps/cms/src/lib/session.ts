import { headers } from 'next/headers';
import { redirect } from 'next/navigation';

import { getSession, type SessionResponse } from '@/lib/api';

/**
 * Session guards for server components.
 *
 * Every authenticated screen resolves the session server-side on each request,
 * so an account disabled a minute ago stops working on its next navigation
 * rather than at the end of its cookie's life.
 *
 * `requireSession` is the weaker of the two: it only insists that someone is
 * signed in, and is what the forced password-change screen uses, since that
 * screen exists precisely for an account that cannot yet go anywhere else.
 * `requireUsableSession` additionally sends an account owing a password change
 * back to that screen — the guard belongs here rather than in a layout because
 * a layout cannot see which route it is wrapping, and the change-password page
 * shares this one.
 */

/** The current cookie header, forwarded so the API sees the signed-in user. */
export async function sessionCookie(): Promise<string | undefined> {
  return (await headers()).get('cookie') ?? undefined;
}

export async function requireSession(): Promise<{ session: SessionResponse; cookie?: string }> {
  const cookie = await sessionCookie();
  const session = await getSession(cookie);
  if (!session) redirect('/sign-in');
  return { session, cookie };
}

export async function requireUsableSession(): Promise<{
  session: SessionResponse;
  cookie?: string;
}> {
  const { session, cookie } = await requireSession();
  if (session.user.mustChangePassword) redirect('/account/change-password');
  return { session, cookie };
}
