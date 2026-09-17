import { RoleMatrix, type PermissionGroup, type Role } from '@/components/system/RoleMatrix';
import { ErrorState, PageHeader } from '@/components/ui';
import { cmsFetch } from '@/lib/api';
import { requireUsableSession } from '@/lib/session';

/**
 * Roles and permissions.
 *
 * The answer to "who can publish", in one screen.
 */

export const dynamic = 'force-dynamic';

export const metadata = { title: 'Roles & permissions' };

export default async function RolesPage() {
  const { session, cookie } = await requireUsableSession();

  const data = await cmsFetch<{ roles: Role[]; catalogue: PermissionGroup[] }>(
    '/api/cms/system/roles',
    {
      cookie,
    },
  ).catch(() => null);

  if (!data) {
    return (
      <>
        <PageHeader title="Roles & permissions" />
        <div className="p-06">
          <ErrorState
            title="Roles could not be loaded"
            description="You may not have permission to see them, or the API is unavailable."
          />
        </div>
      </>
    );
  }

  return (
    <>
      <PageHeader
        title="Roles & permissions"
        description="What each role can do. The API enforces every one of these independently."
      />
      <RoleMatrix
        roles={data.roles}
        catalogue={data.catalogue}
        canManage={session.user.permissions.includes('roles.manage')}
      />
    </>
  );
}
