import { formatDate, formatRelativeTime } from '@cheezious/utilities';
import { headers } from 'next/headers';
import Link from 'next/link';

import { EmptyState, PageHeader, StatusTag } from '@/components/ui';
import { cmsFetch } from '@/lib/api';

/**
 * Job applications queue.
 *
 * The screen HR works in. Deliberately shows the minimum personal data needed
 * to triage — name, role, when it arrived, status — with everything else behind
 * the record, where opening it is audited.
 */

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Applications' };

interface ApplicationRow {
  id: string;
  reference: string;
  firstName: string;
  lastName: string;
  email: string;
  city: string | null;
  status: string;
  rating: number | null;
  createdAt: string;
  job: { id: string; title: string; slug: string } | null;
  assignee: { id: string; name: string } | null;
  _count: { files: number; notes: number };
}

interface ApplicationsResponse {
  items: ApplicationRow[];
  meta: { page: number; pageSize: number; total: number; totalPages: number };
  facets: { statuses: Array<{ value: string; count: number }> };
}

export default async function ApplicationsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const cookie = (await headers()).get('cookie') ?? undefined;

  const status = Array.isArray(params.status) ? params.status[0] : params.status;
  const query = Array.isArray(params.q) ? params.q[0] : params.q;

  const data = await cmsFetch<ApplicationsResponse>('/api/cms/submissions/applications', {
    cookie,
    searchParams: { status, q: query, pageSize: '25' },
  }).catch(() => null);

  if (!data) {
    return (
      <>
        <PageHeader title="Applications" />
        <div className="p-06">
          <div className="border-s-[3px] border-status-danger bg-status-dangerSubtle px-05 py-04" role="alert">
            <p className="text-heading-compact">Applications could not be loaded</p>
          </div>
        </div>
      </>
    );
  }

  const newCount = data.facets.statuses.find((facet) => facet.value === 'NEW')?.count ?? 0;

  return (
    <>
      <PageHeader
        title="Applications"
        description={
          newCount > 0
            ? `${newCount} new application${newCount === 1 ? '' : 's'} waiting to be reviewed.`
            : 'Every application received through the careers site.'
        }
        breadcrumb={[{ label: 'Careers', href: '/careers/jobs' }, { label: 'Applications' }]}
      />

      <div className="p-06">
        <div className="panel">
          <div className="flex flex-wrap items-center gap-03 border-b border-border-subtle px-05 py-03">
            <form className="flex items-center gap-02">
              <label htmlFor="applications-search" className="sr-only">
                Search applications
              </label>
              <input
                id="applications-search"
                name="q"
                type="search"
                defaultValue={query ?? ''}
                placeholder="Search by name, email or reference"
                className="input w-72"
              />
              {status ? <input type="hidden" name="status" value={status} /> : null}
              <button type="submit" className="btn-tertiary btn-sm">
                Search
              </button>
            </form>

            <nav className="flex flex-wrap items-center gap-02" aria-label="Filter by status">
              <Link
                href="/careers/applications"
                className={[
                  'tag no-underline',
                  !status ? 'bg-gray-80 text-content-inverse' : 'bg-gray-20 text-content-primary hover:bg-gray-30',
                ].join(' ')}
              >
                All
              </Link>
              {data.facets.statuses.map((facet) => (
                <Link
                  key={facet.value}
                  href={`/careers/applications?status=${facet.value}`}
                  className={[
                    'tag no-underline',
                    status === facet.value
                      ? 'bg-gray-80 text-content-inverse'
                      : 'bg-gray-20 text-content-primary hover:bg-gray-30',
                  ].join(' ')}
                >
                  {humanize(facet.value)} ({facet.count})
                </Link>
              ))}
            </nav>

            <span className="ms-auto text-body-compact text-content-secondary tabular">
              {data.meta.total} total
            </span>
          </div>

          {data.items.length === 0 ? (
            <EmptyState
              title={status || query ? 'No applications match' : 'No applications yet'}
              description={
                status || query
                  ? 'Try a different search or filter.'
                  : 'Applications submitted through the careers site appear here.'
              }
            />
          ) : (
            <div className="scrollbar-thin overflow-x-auto">
              <table className="data-table">
                <caption className="sr-only">Job applications</caption>
                <thead>
                  <tr>
                    <th scope="col">Candidate</th>
                    <th scope="col">Role</th>
                    <th scope="col">Reference</th>
                    <th scope="col">Received</th>
                    <th scope="col">Status</th>
                    <th scope="col">Assigned to</th>
                    <th scope="col" className="text-right">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {data.items.map((application) => (
                    <tr key={application.id}>
                      <td>
                        <Link
                          href={`/careers/applications/${application.id}`}
                          className="font-medium text-interactive no-underline hover:underline"
                        >
                          {application.firstName} {application.lastName}
                        </Link>
                        <span className="block text-helper-01 text-content-tertiary">
                          {application.city ?? '—'}
                        </span>
                      </td>
                      <td className="text-content-secondary">{application.job?.title ?? '—'}</td>
                      <td className="font-mono text-helper-01 text-content-secondary">{application.reference}</td>
                      <td>
                        <time dateTime={application.createdAt} title={formatDate(application.createdAt)}>
                          {formatRelativeTime(application.createdAt)}
                        </time>
                      </td>
                      <td>
                        <StatusTag status={application.status} size="sm" />
                      </td>
                      <td className="text-content-secondary">{application.assignee?.name ?? 'Unassigned'}</td>
                      <td className="text-right">
                        <Link
                          href={`/careers/applications/${application.id}`}
                          className="text-interactive no-underline hover:underline"
                        >
                          Review
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <p className="mt-04 text-helper-01 text-content-tertiary">
          Applications contain personal data. Access is restricted and every record opened is recorded in the
          audit log.
        </p>
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
