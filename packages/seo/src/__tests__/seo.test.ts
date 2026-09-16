import { describe, expect, it } from 'vitest';

import { absoluteUrl, assessSeoQuality, deriveDescription, resolveSeo, truncateForSeo } from '../metadata';
import { renderRobotsTxt, renderSitemap } from '../sitemap';
import {
  buildArticle,
  buildBreadcrumbList,
  buildFaqPage,
  buildJobPosting,
  buildOrganization,
  buildPerson,
  serializeJsonLd,
} from '../structured-data';

const context = {
  siteUrl: 'https://corporate.cheezious.com',
  path: '/en/company/leadership',
  locale: 'en' as const,
  alternates: { en: '/en/company/leadership', ur: '/ur/company/qiadat' },
  fallbackTitle: 'Leadership',
  fallbackDescription: 'The people responsible for running the company day to day.',
  siteName: 'Cheezious Corporate',
};

describe('SEO metadata', () => {
  it('builds a complete metadata set from editor overrides', () => {
    const seo = resolveSeo(
      { title: 'Our Leadership', description: 'Meet the leadership team.', ogImageUrl: 'https://cdn/og.jpg' },
      context,
    );
    expect(seo.title).toBe('Our Leadership');
    expect(seo.fullTitle).toBe('Our Leadership | Cheezious Corporate');
    expect(seo.canonical).toBe('https://corporate.cheezious.com/en/company/leadership');
    expect(seo.robots).toBe('index, follow');
    expect(seo.openGraph.images[0]?.width).toBe(1200);
  });

  it('falls back to derived values when the editor supplies nothing', () => {
    const seo = resolveSeo({}, context);
    expect(seo.title).toBe('Leadership');
    expect(seo.description).toBe('The people responsible for running the company day to day.');
    expect(seo.canonical).toContain('/en/company/leadership');
  });

  it('never produces an empty description', () => {
    const seo = resolveSeo({}, { ...context, fallbackDescription: undefined });
    expect(seo.description.length).toBeGreaterThan(0);
  });

  it('emits hreflang alternates for both locales plus x-default', () => {
    const seo = resolveSeo({}, context);
    expect(seo.alternates.languages['en-PK']).toBe('https://corporate.cheezious.com/en/company/leadership');
    expect(seo.alternates.languages['ur-PK']).toBe('https://corporate.cheezious.com/ur/company/qiadat');
    expect(seo.alternates.languages['x-default']).toBe('https://corporate.cheezious.com/en/company/leadership');
  });

  it('honours an editor noindex and a deployment-wide noindex', () => {
    expect(resolveSeo({ noindex: true }, context).robots).toBe('noindex, follow');
    expect(resolveSeo({}, { ...context, forceNoindex: true }).robots).toBe('noindex, follow');
    expect(resolveSeo({ nofollow: true }, context).robots).toBe('index, nofollow');
  });

  it('uses the Urdu OG locale for Urdu pages', () => {
    expect(resolveSeo({}, { ...context, locale: 'ur' }).openGraph.locale).toBe('ur_PK');
  });

  it('truncates on a word boundary rather than mid-word', () => {
    const source = 'The quick brown fox jumps over the lazy dog';
    const result = truncateForSeo(source, 20);

    expect(result.length).toBeLessThanOrEqual(20);
    expect(result.endsWith('…')).toBe(true);

    // Every word kept must be a whole word from the source, not a fragment.
    const words = source.split(' ');
    for (const word of result.replace(/…$/, '').trim().split(' ')) {
      expect(words, `"${word}" was cut mid-word`).toContain(word);
    }
  });

  it('returns text untouched when it already fits', () => {
    expect(truncateForSeo('Short enough', 40)).toBe('Short enough');
  });

  it('derives a description from HTML body copy', () => {
    const derived = deriveDescription('<p>Our <strong>supply chain</strong> moves food nationwide.</p>');
    expect(derived).toBe('Our supply chain moves food nationwide.');
  });

  it('builds absolute URLs without duplicate or trailing slashes', () => {
    expect(absoluteUrl('https://a.com/', '/b')).toBe('https://a.com/b');
    expect(absoluteUrl('https://a.com', 'b')).toBe('https://a.com/b');
    expect(absoluteUrl('https://a.com', '/')).toBe('https://a.com/');
    expect(absoluteUrl('https://a.com', '/b/')).toBe('https://a.com/b');
  });
});

describe('SEO quality assessment', () => {
  it('flags an over-long title and a missing social image', () => {
    const seo = resolveSeo({ title: 'A'.repeat(90), description: 'x'.repeat(100) }, context);
    const issues = assessSeoQuality(seo);
    expect(issues.some((i) => i.field === 'title')).toBe(true);
    expect(issues.some((i) => i.field === 'ogImage')).toBe(true);
  });

  it('flags a description that is too short or too long', () => {
    const short = assessSeoQuality(resolveSeo({ description: 'Too short.' }, context));
    expect(short.some((i) => i.field === 'description')).toBe(true);

    const long = assessSeoQuality(resolveSeo({ description: 'x'.repeat(180) }, context));
    expect(long.some((i) => i.field === 'description')).toBe(true);
  });

  it('passes a well-formed page', () => {
    const seo = resolveSeo(
      {
        title: 'Our Leadership Team',
        description:
          'Meet the people responsible for running Cheezious day to day, across restaurants, supply chain and technology.',
        ogImageUrl: 'https://cdn/og.jpg',
      },
      context,
    );
    expect(assessSeoQuality(seo)).toHaveLength(0);
  });
});

describe('structured data', () => {
  it('builds an Organization node', () => {
    const node = buildOrganization({
      name: 'Cheezious',
      url: 'https://corporate.cheezious.com',
      logoUrl: 'https://cdn/logo.png',
      sameAs: ['https://linkedin.com/company/x'],
    });
    expect(node['@type']).toBe('Organization');
    expect(node.sameAs).toEqual(['https://linkedin.com/company/x']);
  });

  it('omits an Article without a publication date', () => {
    expect(buildArticle({ headline: 'A', url: 'u', publisherName: 'C' })).toBeNull();
    expect(
      buildArticle({ headline: 'A', url: 'u', publisherName: 'C', publishedAt: '2026-01-01' }),
    ).not.toBeNull();
  });

  it('marks press releases as NewsArticle', () => {
    const node = buildArticle({
      headline: 'Expansion announced',
      url: 'u',
      publisherName: 'Cheezious',
      publishedAt: '2026-01-01',
      isNews: true,
    });
    expect(node?.['@type']).toBe('NewsArticle');
  });

  it('builds a Person node for a leadership profile', () => {
    const node = buildPerson({ name: 'A Person', url: 'u', jobTitle: 'CFO', organizationName: 'Cheezious' });
    expect(node?.jobTitle).toBe('CFO');
    expect(node?.worksFor).toMatchObject({ name: 'Cheezious' });
  });

  it('omits a breadcrumb with fewer than two levels', () => {
    expect(buildBreadcrumbList([{ name: 'Home', url: '/' }])).toBeNull();
    const node = buildBreadcrumbList([
      { name: 'Home', url: '/' },
      { name: 'Company', url: '/company' },
    ]);
    expect((node?.itemListElement as unknown[]).length).toBe(2);
  });

  it('strips HTML from FAQ answers', () => {
    const node = buildFaqPage([{ question: 'Q?', answer: '<p>An <b>answer</b>.</p>' }]);
    const entity = (node?.mainEntity as Array<Record<string, any>>)[0];
    expect(entity?.acceptedAnswer.text).toBe('An answer .');
  });

  it('escapes angle brackets when serialising JSON-LD', () => {
    const serialised = serializeJsonLd([{ name: '</script><script>alert(1)</script>' }]);
    expect(serialised).not.toContain('</script>');
    expect(serialised).toContain('\\u003c');
  });

  it('returns null when there is nothing to serialise', () => {
    expect(serializeJsonLd([null, undefined])).toBeNull();
  });
});

describe('JobPosting structured data', () => {
  const base = {
    title: 'Restaurant Manager',
    description: '<p>Run a restaurant.</p>',
    url: 'https://corporate.cheezious.com/en/careers/jobs/restaurant-manager',
    datePosted: '2026-01-10',
    organizationName: 'Cheezious',
    organizationUrl: 'https://corporate.cheezious.com',
  };

  it('builds a valid posting with the required fields', () => {
    const node = buildJobPosting(base);
    expect(node?.['@type']).toBe('JobPosting');
    expect(node?.title).toBe('Restaurant Manager');
    expect(node?.datePosted).toBe('2026-01-10T00:00:00.000Z');
    expect(node?.hiringOrganization).toMatchObject({ name: 'Cheezious' });
  });

  it('returns null when a Google-required field is missing', () => {
    expect(buildJobPosting({ ...base, datePosted: null })).toBeNull();
    expect(buildJobPosting({ ...base, title: '' })).toBeNull();
    expect(buildJobPosting({ ...base, description: '' })).toBeNull();
  });

  it('maps internal employment types to schema.org values', () => {
    expect(buildJobPosting({ ...base, employmentType: 'CONTRACT' })?.employmentType).toBe('CONTRACTOR');
    expect(buildJobPosting({ ...base, employmentType: 'INTERNSHIP' })?.employmentType).toBe('INTERN');
    expect(buildJobPosting({ ...base, employmentType: 'FULL_TIME' })?.employmentType).toBe('FULL_TIME');
  });

  it('uses applicantLocationRequirements for remote roles', () => {
    const node = buildJobPosting({ ...base, workplaceType: 'REMOTE' });
    expect(node?.jobLocationType).toBe('TELECOMMUTE');
    expect(node?.applicantLocationRequirements).toBeDefined();
  });

  it('uses jobLocation for on-site roles', () => {
    const node = buildJobPosting({ ...base, workplaceType: 'ON_SITE', locality: 'Islamabad', region: 'Islamabad Capital Territory' });
    expect(node?.jobLocation).toMatchObject({
      address: { addressLocality: 'Islamabad', addressCountry: 'PK' },
    });
    expect(node?.jobLocationType).toBeUndefined();
  });

  it('emits salary only when the range is complete and coherent', () => {
    expect(buildJobPosting({ ...base, salaryMin: 100000, salaryMax: 150000, salaryCurrency: 'PKR' })?.baseSalary).toBeDefined();
    expect(buildJobPosting({ ...base, salaryMin: 100000, salaryCurrency: 'PKR' })?.baseSalary).toBeUndefined();
    expect(buildJobPosting({ ...base, salaryMin: 150000, salaryMax: 100000, salaryCurrency: 'PKR' })?.baseSalary).toBeUndefined();
    expect(buildJobPosting({ ...base, salaryMin: 100000, salaryMax: 150000, salaryCurrency: null })?.baseSalary).toBeUndefined();
  });

  it('includes validThrough when there is an application deadline', () => {
    expect(buildJobPosting({ ...base, validThrough: '2026-03-01' })?.validThrough).toBe('2026-03-01T00:00:00.000Z');
  });
});

describe('sitemap and robots', () => {
  const siteUrl = 'https://corporate.cheezious.com';

  it('renders urls with lastmod, priority and hreflang alternates', () => {
    const xml = renderSitemap(
      [
        {
          path: '/en/company',
          locale: 'en',
          lastModified: '2026-01-01T00:00:00.000Z',
          changeFrequency: 'weekly',
          priority: 0.8,
          alternates: { en: '/en/company', ur: '/ur/company' },
        },
      ],
      siteUrl,
    );
    expect(xml).toContain('<loc>https://corporate.cheezious.com/en/company</loc>');
    expect(xml).toContain('<changefreq>weekly</changefreq>');
    expect(xml).toContain('<priority>0.8</priority>');
    expect(xml).toContain('hreflang="ur-PK"');
    expect(xml).toContain('hreflang="x-default"');
  });

  it('escapes XML special characters in URLs', () => {
    const xml = renderSitemap([{ path: '/en/search?q=a&b=c', locale: 'en' }], siteUrl);
    expect(xml).toContain('&amp;');
    expect(xml).not.toMatch(/q=a&b=c/);
  });

  it('disallows everything on a non-production deployment', () => {
    const robots = renderRobotsTxt({ siteUrl, disallowAll: true });
    expect(robots).toContain('Disallow: /');
    expect(robots).not.toContain('Sitemap:');
  });

  it('keeps preview and search URLs out of the index in production', () => {
    const robots = renderRobotsTxt({ siteUrl });
    expect(robots).toContain('Allow: /');
    expect(robots).toContain('Disallow: /api/');
    expect(robots).toContain('Disallow: /*/preview');
    expect(robots).toContain('Sitemap: https://corporate.cheezious.com/sitemap.xml');
  });
});
