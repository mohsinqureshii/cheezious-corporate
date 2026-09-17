import { formatDate } from '@cheezious/utilities';
import Link from 'next/link';

import { ProfileForm } from '@/components/account/ProfileForm';
import { PageHeader } from '@/components/ui';
import { requireUsableSession } from '@/lib/session';

/**
 * Account settings.
 *
 * Shows a person what the system believes about them — who they are, what they
 * are allowed to do, and when they last signed in — and lets them change only
 * the part that is theirs to change.
 *
 * The permission list is deliberately visible rather than hidden behind an
 * administrator: someone who can see exactly what they hold can tell when it is
 * wrong, and ask.
 */

export const dynamic = 'force-dynamic';

export const metadata = { title: 'Account' };

export default async function AccountPage() {
  const { session } = await requireUsableSession();
  const { user } = session;

  return (
    <>
      <PageHeader title="Account" description="Your profile, roles and access." />

      <div className="grid gap-06 p-06 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="panel p-06">
          <h2 className="text-heading-compact text-content-primary">Profile</h2>
          <p className="mt-01 text-body-01 text-content-secondary">
            How your name appears throughout the CMS.
          </p>

          <div className="mt-05 max-w-md">
            <ProfileForm name={user.name} jobTitle={user.jobTitle} />
          </div>
        </div>

        <div className="space-y-06">
          <div className="panel p-06">
            <h2 className="text-heading-compact text-content-primary">Sign-in</h2>
            <dl className="mt-04 space-y-04">
              <div>
                <dt className="text-label-01 uppercase tracking-wide text-content-tertiary">Email address</dt>
                <dd className="mt-01 break-all text-body-01 text-content-primary">{user.email}</dd>
                <p className="mt-01 text-helper-01 text-content-tertiary">
                  Changing this is an administrative action. Ask an administrator.
                </p>
              </div>
              <div>
                <dt className="text-label-01 uppercase tracking-wide text-content-tertiary">Last signed in</dt>
                <dd className="mt-01 text-body-01 text-content-primary">
                  {user.lastLoginAt
                    ? formatDate(user.lastLoginAt, 'en', { dateStyle: 'medium', timeStyle: 'short' })
                    : 'This is your first session.'}
                </dd>
              </div>
            </dl>

            <div className="mt-05 flex flex-wrap gap-03">
              <Link href="/account/change-password" className="btn-secondary no-underline">
                Change password
              </Link>
              <Link href="/account/sessions" className="btn-ghost no-underline">
                Active sessions
              </Link>
            </div>
          </div>

          <div className="panel p-06">
            <h2 className="text-heading-compact text-content-primary">Access</h2>

            <p className="mt-04 text-label-01 uppercase tracking-wide text-content-tertiary">Roles</p>
            {user.roles.length > 0 ? (
              <ul className="mt-02 flex flex-wrap gap-02">
                {user.roles.map((role) => (
                  <li key={role} className="tag">
                    {humanize(role)}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-02 text-body-01 text-content-secondary">No roles assigned.</p>
            )}

            <details className="mt-05">
              <summary className="cursor-pointer text-body-compact text-content-primary">
                {user.permissions.length} permission{user.permissions.length === 1 ? '' : 's'}
              </summary>
              <ul className="mt-03 grid gap-01">
                {[...user.permissions].sort().map((permission) => (
                  <li key={permission} className="font-mono text-helper-01 text-content-secondary">
                    {permission}
                  </li>
                ))}
              </ul>
            </details>
          </div>
        </div>
      </div>
    </>
  );
}

function humanize(value: string): string {
  return value
    .toLowerCase()
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}
