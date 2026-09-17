import { UsersTable, type RoleOption, type UserRow } from '@/components/system/UsersTable';
import { ErrorState, PageHeader } from '@/components/ui';
import { cmsFetch } from '@/lib/api';
import { requireUsableSession } from '@/lib/session';
import type { ListMeta } from '@/lib/types';

/**
 * User administration.
 *
 * Who has an account, what they can do, and whether they still need it.
 */

export const dynamic = 'force-dynamic';

export const metadata = { title: 'Users' };

export default async function UsersPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const { session, cookie } = await requireUsableSession();

  const query = {
    page: single(params.page) ?? '1',
    pageSize: '25',
    q: single(params.q),
    status: single(params.status),
    roleKey: single(params.roleKey),
  };

  const [users, roles] = await Promise.all([
    cmsFetch<{ items: UserRow[]; meta: ListMeta }>('/api/cms/system/users', { cookie, searchParams: query }).catch(
      () => null,
    ),
    cmsFetch<{ roles: RoleOption[] }>('/api/cms/system/roles', { cookie })
      .then((response) => response.roles)
      .catch(() => []),
  ]);

  if (!users) {
    return (
      <>
        <PageHeader title="Users" />
        <div className="p-06">
          <ErrorState
            title="Users could not be loaded"
            description="You may not have permission to see them, or the API is unavailable."
          />
        </div>
      </>
    );
  }

  return (
    <>
      <PageHeader title="Users" description="Everyone with access to the CMS, and what they can do." />
      <UsersTable
        rows={users.items}
        meta={users.meta}
        roles={roles}
        canManage={session.user.permissions.includes('users.manage')}
        initialQuery={{ q: query.q ?? '', status: query.status ?? '', roleKey: query.roleKey ?? '' }}
      />
    </>
  );
}

function single(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}
