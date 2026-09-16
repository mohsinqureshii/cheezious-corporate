import type { PrismaClient } from '@prisma/client';

/**
 * Careers: categories, locations, the default application form, demonstration
 * jobs and employee stories.
 *
 * The application form is seeded as a FormDefinition so HR can add or remove
 * questions through the CMS without engineering involvement.
 */
export async function seedCareers(prisma: PrismaClient, actorId: string): Promise<void> {
  const categories = [
    { key: 'RESTAURANT', name: 'Restaurant Careers', summary: 'Restaurant management, kitchen, service, delivery and operations.' },
    { key: 'CORPORATE', name: 'Corporate Careers', summary: 'Finance, people, marketing, procurement, supply chain and legal.' },
    { key: 'TECHNOLOGY', name: 'Technology Careers', summary: 'Engineering, product, data, infrastructure and security.' },
    { key: 'SUPPLY_CHAIN', name: 'Supply Chain Careers', summary: 'Warehousing, distribution, quality and planning.' },
    { key: 'EARLY_CAREERS', name: 'Students & Graduates', summary: 'Internships, graduate programmes and management trainee routes.' },
  ];

  for (const [index, category] of categories.entries()) {
    await prisma.careerCategory.upsert({
      where: { key: category.key },
      create: {
        key: category.key,
        name: category.name,
        slug: slugify(category.name),
        summary: category.summary,
        sortOrder: index,
        isPublished: true,
      },
      update: { name: category.name, summary: category.summary, sortOrder: index },
    });
  }

  // Job locations mirror the seeded cities, plus a remote option.
  const cities = await prisma.city.findMany({ select: { id: true, name: true, slug: true } });
  for (const [index, city] of cities.entries()) {
    await prisma.jobLocation.upsert({
      where: { slug: city.slug },
      create: { name: city.name, slug: city.slug, cityId: city.id, sortOrder: index },
      update: { cityId: city.id },
    });
  }
  await prisma.jobLocation.upsert({
    where: { slug: 'remote-pakistan' },
    create: { name: 'Remote (Pakistan)', slug: 'remote-pakistan', isRemote: true, sortOrder: 999 },
    update: {},
  });

  // --- Default application form ---------------------------------------------
  const form = await prisma.formDefinition.upsert({
    where: { key: 'JOB_APPLICATION' },
    create: {
      key: 'JOB_APPLICATION',
      name: 'Job application',
      slug: 'job-application',
      purpose: 'The default application form used by every job unless a role overrides it.',
      successMessage:
        'Your application has been received. We review every application and will be in touch if there is a match.',
      submitLabel: 'Submit application',
      spamProtection: true,
    },
    update: {},
    select: { id: true },
  });

  const fields = [
    { type: 'TEXT', name: 'firstName', label: 'First name', isRequired: true, width: 'half', sortOrder: 0 },
    { type: 'TEXT', name: 'lastName', label: 'Last name', isRequired: true, width: 'half', sortOrder: 1 },
    { type: 'EMAIL', name: 'email', label: 'Email address', isRequired: true, width: 'half', sortOrder: 2 },
    { type: 'PHONE', name: 'phone', label: 'Phone number', isRequired: true, width: 'half', sortOrder: 3 },
    { type: 'TEXT', name: 'city', label: 'City', isRequired: false, width: 'half', sortOrder: 4 },
    {
      type: 'FILE',
      name: 'cv',
      label: 'CV',
      helpText: 'PDF or Word document, up to 10 MB.',
      isRequired: true,
      width: 'full',
      sortOrder: 5,
      validation: { accept: ['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'] },
    },
    { type: 'TEXT', name: 'linkedinUrl', label: 'LinkedIn profile', isRequired: false, width: 'half', sortOrder: 6 },
    { type: 'TEXT', name: 'portfolioUrl', label: 'Portfolio or website', isRequired: false, width: 'half', sortOrder: 7 },
    {
      type: 'TEXTAREA',
      name: 'coverNote',
      label: 'Why this role?',
      helpText: 'Optional. A few sentences is plenty.',
      isRequired: false,
      width: 'full',
      sortOrder: 8,
      validation: { maxLength: 2000 },
    },
    {
      type: 'CONSENT',
      name: 'consent',
      label:
        'I consent to Cheezious storing and processing the information in this application for recruitment purposes.',
      isRequired: true,
      width: 'full',
      sortOrder: 9,
    },
  ];

  for (const field of fields) {
    await prisma.formField.upsert({
      where: { formId_name: { formId: form.id, name: field.name } },
      create: {
        formId: form.id,
        type: field.type as never,
        name: field.name,
        label: field.label,
        helpText: field.helpText ?? null,
        isRequired: field.isRequired,
        width: field.width,
        sortOrder: field.sortOrder,
        validation: (field.validation ?? undefined) as never,
      },
      update: { label: field.label, sortOrder: field.sortOrder },
    });
  }

  // --- Demonstration jobs ----------------------------------------------------
  const jobs = [
    {
      slug: 'restaurant-manager-placeholder',
      title: '[Placeholder] Restaurant Manager',
      category: 'RESTAURANT',
      department: 'RESTAURANT_OPERATIONS',
      location: 'lahore',
      employmentType: 'FULL_TIME',
      workplaceType: 'ON_SITE',
      summary: 'Run a restaurant: the team, the shift, the standards and the numbers.',
    },
    {
      slug: 'supply-chain-analyst-placeholder',
      title: '[Placeholder] Supply Chain Analyst',
      category: 'SUPPLY_CHAIN',
      department: 'SUPPLY_CHAIN',
      location: 'islamabad',
      employmentType: 'FULL_TIME',
      workplaceType: 'HYBRID',
      summary: 'Plan demand, track cost and keep product moving to restaurants.',
    },
    {
      slug: 'software-engineer-placeholder',
      title: '[Placeholder] Software Engineer',
      category: 'TECHNOLOGY',
      department: 'TECHNOLOGY',
      location: 'remote-pakistan',
      employmentType: 'FULL_TIME',
      workplaceType: 'REMOTE',
      summary: 'Build the systems behind ordering, restaurant operations and delivery.',
    },
    {
      slug: 'management-trainee-placeholder',
      title: '[Placeholder] Management Trainee',
      category: 'EARLY_CAREERS',
      department: 'RESTAURANT_OPERATIONS',
      location: 'karachi',
      employmentType: 'FULL_TIME',
      workplaceType: 'ON_SITE',
      summary: 'A structured route into restaurant management for recent graduates.',
    },
    {
      slug: 'people-partner-placeholder',
      title: '[Placeholder] People Partner',
      category: 'CORPORATE',
      department: 'PEOPLE',
      location: 'lahore',
      employmentType: 'FULL_TIME',
      workplaceType: 'ON_SITE',
      summary: 'Support managers on hiring, development and the working environment.',
    },
  ];

  for (const [index, job] of jobs.entries()) {
    const [category, department, location] = await Promise.all([
      prisma.careerCategory.findUnique({ where: { key: job.category }, select: { id: true } }),
      prisma.department.findUnique({ where: { key: job.department }, select: { id: true } }),
      prisma.jobLocation.findUnique({ where: { slug: job.location }, select: { id: true } }),
    ]);

    await prisma.job.upsert({
      where: { locale_slug: { locale: 'en', slug: job.slug } },
      create: {
        translationGroupId: `job-${job.slug}`,
        locale: 'en',
        title: job.title,
        slug: job.slug,
        categoryId: category?.id ?? null,
        departmentId: department?.id ?? null,
        locationId: location?.id ?? null,
        employmentType: job.employmentType as never,
        workplaceType: job.workplaceType as never,
        summary: job.summary,
        description:
          '<p>Placeholder role description. Replace with the approved description for this position.</p>',
        responsibilities:
          '<ul><li>Placeholder responsibility.</li><li>Placeholder responsibility.</li><li>Placeholder responsibility.</li></ul>',
        requirements:
          '<ul><li>Placeholder requirement.</li><li>Placeholder requirement.</li></ul>',
        preferredQualifications: '<ul><li>Placeholder preferred qualification.</li></ul>',
        benefits: '<ul><li>Placeholder benefit. Replace with approved benefits.</li></ul>',
        // Salary is deliberately left unset: an unapproved range must never be
        // published, and JobPosting structured data omits salary entirely
        // unless a complete, approved range exists.
        salaryMin: null,
        salaryMax: null,
        formDefinitionId: form.id,
        status: 'OPEN',
        postedAt: new Date(Date.now() - (index + 1) * 3 * 24 * 60 * 60 * 1000),
        applicationDeadline: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000),
        isFeatured: index < 2,
        createdById: actorId,
        seoDescription: job.summary,
      },
      update: {},
    });
  }

  // --- Employee stories ------------------------------------------------------
  const employeeStories = [
    {
      slug: 'from-crew-to-area-manager-placeholder',
      title: '[Placeholder] From crew member to area manager',
      roleLabel: 'Area Manager',
      departmentLabel: 'Restaurant Operations',
      locationLabel: 'Lahore',
      timeline: [
        { year: 2016, title: 'Crew Member' },
        { year: 2018, title: 'Shift Manager' },
        { year: 2020, title: 'Restaurant Manager' },
        { year: 2023, title: 'Area Manager' },
      ],
    },
    {
      slug: 'building-the-ordering-platform-placeholder',
      title: '[Placeholder] Building the ordering platform',
      roleLabel: 'Engineer',
      departmentLabel: 'Technology',
      locationLabel: 'Islamabad',
      timeline: [
        { year: 2021, title: 'Junior Engineer' },
        { year: 2024, title: 'Engineer' },
      ],
    },
  ];

  for (const [index, story] of employeeStories.entries()) {
    await prisma.employeeStory.upsert({
      where: { locale_slug: { locale: 'en', slug: story.slug } },
      create: {
        translationGroupId: `employee-${story.slug}`,
        locale: 'en',
        title: story.title,
        slug: story.slug,
        excerpt: 'Placeholder employee story demonstrating the career-journey template.',
        body:
          '<p>Placeholder employee story. Replace with a real, consented account from a colleague. ' +
          'Do not publish a person’s story, photograph or career history without their agreement.</p>',
        personName: '[Placeholder] Colleague',
        roleLabel: story.roleLabel,
        departmentLabel: story.departmentLabel,
        locationLabel: story.locationLabel,
        quote: 'Placeholder quote. Replace with an approved quotation.',
        careerTimeline: story.timeline as never,
        isFeatured: index === 0,
        isPublished: true,
        isDemoContent: true,
        publishedAt: new Date(Date.now() - (index + 1) * 20 * 24 * 60 * 60 * 1000),
      },
      update: {},
    });
  }
}

function slugify(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}
