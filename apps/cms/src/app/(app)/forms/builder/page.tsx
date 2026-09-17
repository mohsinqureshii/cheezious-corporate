import { EmptyState, ErrorState, PageHeader } from '@/components/ui';
import { cmsFetch } from '@/lib/api';
import { requireUsableSession } from '@/lib/session';

/**
 * Forms.
 *
 * The definitions behind the public forms and their fields. Editing a live
 * form's fields changes what is collected from the next person who fills it in,
 * so this screen shows the shape and where each form is used before it offers
 * to change anything.
 */

export const dynamic = 'force-dynamic';

export const metadata = { title: 'Forms' };

interface FormsResponse {
  forms: Array<{
    id: string;
    key: string;
    name: string;
    description: string | null;
    isEnabled: boolean;
    successMessage: string | null;
    fields: Array<{
      id: string;
      name: string;
      label: string;
      type: string;
      isRequired: boolean;
      helpText: string | null;
      sortOrder: number;
    }>;
    _count: { submissions: number };
  }>;
}

export default async function FormsPage() {
  const { cookie } = await requireUsableSession();

  const data = await cmsFetch<FormsResponse>('/api/cms/structure/forms', { cookie }).catch(
    () => null,
  );

  if (!data) {
    return (
      <>
        <PageHeader title="Forms" />
        <div className="p-06">
          <ErrorState title="Forms could not be loaded" description="This section is restricted." />
        </div>
      </>
    );
  }

  return (
    <>
      <PageHeader
        title="Forms"
        description="What each form collects, and how much of it has arrived."
      />

      <div className="space-y-06 p-06">
        {data.forms.length === 0 ? (
          <EmptyState
            title="No forms yet"
            description="The supplier, property, partnership and contact forms are built into the site; custom forms appear here."
          />
        ) : (
          data.forms.map((form) => (
            <section key={form.id} className="panel p-06">
              <div className="flex flex-wrap items-start justify-between gap-04">
                <div>
                  <h2 className="text-heading-compact text-content-primary">{form.name}</h2>
                  <p className="mt-01 font-mono text-helper-01 text-content-tertiary">{form.key}</p>
                  {form.description ? (
                    <p className="mt-02 max-w-2xl text-body-01 text-content-secondary">
                      {form.description}
                    </p>
                  ) : null}
                </div>

                <div className="text-end">
                  <span
                    className={[
                      'tag',
                      form.isEnabled
                        ? 'bg-status-successSubtle text-content-primary'
                        : 'bg-gray-20 text-content-primary',
                    ].join(' ')}
                  >
                    {form.isEnabled ? 'Accepting submissions' : 'Closed'}
                  </span>
                  <p className="mt-02 text-helper-01 text-content-secondary">
                    {form._count.submissions} submission{form._count.submissions === 1 ? '' : 's'}
                  </p>
                </div>
              </div>

              <table className="data-table mt-05">
                <caption className="sr-only">Fields on {form.name}</caption>
                <thead>
                  <tr>
                    <th scope="col">Label</th>
                    <th scope="col">Name</th>
                    <th scope="col">Type</th>
                    <th scope="col">Required</th>
                  </tr>
                </thead>
                <tbody>
                  {form.fields.map((field) => (
                    <tr key={field.id}>
                      <td>
                        <span className="text-content-primary">{field.label}</span>
                        {field.helpText ? (
                          <span className="block text-helper-01 text-content-tertiary">
                            {field.helpText}
                          </span>
                        ) : null}
                      </td>
                      <td className="font-mono text-helper-01 text-content-secondary">
                        {field.name}
                      </td>
                      <td className="text-content-secondary">
                        {field.type.toLowerCase().replace(/_/g, ' ')}
                      </td>
                      <td className="text-content-secondary">{field.isRequired ? 'Yes' : 'No'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          ))
        )}
      </div>
    </>
  );
}
