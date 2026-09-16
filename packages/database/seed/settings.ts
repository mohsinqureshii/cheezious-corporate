import { DEMO_CONTENT_NOTICE, LOCALE_META, LOCALES } from '@cheezious/config';
import type { PrismaClient } from '@prisma/client';

/**
 * Locales, site settings and the corporate boilerplate.
 *
 * The boilerplate lives here rather than in code so PR can update the approved
 * company description in one place and have it propagate to every press release,
 * fact sheet and Organization structured-data block.
 *
 * Seeded copy is placeholder text, clearly marked. It describes the *shape* of
 * an approved corporate description without asserting anything about Cheezious.
 */
export async function seedSettings(prisma: PrismaClient): Promise<void> {
  for (const [index, code] of LOCALES.entries()) {
    const meta = LOCALE_META[code];
    await prisma.localeConfig.upsert({
      where: { code },
      create: {
        code,
        label: meta.label,
        nativeLabel: meta.nativeLabel,
        direction: meta.dir,
        isDefault: code === 'en',
        isEnabled: true,
        sortOrder: index,
      },
      update: { label: meta.label, nativeLabel: meta.nativeLabel, direction: meta.dir },
    });
  }

  const settings: Array<{
    key: string;
    group: string;
    label: string;
    description?: string;
    values: Record<'en' | 'ur', unknown>;
  }> = [
    {
      key: 'site.name',
      group: 'public',
      label: 'Site name',
      description: 'Used in the browser title and in structured data.',
      values: { en: 'Cheezious Corporate', ur: 'چیزیس کارپوریٹ' },
    },
    {
      key: 'site.tagline',
      group: 'public',
      label: 'Corporate tagline',
      description: 'Shown in the footer and as a default social description.',
      values: {
        en: 'The company behind the restaurants.',
        ur: 'ریستورانوں کے پیچھے کمپنی۔',
      },
    },
    {
      key: 'site.defaultDescription',
      group: 'seo',
      label: 'Default meta description',
      description: 'Used when a page has no description of its own.',
      values: {
        en: 'Corporate information about Cheezious: our company, business, people, growth, quality systems and community work.',
        ur: 'چیزیس کے بارے میں کارپوریٹ معلومات: ہماری کمپنی، کاروبار، لوگ، ترقی، معیار کے نظام اور کمیونٹی کا کام۔',
      },
    },
    {
      key: 'boilerplate.short',
      group: 'boilerplate',
      label: 'Boilerplate — short',
      description: `One sentence, for use at the end of a press release. ${DEMO_CONTENT_NOTICE}`,
      values: {
        en: '[PLACEHOLDER] Cheezious is a Pakistani food company. Replace this with the approved one-sentence corporate description.',
        ur: '[پلیس ہولڈر] چیزیس ایک پاکستانی فوڈ کمپنی ہے۔ منظور شدہ ایک جملے کی کارپوریٹ تفصیل سے تبدیل کریں۔',
      },
    },
    {
      key: 'boilerplate.standard',
      group: 'boilerplate',
      label: 'Boilerplate — standard',
      description: `The paragraph appended to press releases. ${DEMO_CONTENT_NOTICE}`,
      values: {
        en: '[PLACEHOLDER] Replace this paragraph with the approved corporate boilerplate. It should describe what the company does, where it operates and what it is building, in two or three sentences, using only figures that have been approved for publication.',
        ur: '[پلیس ہولڈر] اس پیراگراف کو منظور شدہ کارپوریٹ بوائلر پلیٹ سے تبدیل کریں۔',
      },
    },
    {
      key: 'boilerplate.long',
      group: 'boilerplate',
      label: 'Boilerplate — long',
      description: `The extended description used in the media centre and fact sheet. ${DEMO_CONTENT_NOTICE}`,
      values: {
        en: '[PLACEHOLDER] Replace this with the approved long-form corporate description used in the media centre and company profile. Include only verified information about the company, its operations and its footprint.',
        ur: '[پلیس ہولڈر] میڈیا سینٹر اور کمپنی پروفائل میں استعمال ہونے والی منظور شدہ تفصیل سے تبدیل کریں۔',
      },
    },
    {
      key: 'contact.mediaEmail',
      group: 'public',
      label: 'Media contact email',
      values: { en: 'press@example.com', ur: 'press@example.com' },
    },
    {
      key: 'contact.corporateEmail',
      group: 'public',
      label: 'Corporate contact email',
      values: { en: 'corporate@example.com', ur: 'corporate@example.com' },
    },
    {
      key: 'social.links',
      group: 'social',
      label: 'Social profiles',
      description: 'Rendered in the footer and emitted as Organization sameAs.',
      values: {
        en: [
          { platform: 'linkedin', label: 'LinkedIn', url: 'https://www.linkedin.com/' },
          { platform: 'instagram', label: 'Instagram', url: 'https://www.instagram.com/' },
          { platform: 'facebook', label: 'Facebook', url: 'https://www.facebook.com/' },
          { platform: 'youtube', label: 'YouTube', url: 'https://www.youtube.com/' },
        ],
        ur: [
          { platform: 'linkedin', label: 'لنکڈاِن', url: 'https://www.linkedin.com/' },
          { platform: 'instagram', label: 'انسٹاگرام', url: 'https://www.instagram.com/' },
        ],
      },
    },
    {
      key: 'consumer.orderUrl',
      group: 'public',
      label: 'Consumer ordering site',
      description: 'The "Order Cheezious" link leaves the corporate experience for this URL.',
      values: { en: 'https://cheezious.com', ur: 'https://cheezious.com' },
    },
    {
      key: 'demo.showPlaceholderBadges',
      group: 'public',
      label: 'Show placeholder badges',
      description:
        'While on, any statistic or milestone marked as demo content is visibly labelled on the public site. Turn this off only once real data has replaced it.',
      values: { en: true, ur: true },
    },
  ];

  for (const setting of settings) {
    for (const locale of LOCALES) {
      await prisma.siteSetting.upsert({
        where: { key_locale: { key: setting.key, locale } },
        create: {
          key: setting.key,
          locale,
          group: setting.group,
          label: setting.label,
          description: setting.description ?? null,
          value: setting.values[locale] as never,
        },
        update: { label: setting.label, description: setting.description ?? null, group: setting.group },
      });
    }
  }

  const globals: Array<{ key: string; label: string; description: string; value: unknown; group: string }> = [
    {
      key: 'organisation.legalName',
      label: 'Legal entity name',
      description: 'Used in Organization structured data. Replace with the registered legal name.',
      value: '[PLACEHOLDER] Cheezious',
      group: 'organisation',
    },
    {
      key: 'seo.defaultOgImageId',
      label: 'Default social sharing image',
      description: 'Used when a page has no image of its own.',
      value: null,
      group: 'seo',
    },
    {
      key: 'content.reviewIntervalDays',
      label: 'Default content review interval (days)',
      description: 'Pages past their review date are flagged in content health.',
      value: 365,
      group: 'content',
    },
    {
      key: 'privacy.applicationRetentionDays',
      label: 'Job application retention (days)',
      description: 'Applications become eligible for deletion after this period.',
      value: 365,
      group: 'privacy',
    },
    {
      key: 'privacy.submissionRetentionDays',
      label: 'Supplier and property submission retention (days)',
      value: 730,
      group: 'privacy',
    },
  ];

  for (const setting of globals) {
    await prisma.globalSetting.upsert({
      where: { key: setting.key },
      create: { ...setting, value: setting.value as never },
      update: { label: setting.label, description: setting.description, group: setting.group },
    });
  }

  const flags: Array<{ key: string; label: string; description: string; enabled: boolean }> = [
    { key: 'search.enabled', label: 'Corporate search', description: 'Public search across the corporate site.', enabled: true },
    { key: 'locale.urdu', label: 'Urdu site', description: 'Serve the Urdu locale publicly.', enabled: true },
    { key: 'careers.applications', label: 'Online applications', description: 'Accept job applications through the site.', enabled: true },
    { key: 'newsroom.mediaCentre', label: 'Media centre', description: 'Public downloads of press and brand assets.', enabled: true },
    { key: 'impact.progressBars', label: 'Impact progress', description: 'Show progress against published impact targets.', enabled: true },
  ];

  for (const flag of flags) {
    await prisma.featureFlag.upsert({
      where: { key: flag.key },
      create: flag,
      update: { label: flag.label, description: flag.description },
    });
  }

  for (const locale of LOCALES) {
    await prisma.footerConfiguration.upsert({
      where: { locale },
      create: {
        locale,
        copyrightTemplate: locale === 'en' ? 'Cheezious © {year}' : 'چیزیس © {year}',
        regionLabel: locale === 'en' ? 'Pakistan' : 'پاکستان',
        socialLinks: [],
        legalLinks: [
          { label: locale === 'en' ? 'Privacy' : 'رازداری', path: '/company/governance/privacy' },
          { label: locale === 'en' ? 'Terms' : 'شرائط', path: '/company/governance/terms' },
          { label: locale === 'en' ? 'Accessibility' : 'رسائی', path: '/company/governance/accessibility' },
          { label: locale === 'en' ? 'Cookies' : 'کوکیز', path: '/company/governance/cookies' },
        ],
      },
      update: {},
    });
  }
}
