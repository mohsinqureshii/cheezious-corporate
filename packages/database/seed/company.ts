import { randomUUID } from 'node:crypto';

import type { PrismaClient } from '@prisma/client';

/**
 * Company records: departments, leadership, the corporate footprint, the
 * timeline, awards and ingredients.
 *
 * Every figure here is a structural placeholder. Restaurant counts, team sizes
 * and opening years are `null` or flagged `isDemoContent`, so the public site
 * renders the layout without asserting a number Cheezious has not approved.
 */
export async function seedCompany(prisma: PrismaClient, actorId: string): Promise<void> {
  // --- Departments and teams -------------------------------------------------
  const departments = [
    { key: 'RESTAURANT_OPERATIONS', name: 'Restaurant Operations', summary: 'Running restaurants day to day, and the standards they run to.' },
    { key: 'SUPPLY_CHAIN', name: 'Supply Chain', summary: 'Procurement, warehousing, cold chain and distribution.' },
    { key: 'TECHNOLOGY', name: 'Technology', summary: 'The systems that take an order and get food to a customer.' },
    { key: 'FINANCE', name: 'Finance', summary: 'Financial control, planning and reporting.' },
    { key: 'PEOPLE', name: 'People', summary: 'Hiring, training, pay and the working environment.' },
    { key: 'MARKETING', name: 'Marketing', summary: 'Brand, campaigns and customer communication.' },
    { key: 'FOOD_QUALITY', name: 'Food & Quality', summary: 'Food safety, quality systems and product development.' },
    { key: 'DEVELOPMENT', name: 'Restaurant Development', summary: 'Finding, designing and building new restaurants.' },
    { key: 'LEGAL', name: 'Legal & Compliance', summary: 'Contracts, governance and regulatory compliance.' },
    { key: 'CUSTOMER_CARE', name: 'Customer Care', summary: 'Answering customers and closing the loop on feedback.' },
  ];

  for (const [index, department] of departments.entries()) {
    await prisma.department.upsert({
      where: { key: department.key },
      create: {
        key: department.key,
        name: department.name,
        slug: slugify(department.name),
        summary: department.summary,
        sortOrder: index,
      },
      update: { name: department.name, summary: department.summary, sortOrder: index },
    });
  }

  // --- Leadership groups -----------------------------------------------------
  const groups = [
    {
      key: 'EXECUTIVE',
      name: 'Executive Leadership',
      summary: 'The executive team accountable for how the company operates.',
    },
    {
      key: 'SENIOR',
      name: 'Senior Leadership',
      summary: 'Functional leaders running the operating areas of the business.',
    },
  ];

  for (const [index, group] of groups.entries()) {
    await prisma.leadershipGroup.upsert({
      where: { key: group.key },
      create: { key: group.key, name: group.name, slug: slugify(group.name), summary: group.summary, sortOrder: index, isPublished: true },
      update: { name: group.name, summary: group.summary, sortOrder: index },
    });
  }

  const executive = await prisma.leadershipGroup.findUniqueOrThrow({ where: { key: 'EXECUTIVE' } });
  const senior = await prisma.leadershipGroup.findUniqueOrThrow({ where: { key: 'SENIOR' } });

  /**
   * Demonstration leadership profiles.
   *
   * These are fictional placeholders with generic role titles, existing so the
   * leadership templates, relationships and profile pages can be seen working.
   * No real person is represented, and no biography asserts a real career.
   */
  const people = [
    { slug: 'chief-executive-placeholder', name: '[Placeholder] Chief Executive', role: 'Chief Executive Officer', group: executive.id, department: 'RESTAURANT_OPERATIONS' },
    { slug: 'chief-operating-placeholder', name: '[Placeholder] Chief Operating Officer', role: 'Chief Operating Officer', group: executive.id, department: 'RESTAURANT_OPERATIONS' },
    { slug: 'chief-financial-placeholder', name: '[Placeholder] Chief Financial Officer', role: 'Chief Financial Officer', group: executive.id, department: 'FINANCE' },
    { slug: 'supply-chain-director-placeholder', name: '[Placeholder] Supply Chain Director', role: 'Director, Supply Chain', group: senior.id, department: 'SUPPLY_CHAIN' },
    { slug: 'technology-director-placeholder', name: '[Placeholder] Technology Director', role: 'Director, Technology', group: senior.id, department: 'TECHNOLOGY' },
    { slug: 'people-director-placeholder', name: '[Placeholder] People Director', role: 'Director, People', group: senior.id, department: 'PEOPLE' },
    { slug: 'quality-director-placeholder', name: '[Placeholder] Food & Quality Director', role: 'Director, Food & Quality', group: senior.id, department: 'FOOD_QUALITY' },
  ];

  for (const [index, person] of people.entries()) {
    const department = await prisma.department.findUnique({ where: { key: person.department }, select: { id: true } });
    const translationGroupId = `person-${person.slug}`;

    await prisma.person.upsert({
      where: { locale_slug: { locale: 'en', slug: person.slug } },
      create: {
        translationGroupId,
        locale: 'en',
        name: person.name,
        slug: person.slug,
        role: person.role,
        leadershipGroupId: person.group,
        departmentId: department?.id ?? null,
        shortBio:
          'Placeholder biography. Replace with an approved profile describing this person’s responsibilities and background.',
        fullBio:
          '<p>Placeholder biography. This profile exists to demonstrate the leadership template. Replace the text, portrait and responsibilities with content approved by Corporate Communications before publishing.</p>',
        responsibilities: 'Placeholder responsibilities. Replace with the approved description of this role.',
        sortOrder: index,
        isFeatured: index === 0,
        status: 'PUBLISHED',
        publishedAt: new Date(),
        createdById: actorId,
      },
      update: {},
    });
  }

  // --- Corporate footprint ---------------------------------------------------
  const regions = [
    { key: 'PUNJAB', name: 'Punjab', cities: ['Lahore', 'Rawalpindi', 'Faisalabad', 'Multan', 'Gujranwala'] },
    { key: 'ICT', name: 'Islamabad Capital Territory', cities: ['Islamabad'] },
    { key: 'SINDH', name: 'Sindh', cities: ['Karachi', 'Hyderabad'] },
    { key: 'KP', name: 'Khyber Pakhtunkhwa', cities: ['Peshawar', 'Abbottabad'] },
    { key: 'BALOCHISTAN', name: 'Balochistan', cities: ['Quetta'] },
  ];

  // Approximate city centroids, used to place markers on the footprint map.
  const coordinates: Record<string, [number, number]> = {
    Lahore: [31.5204, 74.3587],
    Rawalpindi: [33.5651, 73.0169],
    Faisalabad: [31.4187, 73.0791],
    Multan: [30.1575, 71.5249],
    Gujranwala: [32.1877, 74.1945],
    Islamabad: [33.6844, 73.0479],
    Karachi: [24.8607, 67.0011],
    Hyderabad: [25.396, 68.3578],
    Peshawar: [34.0151, 71.5249],
    Abbottabad: [34.1688, 73.2215],
    Quetta: [30.1798, 66.975],
  };

  for (const [regionIndex, region] of regions.entries()) {
    const created = await prisma.region.upsert({
      where: { key: region.key },
      create: {
        key: region.key,
        name: region.name,
        slug: slugify(region.name),
        kind: region.key === 'ICT' ? 'TERRITORY' : 'PROVINCE',
        sortOrder: regionIndex,
        isPublished: true,
      },
      update: { name: region.name, sortOrder: regionIndex },
    });

    for (const [cityIndex, cityName] of region.cities.entries()) {
      const position = coordinates[cityName];
      await prisma.city.upsert({
        where: { slug: slugify(cityName) },
        create: {
          regionId: created.id,
          name: cityName,
          slug: slugify(cityName),
          latitude: position?.[0] ?? null,
          longitude: position?.[1] ?? null,
          // Deliberately null: the footprint renders a city only with the
          // figures Cheezious has approved, and omits the metric otherwise.
          restaurantCount: null,
          teamMemberCount: null,
          firstOpeningYear: null,
          isPublished: true,
          isDemoContent: true,
          sortOrder: cityIndex,
        },
        update: { latitude: position?.[0] ?? null, longitude: position?.[1] ?? null },
      });
    }
  }

  const islamabad = await prisma.city.findUnique({ where: { slug: 'islamabad' }, select: { id: true } });
  if (islamabad) {
    const existing = await prisma.corporateLocation.findFirst({
      where: { cityId: islamabad.id, kind: 'HEAD_OFFICE' },
      select: { id: true },
    });
    if (!existing) {
      await prisma.corporateLocation.create({
        data: {
          cityId: islamabad.id,
          name: '[Placeholder] Head Office',
          kind: 'HEAD_OFFICE',
          summary: 'Placeholder corporate location. Replace with the approved office details.',
          isPublished: true,
        },
      });
    }
  }

  // --- Timeline --------------------------------------------------------------
  // Structural examples only. Years are generic placeholders, not company history.
  const milestones = [
    { year: 2012, headline: '[Placeholder] Company founded', description: 'Replace with the approved founding milestone.', category: 'Company' },
    { year: 2015, headline: '[Placeholder] Expansion milestone', description: 'Replace with an approved expansion milestone.', category: 'Growth' },
    { year: 2018, headline: '[Placeholder] Operations milestone', description: 'Replace with an approved operations or supply-chain milestone.', category: 'Operations' },
    { year: 2021, headline: '[Placeholder] Technology milestone', description: 'Replace with an approved technology milestone.', category: 'Technology' },
    { year: 2024, headline: '[Placeholder] People milestone', description: 'Replace with an approved people or community milestone.', category: 'People' },
    { year: 2026, headline: '[Placeholder] Current milestone', description: 'Replace with the most recent approved milestone.', category: 'Company' },
  ];

  for (const [index, milestone] of milestones.entries()) {
    const translationGroupId = `timeline-${milestone.year}-${index}`;
    const existing = await prisma.timelineEvent.findFirst({
      where: { translationGroupId, locale: 'en' },
      select: { id: true },
    });
    if (existing) continue;

    await prisma.timelineEvent.create({
      data: {
        translationGroupId,
        locale: 'en',
        year: milestone.year,
        headline: milestone.headline,
        description: milestone.description,
        category: milestone.category,
        isFeatured: index % 2 === 0,
        isPublished: true,
        isDemoContent: true,
        sortOrder: index,
      },
    });
  }

  // --- Awards ----------------------------------------------------------------
  for (const [index, key] of ['workplace', 'brand', 'quality'].entries()) {
    await prisma.awardCategory.upsert({
      where: { key: key.toUpperCase() },
      create: { key: key.toUpperCase(), name: titleCase(key), slug: key, sortOrder: index },
      update: {},
    });
  }

  const awardCategory = await prisma.awardCategory.findUniqueOrThrow({ where: { key: 'BRAND' } });
  const translationGroupId = 'award-placeholder-1';
  const existingAward = await prisma.award.findFirst({ where: { translationGroupId, locale: 'en' } });
  if (!existingAward) {
    await prisma.award.create({
      data: {
        translationGroupId,
        locale: 'en',
        name: '[Placeholder] Award name',
        organisation: '[Placeholder] Awarding organisation',
        year: 2025,
        description:
          'Placeholder award. Replace with an award Cheezious has actually received, or remove this entry.',
        categoryId: awardCategory.id,
        isPublished: true,
        isDemoContent: true,
        sortOrder: 0,
      },
    });
  }

  // --- Ingredients -----------------------------------------------------------
  const ingredientCategories = [
    { key: 'DAIRY', name: 'Dairy', summary: 'Cheese and dairy inputs.' },
    { key: 'PROTEIN', name: 'Protein', summary: 'Chicken and other proteins.' },
    { key: 'BAKERY', name: 'Bakery', summary: 'Dough and bakery inputs.' },
    { key: 'PRODUCE', name: 'Produce', summary: 'Vegetables and fresh produce.' },
    { key: 'PACKAGING', name: 'Packaging', summary: 'Food-contact packaging materials.' },
  ];

  for (const [index, category] of ingredientCategories.entries()) {
    await prisma.ingredientCategory.upsert({
      where: { key: category.key },
      create: { key: category.key, name: category.name, slug: slugify(category.name), summary: category.summary, sortOrder: index },
      update: { name: category.name, summary: category.summary, sortOrder: index },
    });
  }

  const dairy = await prisma.ingredientCategory.findUniqueOrThrow({ where: { key: 'DAIRY' } });
  await prisma.ingredient.upsert({
    where: { locale_slug: { locale: 'en', slug: 'cheese-placeholder' } },
    create: {
      translationGroupId: 'ingredient-cheese',
      locale: 'en',
      name: '[Placeholder] Cheese',
      slug: 'cheese-placeholder',
      categoryId: dairy.id,
      summary: 'Placeholder ingredient entry demonstrating the ingredient template.',
      qualityInformation:
        'Replace with approved quality information. Do not publish a claim about specifications or testing that has not been verified.',
      sourcingInformation:
        'Replace with approved sourcing information. Do not publish a local-sourcing claim that has not been verified.',
      // Left null deliberately: allergen information must never be guessed.
      allergenInformation: null,
      isPublished: true,
      isDemoContent: true,
    },
    update: {},
  });

  void randomUUID; // retained for future seed extensions
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function titleCase(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}
