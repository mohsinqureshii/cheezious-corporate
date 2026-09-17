import Link from 'next/link';

import { AuthShell } from '@/components/account/AuthShell';
import { ResetPasswordForm } from '@/components/account/ResetPasswordForm';

/**
 * Complete a password reset.
 *
 * The token arrives in the query string. It is read on the server and handed to
 * the form as a prop, so the page still renders without JavaScript and the
 * token never has to be re-parsed in the browser.
 */

export const dynamic = 'force-dynamic';

export const metadata = { title: 'Choose a new password' };

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const raw = params.token;
  const token = (Array.isArray(raw) ? raw[0] : raw) ?? '';

  if (!token) {
    return (
      <AuthShell
        title="That link is incomplete"
        description="The reset link is missing its token. Request a new one and use the most recent link."
      >
        <Link href="/forgot-password" className="btn-primary no-underline">
          Request a new link
        </Link>
      </AuthShell>
    );
  }

  return (
    <AuthShell title="Choose a new password" description="Set a password you do not use anywhere else.">
      <ResetPasswordForm token={token} />
    </AuthShell>
  );
}
