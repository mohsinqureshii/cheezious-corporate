import type { PrismaClient } from '@prisma/client';

/**
 * Navigation, mega menu and footer.
 *
 * Navigation items reference pages by id, never by URL, so renaming a page
 * updates every menu automatically. Everything here is editable in the CMS —
 * adding a mega-menu column should never require a deployment.
 */

interface NavItemSpec {
  label: string;
  path?: string;
  externalUrl?: string;
  descriptor?: string;
  isCallToAction?: boolean;
  opensInNewTab?: boolean;
  children?: NavItemSpec[];
}

/** The primary mega menu: six sections, each with grouped columns. */
const PRIMARY: NavItemSpec[] = [
  {
    label: 'Company',
    path: '/company/about',
    children: [
      {
        label: 'About',
        children: [
          { label: 'About Cheezious', path: '/company/about', descriptor: 'What the company does' },
          { label: 'Our Story', path: '/company/our-story', descriptor: 'Where we started' },
          { label: 'At a Glance', path: '/company/at-a-glance', descriptor: 'The company in figures' },
          { label: 'Purpose', path: '/company/purpose' },
          { label: 'Mission & Vision', path: '/company/mission-vision' },
          { label: 'Values', path: '/company/values' },
          { label: 'Our Brand', path: '/company/our-brand' },
        ],
      },
      {
        label: 'Organisation',
        children: [
          { label: 'Leadership', path: '/company/leadership', descriptor: 'Who runs the company' },
          { label: 'Organization', path: '/company/organization' },
          { label: 'Where We Operate', path: '/company/where-we-operate', descriptor: 'Our corporate footprint' },
          { label: 'Timeline', path: '/company/timeline' },
          { label: 'Awards & Recognition', path: '/company/awards-recognition' },
          { label: 'Governance', path: '/company/governance', descriptor: 'How the company is governed' },
        ],
      },
    ],
  },
  {
    label: 'Business',
    path: '/company/business',
    children: [
      {
        label: 'Operations',
        children: [
          { label: 'Business Overview', path: '/company/business', descriptor: 'How it fits together' },
          { label: 'Restaurant Operations', path: '/company/business/restaurant-operations' },
          { label: 'Our Restaurants', path: '/company/business/restaurants' },
          { label: 'Delivery & Digital', path: '/company/business/delivery-digital' },
          { label: 'Technology', path: '/company/business/technology' },
        ],
      },
      {
        label: 'Supply & growth',
        children: [
          { label: 'Supply Chain', path: '/company/business/supply-chain' },
          { label: 'Procurement', path: '/company/business/procurement' },
          { label: 'Food Innovation', path: '/company/business/food-innovation' },
          { label: 'Restaurant Development', path: '/company/business/restaurant-development' },
          { label: 'Real Estate', path: '/company/business/real-estate' },
          { label: 'Growth & Expansion', path: '/company/business/growth-expansion' },
        ],
      },
      {
        label: 'Food & quality',
        children: [
          { label: 'Food & Quality', path: '/company/food-quality' },
          { label: 'Food Safety', path: '/company/food-quality/food-safety' },
          { label: 'Ingredients', path: '/company/food-quality/ingredients' },
          { label: 'Sourcing', path: '/company/food-quality/sourcing' },
          { label: 'Supplier Standards', path: '/company/food-quality/supplier-standards' },
        ],
      },
    ],
  },
  {
    label: 'People',
    path: '/company/people',
    children: [
      {
        label: 'Our people',
        children: [
          { label: 'Our People', path: '/company/people', descriptor: 'The people who run it' },
          { label: 'Culture', path: '/company/people/culture' },
          { label: 'Employee Stories', path: '/company/people/stories' },
          { label: 'Life at Cheezious', path: '/company/people/life-at-cheezious' },
        ],
      },
      {
        label: 'Growing here',
        children: [
          { label: 'Learning & Development', path: '/company/people/learning-development' },
          { label: 'Recognition', path: '/company/people/recognition' },
          { label: 'Workplace', path: '/company/people/workplace' },
          { label: 'Careers', path: '/careers', descriptor: 'Open roles', isCallToAction: true },
        ],
      },
    ],
  },
  {
    label: 'Impact',
    path: '/company/impact',
    children: [
      {
        label: 'Our impact',
        children: [
          { label: 'Our Impact', path: '/company/impact', descriptor: 'What we are working on' },
          { label: 'Community', path: '/company/impact/community' },
          { label: 'Youth', path: '/company/impact/youth' },
          { label: 'Education', path: '/company/impact/education' },
          { label: 'Food & Hunger', path: '/company/impact/food-hunger' },
          { label: 'People', path: '/company/impact/people' },
        ],
      },
      {
        label: 'Environment & sourcing',
        children: [
          { label: 'Environment', path: '/company/impact/environment' },
          { label: 'Packaging & Waste', path: '/company/impact/packaging-waste' },
          { label: 'Responsible Sourcing', path: '/company/impact/responsible-sourcing' },
          { label: 'Impact Stories', path: '/company/impact/stories' },
          { label: 'Reports', path: '/company/resources/impact-reports' },
        ],
      },
    ],
  },
  {
    label: 'Partners',
    path: '/company/partners',
    children: [
      {
        label: 'Suppliers',
        children: [
          { label: 'Partner With Us', path: '/company/partners', descriptor: 'Ways to work with us' },
          { label: 'Suppliers', path: '/company/partners/suppliers' },
          { label: 'Supplier Registration', path: '/company/partners/supplier-registration', descriptor: 'Register your company', isCallToAction: true },
        ],
      },
      {
        label: 'Real estate & partnerships',
        children: [
          { label: 'Real Estate Partners', path: '/company/partners/real-estate' },
          { label: 'Submit a Property', path: '/company/partners/submit-property', descriptor: 'Propose a location', isCallToAction: true },
          { label: 'Institutional Partnerships', path: '/company/partners/institutional' },
          { label: 'Business Enquiries', path: '/company/partners/business-enquiries' },
        ],
      },
    ],
  },
  {
    label: 'Newsroom',
    path: '/company/newsroom',
    children: [
      {
        label: 'News & stories',
        children: [
          { label: 'Newsroom', path: '/company/newsroom', descriptor: 'Latest from the company' },
          { label: 'Company News', path: '/company/newsroom/news' },
          { label: 'Press Releases', path: '/company/newsroom/press-releases' },
          { label: 'Stories', path: '/company/newsroom/stories' },
          { label: 'People Stories', path: '/company/newsroom/people' },
          { label: 'Expansion News', path: '/company/newsroom/expansion' },
        ],
      },
      {
        label: 'For media',
        children: [
          { label: 'Media Center', path: '/company/newsroom/media-center', descriptor: 'Assets and information', isCallToAction: true },
          { label: 'Media Coverage', path: '/company/newsroom/media-coverage' },
          { label: 'Media Contacts', path: '/company/newsroom/media-contacts' },
          { label: 'Media Library', path: '/company/newsroom/media-library' },
          { label: 'Fact Sheet', path: '/company/newsroom/fact-sheet' },
          { label: 'Brand Assets', path: '/company/newsroom/brand-assets' },
        ],
      },
    ],
  },
];

const FOOTER: NavItemSpec[] = [
  {
    label: 'Company',
    children: [
      { label: 'About Cheezious', path: '/company/about' },
      { label: 'Our Story', path: '/company/our-story' },
      { label: 'At a Glance', path: '/company/at-a-glance' },
      { label: 'Leadership', path: '/company/leadership' },
      { label: 'Where We Operate', path: '/company/where-we-operate' },
    ],
  },
  {
    label: 'Business',
    children: [
      { label: 'Business Overview', path: '/company/business' },
      { label: 'Restaurant Operations', path: '/company/business/restaurant-operations' },
      { label: 'Supply Chain', path: '/company/business/supply-chain' },
      { label: 'Technology', path: '/company/business/technology' },
      { label: 'Food & Quality', path: '/company/food-quality' },
    ],
  },
  {
    label: 'People',
    children: [
      { label: 'Our People', path: '/company/people' },
      { label: 'Culture', path: '/company/people/culture' },
      { label: 'Employee Stories', path: '/company/people/stories' },
      { label: 'Careers', path: '/careers' },
      { label: 'Open Roles', path: '/careers/jobs' },
    ],
  },
  {
    label: 'Impact',
    children: [
      { label: 'Our Impact', path: '/company/impact' },
      { label: 'Community', path: '/company/impact/community' },
      { label: 'Environment', path: '/company/impact/environment' },
      { label: 'Responsible Sourcing', path: '/company/impact/responsible-sourcing' },
      { label: 'Impact Reports', path: '/company/resources/impact-reports' },
    ],
  },
  {
    label: 'Partners',
    children: [
      { label: 'Partner With Us', path: '/company/partners' },
      { label: 'Suppliers', path: '/company/partners/suppliers' },
      { label: 'Supplier Registration', path: '/company/partners/supplier-registration' },
      { label: 'Submit a Property', path: '/company/partners/submit-property' },
      { label: 'Institutional Partnerships', path: '/company/partners/institutional' },
    ],
  },
  {
    label: 'Newsroom & resources',
    children: [
      { label: 'Newsroom', path: '/company/newsroom' },
      { label: 'Press Releases', path: '/company/newsroom/press-releases' },
      { label: 'Media Center', path: '/company/newsroom/media-center' },
      { label: 'Corporate Resources', path: '/company/resources' },
      { label: 'Governance', path: '/company/governance' },
      { label: 'Contact', path: '/company/contact' },
    ],
  },
];

const UTILITY: NavItemSpec[] = [
  { label: 'Search', path: '/search' },
  { label: 'Contact', path: '/company/contact' },
  {
    label: 'Order Cheezious',
    externalUrl: 'https://cheezious.com',
    descriptor: 'Leave the corporate site for ordering',
    opensInNewTab: true,
    isCallToAction: true,
  },
];

export async function seedNavigation(prisma: PrismaClient): Promise<void> {
  const pageIdByPath = new Map(
    (await prisma.page.findMany({ where: { locale: 'en' }, select: { id: true, path: true } })).map((p) => [
      p.path,
      p.id,
    ]),
  );

  const navigations: Array<{ key: string; label: string; location: 'PRIMARY' | 'FOOTER' | 'UTILITY'; items: NavItemSpec[] }> = [
    { key: 'primary', label: 'Primary navigation', location: 'PRIMARY', items: PRIMARY },
    { key: 'footer', label: 'Footer navigation', location: 'FOOTER', items: FOOTER },
    { key: 'utility', label: 'Utility navigation', location: 'UTILITY', items: UTILITY },
  ];

  for (const spec of navigations) {
    const navigation = await prisma.navigation.upsert({
      where: { key_locale: { key: spec.key, locale: 'en' } },
      create: { key: spec.key, label: spec.label, location: spec.location, locale: 'en' },
      update: { label: spec.label },
      select: { id: true },
    });

    // Re-seeding must not duplicate menu items or overwrite an editor's changes.
    const existing = await prisma.navigationItem.count({ where: { navigationId: navigation.id } });
    if (existing > 0) continue;

    await createItems(prisma, navigation.id, spec.items, null, pageIdByPath);
  }
}

async function createItems(
  prisma: PrismaClient,
  navigationId: string,
  items: NavItemSpec[],
  parentId: string | null,
  pageIdByPath: Map<string, string>,
): Promise<void> {
  for (const [index, item] of items.entries()) {
    const pageId = item.path ? pageIdByPath.get(item.path) : undefined;

    // An item pointing at a page that does not exist would render a dead link.
    if (item.path && !pageId) {
      console.warn(`    ! navigation item "${item.label}" targets missing page ${item.path}; skipped`);
      continue;
    }

    const kind = item.children?.length
      ? item.path
        ? 'PAGE'
        : 'GROUP'
      : item.externalUrl
        ? 'EXTERNAL'
        : 'PAGE';

    const created = await prisma.navigationItem.create({
      data: {
        navigationId,
        kind: kind as never,
        label: item.label,
        descriptor: item.descriptor ?? null,
        pageId: pageId ?? null,
        externalUrl: item.externalUrl ?? null,
        opensInNewTab: item.opensInNewTab ?? false,
        isCallToAction: item.isCallToAction ?? false,
        parentId,
        sortOrder: index,
      },
      select: { id: true },
    });

    if (item.children?.length) {
      await createItems(prisma, navigationId, item.children, created.id, pageIdByPath);
    }
  }
}
