import { ChangePasswordForm } from '@/components/account/ChangePasswordForm';
import { PageHeader } from '@/components/ui';
import { requireSession } from '@/lib/session';

/**
 * Change password.
 *
 * Reached two ways: from the account menu, and as the only screen an invited
 * account can open until it has replaced the temporary password it was issued.
 */

export const dynamic = 'force-dynamic';

export const metadata = { title: 'Change password' };

export default async function ChangePasswordPage() {
  const { session } = await requireSession();

  const forced = session.user.mustChangePassword;

  return (
    <>
      {forced ? null : (
        <PageHeader
          title="Change password"
          breadcrumb={[{ label: 'Account', href: '/account' }, { label: 'Change password' }]}
        />
      )}

      <div className="p-06">
        <div className="max-w-md">
          {forced ? (
            <div className="mb-06">
              <h1 className="text-heading-04 text-content-primary">Choose a new password</h1>
              <p className="mt-02 text-body-01 text-content-secondary">
                Your account was set up with a temporary password. Replace it to continue — the rest of the
                CMS opens once you have.
              </p>
            </div>
          ) : null}

          <ChangePasswordForm forced={forced} />
        </div>
      </div>
    </>
  );
}
