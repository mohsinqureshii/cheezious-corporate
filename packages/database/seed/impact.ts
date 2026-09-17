import type { PrismaClient } from '@prisma/client';

/**
 * Impact pillars and metrics, reports and policies.
 *
 * Impact metrics are seeded as *structures* — a name, a unit, a methodology
 * field and a target field — with `isPublishable: false` and no values. Nothing
 * appears on the public site until someone enters an approved figure, which is
 * exactly the behaviour a corporate impact section needs: the platform must not
 * be capable of inventing a meals-donated number.
 */
export async function seedImpactAndPublications(
  prisma: PrismaClient,
  actorId: string,
): Promise<void> {
  const pillars = [
    {
      key: 'PEOPLE',
      name: 'People',
      summary: 'Jobs, training and progression for the people who work here.',
      icon: 'Users',
      metrics: [
        { key: 'jobs_created', name: 'Jobs created', unit: 'roles' },
        { key: 'training_hours', name: 'Training hours delivered', unit: 'hours' },
        { key: 'internal_promotions', name: 'Internal promotions', unit: 'people' },
      ],
    },
    {
      key: 'COMMUNITIES',
      name: 'Communities',
      summary: 'Working with the cities and neighbourhoods we operate in.',
      icon: 'HeartHandshake',
      metrics: [
        { key: 'community_initiatives', name: 'Community initiatives', unit: 'initiatives' },
        { key: 'cities_reached', name: 'Cities reached', unit: 'cities' },
      ],
    },
    {
      key: 'FOOD',
      name: 'Food',
      summary: 'Food quality, safety and responsible sourcing.',
      icon: 'Wheat',
      metrics: [
        { key: 'local_sourcing', name: 'Locally sourced inputs', unit: '%' },
        { key: 'supplier_audits', name: 'Supplier audits completed', unit: 'audits' },
      ],
    },
    {
      key: 'PLANET',
      name: 'Planet',
      summary: 'Packaging, waste, energy and water.',
      icon: 'Leaf',
      metrics: [
        { key: 'packaging_recyclable', name: 'Recyclable packaging', unit: '%' },
        { key: 'waste_diverted', name: 'Waste diverted from landfill', unit: '%' },
        { key: 'energy_intensity', name: 'Energy intensity per restaurant', unit: 'kWh' },
      ],
    },
  ];

  for (const [index, pillar] of pillars.entries()) {
    const created = await prisma.impactPillar.upsert({
      where: { locale_slug: { locale: 'en', slug: slugify(pillar.name) } },
      create: {
        translationGroupId: `pillar-${pillar.key}`,
        locale: 'en',
        key: pillar.key,
        name: pillar.name,
        slug: slugify(pillar.name),
        summary: pillar.summary,
        description:
          'Placeholder pillar description. Replace with approved copy describing what this pillar covers and how progress is measured.',
        icon: pillar.icon,
        sortOrder: index,
        isPublished: true,
      },
      update: { summary: pillar.summary, icon: pillar.icon, sortOrder: index },
      select: { id: true },
    });

    for (const [metricIndex, metric] of pillar.metrics.entries()) {
      await prisma.impactMetric.upsert({
        where: { pillarId_key: { pillarId: created.id, key: metric.key } },
        create: {
          pillarId: created.id,
          key: metric.key,
          name: metric.name,
          unit: metric.unit,
          suffix: metric.unit === '%' ? '%' : null,
          description:
            'Placeholder description. Replace with an approved definition of this metric.',
          methodology:
            'Methodology not yet documented. A metric cannot be published until its methodology is recorded here.',
          // Deliberately false and value-less: publishing requires a human to
          // enter an approved figure and mark the metric publishable.
          isPublishable: false,
          sortOrder: metricIndex,
        },
        update: { name: metric.name, unit: metric.unit, sortOrder: metricIndex },
      });
    }
  }

  const peoplePillar = await prisma.impactPillar.findFirst({
    where: { key: 'PEOPLE', locale: 'en' },
  });
  if (peoplePillar) {
    await prisma.impactStory.upsert({
      where: { locale_slug: { locale: 'en', slug: 'community-programme-placeholder' } },
      create: {
        translationGroupId: 'impact-story-1',
        locale: 'en',
        pillarId: peoplePillar.id,
        title: '[Placeholder] Community programme',
        slug: 'community-programme-placeholder',
        excerpt: 'Placeholder impact story demonstrating the impact story template.',
        body: '<p>Placeholder impact story. Replace with an approved account of a real programme.</p>',
        year: 2025,
        isFeatured: true,
        isPublished: true,
        isDemoContent: true,
        publishedAt: new Date(),
      },
      update: {},
    });
  }

  // --- Reports ---------------------------------------------------------------
  const reportCategories = [
    { key: 'CORPORATE', name: 'Corporate', summary: 'Company profile and fact sheets.' },
    { key: 'IMPACT', name: 'Impact', summary: 'Impact and community reporting.' },
    { key: 'QUALITY', name: 'Food & Quality', summary: 'Food safety and quality publications.' },
    { key: 'GOVERNANCE', name: 'Governance', summary: 'Codes, policies and governance documents.' },
  ];

  for (const [index, category] of reportCategories.entries()) {
    await prisma.reportCategory.upsert({
      where: { key: category.key },
      create: {
        key: category.key,
        name: category.name,
        slug: slugify(category.name),
        summary: category.summary,
        sortOrder: index,
      },
      update: { name: category.name, sortOrder: index },
    });
  }

  const corporateReports = await prisma.reportCategory.findUniqueOrThrow({
    where: { key: 'CORPORATE' },
  });
  const impactReports = await prisma.reportCategory.findUniqueOrThrow({ where: { key: 'IMPACT' } });

  const reports = [
    {
      slug: 'company-profile-placeholder',
      title: '[Placeholder] Company Profile',
      type: 'COMPANY_PROFILE',
      year: 2026,
      categoryId: corporateReports.id,
    },
    {
      slug: 'fact-sheet-placeholder',
      title: '[Placeholder] Corporate Fact Sheet',
      type: 'FACT_SHEET',
      year: 2026,
      categoryId: corporateReports.id,
    },
    {
      slug: 'impact-report-2025-placeholder',
      title: '[Placeholder] Impact Report 2025',
      type: 'IMPACT_REPORT',
      year: 2025,
      categoryId: impactReports.id,
    },
  ];

  for (const [index, report] of reports.entries()) {
    await prisma.report.upsert({
      where: { locale_slug: { locale: 'en', slug: report.slug } },
      create: {
        translationGroupId: `report-${report.slug}`,
        locale: 'en',
        title: report.title,
        slug: report.slug,
        year: report.year,
        type: report.type as never,
        description:
          'Placeholder publication. Upload the approved document and replace this description before publishing.',
        categoryId: report.categoryId,
        publicationDate: new Date(Date.UTC(report.year, 0, 15)),
        isFeatured: index === 0,
        isPublished: true,
        isDemoContent: true,
        sortOrder: index,
      },
      update: {},
    });
  }

  // --- Policies --------------------------------------------------------------
  const policyCategories = [
    { key: 'GOVERNANCE', name: 'Governance', summary: 'How the company is run.' },
    { key: 'WORKPLACE', name: 'Workplace', summary: 'Standards for the working environment.' },
    { key: 'SUPPLIERS', name: 'Suppliers', summary: 'What we expect from suppliers.' },
    { key: 'PRIVACY', name: 'Privacy & Security', summary: 'How information is handled.' },
  ];

  for (const [index, category] of policyCategories.entries()) {
    await prisma.policyCategory.upsert({
      where: { key: category.key },
      create: {
        key: category.key,
        name: category.name,
        slug: slugify(category.name),
        summary: category.summary,
        sortOrder: index,
      },
      update: { name: category.name, sortOrder: index },
    });
  }

  const governance = await prisma.policyCategory.findUniqueOrThrow({
    where: { key: 'GOVERNANCE' },
  });
  const suppliers = await prisma.policyCategory.findUniqueOrThrow({ where: { key: 'SUPPLIERS' } });
  const privacy = await prisma.policyCategory.findUniqueOrThrow({ where: { key: 'PRIVACY' } });

  /**
   * Policies are seeded as DRAFT, not PUBLISHED.
   *
   * A code of conduct or privacy policy is a legal statement. The platform
   * provides the structure; publishing text that has not been approved by the
   * company would be worse than having no policy page at all.
   */
  const policies = [
    { slug: 'code-of-conduct', title: 'Code of Conduct', categoryId: governance.id },
    {
      slug: 'supplier-code-of-conduct',
      title: 'Supplier Code of Conduct',
      categoryId: suppliers.id,
    },
    { slug: 'privacy-policy', title: 'Privacy Policy', categoryId: privacy.id },
    {
      slug: 'information-security-policy',
      title: 'Information Security Policy',
      categoryId: privacy.id,
    },
    { slug: 'speak-up-policy', title: 'Speak Up Policy', categoryId: governance.id },
  ];

  for (const policy of policies) {
    await prisma.policy.upsert({
      where: { locale_slug: { locale: 'en', slug: policy.slug } },
      create: {
        translationGroupId: `policy-${policy.slug}`,
        locale: 'en',
        title: policy.title,
        slug: policy.slug,
        summary: 'Awaiting approved content. This policy is not published.',
        body:
          '<p><strong>This policy has not been published.</strong> The structure exists so that Legal and ' +
          'Corporate Communications can enter the approved text, attach the signed document and publish it ' +
          'through the CMS.</p><p>Do not publish policy text that has not been approved by the company.</p>',
        categoryId: policy.categoryId,
        version: '0.1',
        status: 'DRAFT',
        isDemoContent: true,
        createdById: actorId,
      },
      update: {},
    });
  }
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}
