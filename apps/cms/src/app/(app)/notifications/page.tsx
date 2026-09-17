import { headers } from 'next/headers';

import { NotificationList, type NotificationRow } from '@/components/shell/NotificationList';
import { ErrorState, PageHeader } from '@/components/ui';
import { cmsFetch } from '@/lib/api';

export const dynamic = 'force-dynamic';

export const metadata = { title: 'Notifications' };

export default async function NotificationsPage() {
  const cookie = (await headers()).get('cookie') ?? undefined;

  const data = await cmsFetch<{ notifications: NotificationRow[]; unread: number }>(
    '/api/cms/system/notifications',
    {
      cookie,
    },
  ).catch(() => null);

  return (
    <>
      <PageHeader title="Notifications" description="Workflow activity addressed to you." />

      <div className="p-06">
        <div className="panel max-w-3xl">
          {data ? (
            <NotificationList notifications={data.notifications} />
          ) : (
            <div className="p-05">
              <ErrorState
                title="Notifications could not be loaded"
                description="The API did not respond. Try reloading in a moment."
              />
            </div>
          )}
        </div>
      </div>
    </>
  );
}
