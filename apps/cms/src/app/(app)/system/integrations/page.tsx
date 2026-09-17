import { formatRelativeTime } from '@cheezious/utilities';

import { EmptyState, ErrorState, PageHeader } from '@/components/ui';
import { cmsFetch } from '@/lib/api';
import { requireUsableSession } from '@/lib/session';

/**
 * Integrations.
 *
 * Which external services are connected and whether they are working. Credentials
 * are never returned by the API and never shown here — the screen lists which
 * settings are configured, never their values, because a settings page is a
 * common place for a secret to end up in a screenshot.
 */

export const dynamic = 'force-dynamic';

export const metadata = { title: 'Integrations' };

interface IntegrationsResponse {
  integrations: Array<{
    id: string;
    key: string;
    name: string;
    provider: string;
    isEnabled: boolean;
    lastSyncAt: string | null;
    updatedAt: string;
    configuredKeys: string[];
    webhooks: Array<{
      id: string;
      name: string;
      url: string;
      events: string[];
      isEnabled: boolean;
      lastDeliveryAt: string | null;
      lastDeliveryStatus: number | null;
      failureCount: number;
    }>;
  }>;
}

export default async function IntegrationsPage() {
  const { cookie } = await requireUsableSession();

  const data = await cmsFetch<IntegrationsResponse>('/api/cms/structure/integrations', {
    cookie,
  }).catch(() => null);

  if (!data) {
    return (
      <>
        <PageHeader title="Integrations" />
        <div className="p-06">
          <ErrorState
            title="Integrations could not be loaded"
            description="This section is restricted."
          />
        </div>
      </>
    );
  }

  return (
    <>
      <PageHeader title="Integrations" description="External services this platform talks to." />

      <div className="space-y-06 p-06">
        {data.integrations.length === 0 ? (
          <EmptyState
            title="Nothing connected"
            description="Analytics, mail and search connectors appear here once they are configured."
          />
        ) : (
          data.integrations.map((integration) => (
            <section key={integration.id} className="panel p-06">
              <div className="flex flex-wrap items-start justify-between gap-04">
                <div>
                  <h2 className="text-heading-compact text-content-primary">{integration.name}</h2>
                  <p className="mt-01 text-helper-01 text-content-tertiary">
                    {integration.provider} · <span className="font-mono">{integration.key}</span>
                  </p>
                </div>
                <span
                  className={[
                    'tag',
                    integration.isEnabled
                      ? 'bg-status-successSubtle text-content-primary'
                      : 'bg-gray-20 text-content-primary',
                  ].join(' ')}
                >
                  {integration.isEnabled ? 'Enabled' : 'Disabled'}
                </span>
              </div>

              <dl className="mt-04 space-y-02 text-helper-01">
                <div className="flex gap-03">
                  <dt className="text-content-tertiary">Configured settings</dt>
                  <dd className="text-content-secondary">
                    {integration.configuredKeys.length > 0
                      ? integration.configuredKeys.join(', ')
                      : 'None'}
                  </dd>
                </div>
                <div className="flex gap-03">
                  <dt className="text-content-tertiary">Last sync</dt>
                  <dd className="text-content-secondary">
                    {integration.lastSyncAt ? formatRelativeTime(integration.lastSyncAt) : 'Never'}
                  </dd>
                </div>
              </dl>

              {integration.webhooks.length > 0 ? (
                <div className="mt-05 border-t border-border-subtle pt-04">
                  <h3 className="text-label-01 uppercase tracking-wide text-content-tertiary">
                    Webhooks
                  </h3>
                  <ul className="mt-02 space-y-02">
                    {integration.webhooks.map((webhook) => (
                      <li key={webhook.id}>
                        <p className="text-body-compact text-content-primary">{webhook.name}</p>
                        <p className="truncate font-mono text-helper-01 text-content-tertiary">
                          {webhook.url}
                        </p>
                        <p className="text-helper-01 text-content-secondary">
                          {webhook.events.join(', ') || 'No events'} ·{' '}
                          {webhook.lastDeliveryAt
                            ? `last ${formatRelativeTime(webhook.lastDeliveryAt)} (${webhook.lastDeliveryStatus ?? '—'})`
                            : 'never delivered'}
                          {webhook.failureCount > 0 ? ` · ${webhook.failureCount} failure(s)` : ''}
                        </p>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </section>
          ))
        )}

        <p className="max-w-2xl text-helper-01 text-content-tertiary">
          Credentials are held in the environment and are never returned by the API or shown on this
          screen.
        </p>
      </div>
    </>
  );
}
