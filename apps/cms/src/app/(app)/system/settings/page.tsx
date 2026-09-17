import {
  SettingsPanels,
  type FeatureFlag,
  type GlobalSetting,
  type SiteSetting,
} from '@/components/system/SettingsPanels';
import { ErrorState, PageHeader } from '@/components/ui';
import { cmsFetch } from '@/lib/api';
import { requireUsableSession } from '@/lib/session';

/**
 * Settings.
 *
 * Site text, platform values and operational switches.
 */

export const dynamic = 'force-dynamic';

export const metadata = { title: 'Settings' };

export default async function SettingsPage() {
  const { cookie } = await requireUsableSession();

  const data = await cmsFetch<{ site: SiteSetting[]; globals: GlobalSetting[]; flags: FeatureFlag[] }>(
    '/api/cms/system/settings',
    { cookie },
  ).catch(() => null);

  if (!data) {
    return (
      <>
        <PageHeader title="Settings" />
        <div className="p-06">
          <ErrorState
            title="Settings could not be loaded"
            description="Managing settings is restricted to administrators."
          />
        </div>
      </>
    );
  }

  return (
    <>
      <PageHeader title="Settings" description="How the platform and the public site are configured." />
      <SettingsPanels site={data.site} globals={data.globals} flags={data.flags} />
    </>
  );
}
