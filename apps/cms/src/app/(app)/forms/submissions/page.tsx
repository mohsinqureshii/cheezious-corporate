import { formatDate } from '@cheezious/utilities';

import { EmptyState, ErrorState, PageHeader, StatusTag } from '@/components/ui';
import { cmsFetch } from '@/lib/api';
import { requireUsableSession } from '@/lib/session';
import type { ListMeta } from '@/lib/types';

/**
 * Custom form submissions.
 *
 * The list carries a reference, a form and a time — and nothing else. A custom
 * form can collect anything, so the only safe assumption is that it collected
 * personal data, and the list of them is not the place to display it.
 */

export const dynamic = 'force-dynamic';

export const metadata = { title: 'Form submissions' };

interface SubmissionsResponse {
  items: Array<{
    id: string;
    reference: string;
    status: string;
    createdAt: string;
    form: { id: string; name: string } | null;
    _count: { files: number };
  }>;
  meta: ListMeta;
}

export default async function FormSubmissionsPage() {
  const { cookie } = await requireUsableSession();

  const data = await cmsFetch<SubmissionsResponse>('/api/cms/structure/forms/submissions', {
    cookie,
    searchParams: { pageSize: '50' },
  }).catch(() => null);

  if (!data) {
    return (
      <>
        <PageHeader title="Form submissions" />
        <div className="p-06">
          <ErrorState title="Submissions could not be loaded" description="This section is restricted." />
        </div>
      </>
    );
  }

  return (
    <>
      <PageHeader title="Form submissions" description="Everything received through a custom form." />

      <div className="p-06">
        <div className="panel">
          {data.items.length === 0 ? (
            <EmptyState
              title="Nothing yet"
              description="Submissions to custom forms appear here as they arrive."
            />
          ) : (
            <table className="data-table">
              <caption className="sr-only">Custom form submissions</caption>
              <thead>
                <tr>
                  <th scope="col">Reference</th>
                  <th scope="col">Form</th>
                  <th scope="col">Received</th>
                  <th scope="col">Files</th>
                  <th scope="col">Status</th>
                </tr>
              </thead>
              <tbody>
                {data.items.map((submission) => (
                  <tr key={submission.id}>
                    <td className="font-mono text-helper-01 text-content-secondary">{submission.reference}</td>
                    <td className="text-content-primary">{submission.form?.name ?? '—'}</td>
                    <td>
                      <time dateTime={submission.createdAt}>
                        {formatDate(submission.createdAt, 'en', { dateStyle: 'medium', timeStyle: 'short' })}
                      </time>
                    </td>
                    <td className="tabular text-content-secondary">{submission._count.files}</td>
                    <td>
                      <StatusTag status={submission.status} size="sm" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <p className="mt-04 max-w-2xl text-helper-01 text-content-tertiary">
          A custom form can collect anything, so its answers are treated as personal data and are not shown in
          this list.
        </p>
      </div>
    </>
  );
}
