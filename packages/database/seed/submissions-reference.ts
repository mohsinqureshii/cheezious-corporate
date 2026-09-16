import type { PrismaClient } from '@prisma/client';

/**
 * Reference data for the public submission forms, plus the contact routing map.
 *
 * Contact categories carry `routingEmail`, which is internal and never served by
 * the public API — the public endpoint selects only the fields a visitor needs.
 */
export async function seedSubmissionsReference(prisma: PrismaClient): Promise<void> {
  const supplierCategories = [
    { key: 'FOOD_INGREDIENTS', name: 'Food Ingredients' },
    { key: 'PACKAGING', name: 'Packaging' },
    { key: 'EQUIPMENT', name: 'Equipment' },
    { key: 'TECHNOLOGY', name: 'Technology' },
    { key: 'LOGISTICS', name: 'Logistics' },
    { key: 'FACILITIES', name: 'Facilities' },
    { key: 'MARKETING', name: 'Marketing' },
    { key: 'PROFESSIONAL_SERVICES', name: 'Professional Services' },
    { key: 'OTHER', name: 'Other' },
  ];

  for (const [index, category] of supplierCategories.entries()) {
    await prisma.supplierCategory.upsert({
      where: { key: category.key },
      create: { key: category.key, name: category.name, slug: slugify(category.name), sortOrder: index },
      update: { name: category.name, sortOrder: index },
    });
  }

  const partnershipCategories = [
    { key: 'UNIVERSITIES', name: 'Universities' },
    { key: 'BANKS', name: 'Banks & Financial Services' },
    { key: 'CORPORATE', name: 'Corporate Organisations' },
    { key: 'TECHNOLOGY', name: 'Technology Companies' },
    { key: 'PROPERTY_DEVELOPERS', name: 'Property Developers' },
    { key: 'COMMUNITY', name: 'Community Organisations' },
    { key: 'BRANDS', name: 'Brands' },
    { key: 'EVENTS', name: 'Events' },
    { key: 'OTHER', name: 'Other' },
  ];

  for (const [index, category] of partnershipCategories.entries()) {
    await prisma.partnershipCategory.upsert({
      where: { key: category.key },
      create: { key: category.key, name: category.name, slug: slugify(category.name), sortOrder: index },
      update: { name: category.name, sortOrder: index },
    });
  }

  const contactCategories = [
    {
      key: 'CUSTOMER',
      name: 'Customer care',
      description: 'Questions or feedback about a restaurant visit or an order.',
      instructions:
        'For a specific order, please include the order reference and the restaurant so we can look it up.',
      routingEmail: 'customercare@example.com',
    },
    {
      key: 'CORPORATE',
      name: 'Corporate enquiries',
      description: 'General enquiries about the company.',
      routingEmail: 'corporate@example.com',
    },
    {
      key: 'MEDIA',
      name: 'Media enquiries',
      description: 'For journalists and media organisations.',
      instructions: 'Please include your outlet and your deadline.',
      routingEmail: 'press@example.com',
    },
    {
      key: 'CAREERS',
      name: 'Careers',
      description: 'Questions about applying or about a live application.',
      instructions: 'To apply for a role, use the application form on the role itself rather than this form.',
      routingEmail: 'careers@example.com',
    },
    {
      key: 'SUPPLIERS',
      name: 'Suppliers',
      description: 'Questions about supplying Cheezious.',
      instructions: 'To register as a supplier, use the supplier registration form rather than this one.',
      routingEmail: 'procurement@example.com',
    },
    {
      key: 'REAL_ESTATE',
      name: 'Real estate',
      description: 'Questions about proposing a location.',
      instructions: 'To submit a property, use the property submission form rather than this one.',
      routingEmail: 'expansion@example.com',
    },
    {
      key: 'PARTNERSHIPS',
      name: 'Partnerships',
      description: 'Institutional and brand partnership enquiries.',
      routingEmail: 'partnerships@example.com',
    },
    { key: 'OTHER', name: 'Something else', description: 'Anything not covered above.', routingEmail: 'corporate@example.com' },
  ];

  for (const [index, category] of contactCategories.entries()) {
    await prisma.contactCategory.upsert({
      where: { key: category.key as never },
      create: {
        key: category.key as never,
        name: category.name,
        slug: slugify(category.name),
        description: category.description,
        publicInstructions: category.instructions ?? null,
        routingEmail: category.routingEmail,
        sortOrder: index,
      },
      update: {
        name: category.name,
        description: category.description,
        publicInstructions: category.instructions ?? null,
        sortOrder: index,
      },
    });
  }

  // --- Media folders ---------------------------------------------------------
  const folders = [
    { slug: 'brand', name: 'Brand assets', path: '/brand' },
    { slug: 'press', name: 'Press assets', path: '/press' },
    { slug: 'leadership', name: 'Leadership photography', path: '/leadership' },
    { slug: 'restaurants', name: 'Restaurant photography', path: '/restaurants' },
    { slug: 'operations', name: 'Operations photography', path: '/operations' },
    { slug: 'people', name: 'People photography', path: '/people' },
    { slug: 'documents', name: 'Documents', path: '/documents' },
  ];

  for (const [index, folder] of folders.entries()) {
    const existing = await prisma.mediaFolder.findFirst({ where: { path: folder.path }, select: { id: true } });
    if (existing) continue;
    await prisma.mediaFolder.create({
      data: { name: folder.name, slug: folder.slug, path: folder.path, sortOrder: index },
    });
  }
}

function slugify(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}
