import type { PrismaClient } from '@prisma/client';

/**
 * Editorial demonstration content: newsroom categories, stories, company news
 * and press releases.
 *
 * Headlines and bodies are placeholders describing the *kind* of story that
 * belongs in each slot. Nothing here claims Cheezious did anything.
 */
export async function seedContent(prisma: PrismaClient, actorId: string): Promise<void> {
  const categories = [
    { key: 'COMPANY', name: 'Company', family: 'company' },
    { key: 'EXPANSION', name: 'Expansion', family: 'expansion' },
    { key: 'PEOPLE', name: 'People', family: 'people' },
    { key: 'FOOD', name: 'Food', family: 'food' },
    { key: 'TECHNOLOGY', name: 'Technology', family: 'technology' },
    { key: 'COMMUNITY', name: 'Community', family: 'community' },
    { key: 'PARTNERSHIPS', name: 'Partnerships', family: 'partnerships' },
    { key: 'AWARDS', name: 'Awards', family: 'awards' },
  ];

  for (const [index, category] of categories.entries()) {
    await prisma.storyCategory.upsert({
      where: { key: category.key },
      create: {
        key: category.key,
        name: category.name,
        slug: slugify(category.name),
        family: category.family,
        sortOrder: index,
      },
      update: { name: category.name, family: category.family, sortOrder: index },
    });
  }

  for (const [index, name] of ['Operations', 'Supply Chain', 'Careers', 'Quality', 'Growth'].entries()) {
    await prisma.storyTag.upsert({
      where: { slug: slugify(name) },
      create: { name, slug: slugify(name) },
      update: {},
    });
    void index;
  }

  const companyCategory = await prisma.storyCategory.findUniqueOrThrow({ where: { key: 'COMPANY' } });
  const peopleCategory = await prisma.storyCategory.findUniqueOrThrow({ where: { key: 'PEOPLE' } });
  const expansionCategory = await prisma.storyCategory.findUniqueOrThrow({ where: { key: 'EXPANSION' } });

  const stories = [
    {
      slug: 'how-our-supply-chain-works-placeholder',
      kind: 'STORY',
      title: '[Placeholder] How our supply chain works',
      excerpt: 'A corporate story explaining how food moves from suppliers to restaurants.',
      categoryId: companyCategory.id,
      featured: true,
    },
    {
      slug: 'building-restaurants-placeholder',
      kind: 'STORY',
      title: '[Placeholder] What it takes to open a restaurant',
      excerpt: 'A story about restaurant development, from site selection to opening day.',
      categoryId: expansionCategory.id,
      featured: false,
    },
    {
      slug: 'a-day-in-operations-placeholder',
      kind: 'PEOPLE_STORY',
      title: '[Placeholder] A day in restaurant operations',
      excerpt: 'A people story following a shift from opening checks to close.',
      categoryId: peopleCategory.id,
      featured: false,
    },
    {
      slug: 'company-update-placeholder',
      kind: 'NEWS',
      title: '[Placeholder] Company update',
      excerpt: 'Company news. Replace with an approved announcement.',
      categoryId: companyCategory.id,
      featured: false,
    },
    {
      slug: 'expansion-update-placeholder',
      kind: 'EXPANSION',
      title: '[Placeholder] Expansion update',
      excerpt: 'Expansion news. Replace with an approved announcement.',
      categoryId: expansionCategory.id,
      featured: false,
    },
  ];

  const body =
    '<p>Placeholder story body. This entry exists so the newsroom, story templates and related-content ' +
    'relationships can be seen working end to end.</p>' +
    '<p>Replace this text with editorial content approved by Corporate Communications. Do not publish ' +
    'figures, milestones or claims about the company that have not been verified.</p>';

  for (const [index, story] of stories.entries()) {
    const publishedAt = new Date(Date.now() - (index + 1) * 5 * 24 * 60 * 60 * 1000);

    await prisma.story.upsert({
      where: { locale_slug: { locale: 'en', slug: story.slug } },
      create: {
        translationGroupId: `story-${story.slug}`,
        locale: 'en',
        kind: story.kind,
        title: story.title,
        slug: story.slug,
        excerpt: story.excerpt,
        body,
        categoryId: story.categoryId,
        isFeatured: story.featured,
        readingMinutes: 3,
        status: 'PUBLISHED',
        publishedAt,
        createdById: actorId,
        seoDescription: story.excerpt,
      },
      update: {},
    });
  }

  // --- Press releases --------------------------------------------------------
  const releaseCategories = [
    { key: 'CORPORATE', name: 'Corporate' },
    { key: 'EXPANSION', name: 'Expansion' },
    { key: 'PRODUCT', name: 'Product' },
    { key: 'COMMUNITY', name: 'Community' },
  ];

  for (const [index, category] of releaseCategories.entries()) {
    await prisma.pressReleaseCategory.upsert({
      where: { key: category.key },
      create: { key: category.key, name: category.name, slug: slugify(category.name), sortOrder: index },
      update: { name: category.name, sortOrder: index },
    });
  }

  const corporate = await prisma.pressReleaseCategory.findUniqueOrThrow({ where: { key: 'CORPORATE' } });

  const contact = await prisma.mediaContact.findFirst({ where: { email: 'press@example.com' } });
  const mediaContact =
    contact ??
    (await prisma.mediaContact.create({
      data: {
        locale: 'en',
        name: '[Placeholder] Press Office',
        role: 'Media enquiries',
        email: 'press@example.com',
        isPublished: true,
        topics: ['Corporate', 'Expansion'],
      },
    }));

  const releases = [
    { slug: 'corporate-announcement-placeholder', headline: '[Placeholder] Corporate announcement' },
    { slug: 'expansion-announcement-placeholder', headline: '[Placeholder] Expansion announcement' },
  ];

  for (const [index, release] of releases.entries()) {
    await prisma.pressRelease.upsert({
      where: { locale_slug: { locale: 'en', slug: release.slug } },
      create: {
        translationGroupId: `press-${release.slug}`,
        locale: 'en',
        headline: release.headline,
        slug: release.slug,
        summary: 'Placeholder summary. Replace with the approved release summary.',
        dateline: 'Islamabad, Pakistan',
        body:
          '<p>Placeholder press release body. Replace with the approved release text.</p>' +
          '<p>Do not publish figures, partnerships or milestones that have not been confirmed.</p>',
        categoryId: corporate.id,
        mediaContactId: mediaContact.id,
        status: 'PUBLISHED',
        publishedAt: new Date(Date.now() - (index + 1) * 12 * 24 * 60 * 60 * 1000),
        createdById: actorId,
        isFeatured: index === 0,
      },
      update: {},
    });
  }

  // --- Third-party coverage --------------------------------------------------
  const existingCoverage = await prisma.mediaCoverage.findFirst({ where: { outlet: '[Placeholder] Publication' } });
  if (!existingCoverage) {
    await prisma.mediaCoverage.create({
      data: {
        locale: 'en',
        title: '[Placeholder] Coverage headline',
        outlet: '[Placeholder] Publication',
        url: 'https://example.com/',
        publishedOn: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
        summary: 'Placeholder entry demonstrating how third-party coverage is listed.',
        isPublished: true,
      },
    });
  }
}

function slugify(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}
