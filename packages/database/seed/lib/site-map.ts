/**
 * The corporate information architecture.
 *
 * This is the single declaration of what the corporate site *is*. The seed
 * creates a page for every entry; the public site resolves routes from the
 * database rather than from hardcoded files, so Corporate Communications can add
 * a page tomorrow without a deployment.
 *
 * Roughly 70 destinations, composed from the block library rather than written
 * as 70 bespoke templates.
 */

export interface PageSeedSpec {
  path: string;
  title: string;
  navLabel?: string;
  summary: string;
  type?: 'STANDARD' | 'LANDING' | 'SECTION_INDEX' | 'EDITORIAL' | 'DOCUMENT_CENTRE' | 'CONTACT' | 'SYSTEM';
  /** Blocks to compose the page from. Referenced by registry key. */
  blocks: Array<{ key: string; data: Record<string, unknown> }>;
  /** Sitemap hints; sensible defaults are applied by type when absent. */
  priority?: number;
  changeFrequency?: string;
  excludeFromSitemap?: boolean;
  noindex?: boolean;
}

/** A standard editorial page: hero, statement, two editorial sections, CTA. */
function editorialPage(
  path: string,
  title: string,
  summary: string,
  options: {
    eyebrow?: string;
    statement?: string;
    sections?: Array<{ heading: string; body: string }>;
    extraBlocks?: Array<{ key: string; data: Record<string, unknown> }>;
    type?: PageSeedSpec['type'];
    priority?: number;
  } = {},
): PageSeedSpec {
  const sections = options.sections ?? [];

  return {
    path,
    title,
    summary,
    type: options.type ?? 'STANDARD',
    priority: options.priority,
    blocks: [
      {
        key: 'HeroEditorial',
        data: {
          eyebrow: options.eyebrow ?? 'Cheezious Corporate',
          headline: title,
          standfirst: summary,
          tone: 'dark',
          overlayHeader: true,
        },
      },
      ...(options.statement
        ? [{ key: 'IntroStatement', data: { statement: options.statement, tone: 'light' } }]
        : []),
      ...sections.map((section, index) => ({
        key: index % 2 === 0 ? 'EditorialTextImage' : 'EditorialImageText',
        data: {
          heading: section.heading,
          body: `<p>${section.body}</p>`,
          image: { assetId: 'PLACEHOLDER' },
          tone: index % 2 === 0 ? 'light' : 'muted',
        },
      })),
      ...(options.extraBlocks ?? []),
      {
        key: 'RelatedContent',
        data: { heading: 'Related', autoDerive: true, tone: 'light' },
      },
    ],
  };
}

export const SITE_MAP: PageSeedSpec[] = [
  // ===========================================================================
  // A. CORPORATE HOME
  // ===========================================================================
  {
    path: '/company',
    title: 'Cheezious Corporate',
    navLabel: 'Company',
    summary:
      'The company behind the restaurants: how we operate, where we are growing, and the people doing the work.',
    type: 'LANDING',
    priority: 1.0,
    changeFrequency: 'daily',
    blocks: [
      {
        key: 'HeroEditorial',
        data: {
          eyebrow: 'Cheezious Corporate',
          headline: 'Built here. Growing here.',
          standfirst:
            'A Pakistani food company, its restaurants, its supply chain and the people who run them.',
          tone: 'dark',
          overlayHeader: true,
          aspectRatio: '21:9',
        },
      },
      {
        key: 'KPIBand',
        data: {
          eyebrow: 'At a glance',
          heading: 'Cheezious at a glance',
          tone: 'dark',
          statistics: [
            { value: '—', label: 'Founded', isPlaceholder: true, animate: false },
            { value: '—', label: 'Restaurants', isPlaceholder: true, animate: false },
            { value: '—', label: 'Cities', isPlaceholder: true, animate: false },
            { value: '—', label: 'Team members', isPlaceholder: true, animate: false },
          ],
        },
      },
      {
        key: 'EditorialTextImage',
        data: {
          eyebrow: 'Our company',
          heading: 'A company built around restaurants',
          body:
            '<p>Placeholder copy. Replace with the approved description of what the company does and how it is organised.</p>',
          image: { assetId: 'PLACEHOLDER' },
          links: [{ label: 'Explore Cheezious', pageId: 'REF:/company/about', opensInNewTab: false }],
        },
      },
      {
        key: 'MilestoneTimeline',
        data: { eyebrow: 'Our journey', heading: 'How we got here', limit: 5, tone: 'muted' },
      },
      {
        key: 'PakistanFootprint',
        data: {
          eyebrow: 'Where we operate',
          heading: 'Our corporate footprint',
          intro: 'Business presence by region and city. This is not a restaurant locator.',
          showCityList: true,
        },
      },
      {
        key: 'BusinessPillars',
        data: {
          eyebrow: 'Our business',
          heading: 'Behind every restaurant is an operating system',
          pillars: [
            { title: 'Restaurants', description: 'Running restaurants to a consistent standard.' },
            { title: 'Supply chain', description: 'Sourcing, warehousing and distribution.' },
            { title: 'Digital', description: 'Ordering, delivery and customer experience.' },
            { title: 'Technology', description: 'The systems restaurants run on.' },
            { title: 'Food & quality', description: 'Food safety and quality systems.' },
          ],
        },
      },
      {
        key: 'OperationsFlow',
        data: {
          eyebrow: 'Operations',
          heading: 'From source to customer',
          steps: [
            { label: 'Sourcing', description: 'Working with suppliers.' },
            { label: 'Procurement', description: 'Buying to specification.' },
            { label: 'Warehousing', description: 'Storing and handling product.' },
            { label: 'Distribution', description: 'Moving product to restaurants.' },
            { label: 'Restaurants', description: 'Preparing and serving food.' },
            { label: 'Customers', description: 'In restaurant, delivery and collection.' },
          ],
          tone: 'muted',
        },
      },
      {
        key: 'EditorialImageText',
        data: {
          eyebrow: 'People',
          heading: 'The people who run it',
          body: '<p>Placeholder copy. Replace with approved copy about the workforce and culture.</p>',
          image: { assetId: 'PLACEHOLDER' },
          links: [{ label: 'Our people', pageId: 'REF:/company/people', opensInNewTab: false }],
        },
      },
      { key: 'EmployeeStoryFeature', data: { eyebrow: 'Career story', fallbackToLatest: true, tone: 'light' } },
      {
        key: 'ImpactPillars',
        data: { eyebrow: 'Impact', heading: 'What we are working on', showMetrics: true, tone: 'muted' },
      },
      {
        key: 'LeadershipGrid',
        data: { eyebrow: 'Leadership', heading: 'Who runs the company', columns: '4', linkToProfiles: true },
      },
      {
        key: 'StoryGrid',
        data: {
          eyebrow: 'Newsroom',
          heading: 'Latest',
          kinds: ['NEWS', 'STORY'],
          limit: 3,
          columns: '3',
          viewAllLink: { label: 'Visit the newsroom', pageId: 'REF:/company/newsroom', opensInNewTab: false },
        },
      },
      {
        key: 'CTABand',
        data: {
          headline: 'Work with us',
          body: 'Suppliers, property partners and institutions.',
          tone: 'accent',
          primaryLink: { label: 'Partner with Cheezious', pageId: 'REF:/company/partners', opensInNewTab: false },
        },
      },
      {
        key: 'ReportGrid',
        data: { eyebrow: 'Resources', heading: 'Company publications', limit: 3, columns: '3' },
      },
      {
        key: 'CTAEditorial',
        data: {
          eyebrow: 'Careers',
          heading: 'Grow with Cheezious',
          body: 'Restaurant, corporate, technology and early-career roles.',
          primaryLink: { label: 'See open roles', pageId: 'REF:/careers', opensInNewTab: false },
        },
      },
    ],
  },

  // ===========================================================================
  // B. OUR COMPANY
  // ===========================================================================
  editorialPage('/company/about', 'About Cheezious', 'What the company is, what it does and how it is organised.', {
    statement:
      'Cheezious is a Pakistani food company. This page describes the company behind the restaurants.',
    sections: [
      { heading: 'What we do', body: 'Placeholder copy. Replace with the approved description of the business.' },
      { heading: 'How we are organised', body: 'Placeholder copy describing the operating structure.' },
    ],
    priority: 0.9,
    type: 'SECTION_INDEX',
  }),
  editorialPage('/company/our-story', 'Our Story', 'Where the company started and how it has grown.', {
    extraBlocks: [{ key: 'Timeline', data: { heading: 'Milestones', layout: 'vertical', showMedia: true } }],
    type: 'EDITORIAL',
  }),
  editorialPage('/company/our-journey', 'Our Journey', 'The milestones that shaped the company.', {
    extraBlocks: [{ key: 'Timeline', data: { layout: 'vertical', showMedia: true } }],
    type: 'EDITORIAL',
  }),
  {
    path: '/company/at-a-glance',
    title: 'Cheezious at a Glance',
    summary: 'The company in figures: scale, footprint, people and growth.',
    type: 'LANDING',
    priority: 0.9,
    blocks: [
      {
        key: 'HeroMinimal',
        data: { eyebrow: 'Cheezious Corporate', headline: 'At a glance', standfirst: 'The company in figures.' },
      },
      {
        key: 'KPIGrid',
        data: {
          heading: 'Company figures',
          intro: 'All figures are managed in the CMS and shown only once approved.',
          columns: '3',
          statistics: [
            { value: '—', label: 'Founded', isPlaceholder: true, animate: false },
            { value: '—', label: 'Restaurants', isPlaceholder: true, animate: false },
            { value: '—', label: 'Cities', isPlaceholder: true, animate: false },
            { value: '—', label: 'Team members', isPlaceholder: true, animate: false },
            { value: '—', label: 'Production facilities', isPlaceholder: true, animate: false },
            { value: '—', label: 'Digital customers', isPlaceholder: true, animate: false },
          ],
        },
      },
      { key: 'PakistanFootprint', data: { heading: 'Where we operate', showCityList: true, tone: 'muted' } },
      { key: 'MilestoneTimeline', data: { heading: 'Timeline highlights', limit: 6 } },
      {
        key: 'BusinessPillars',
        data: {
          heading: 'Our business',
          pillars: [
            { title: 'Restaurants', description: 'The restaurant estate and how it is run.' },
            { title: 'Supply chain', description: 'Sourcing, warehousing and distribution.' },
            { title: 'Digital', description: 'Ordering, delivery and the customer experience.' },
            { title: 'Technology', description: 'The systems restaurants run on.' },
          ],
        },
      },
      { key: 'ReportGrid', data: { heading: 'Related publications', limit: 3, columns: '3', tone: 'muted' } },
    ],
  },
  editorialPage('/company/purpose', 'Our Purpose', 'Why the company exists and what it is working towards.'),
  editorialPage('/company/mission-vision', 'Mission & Vision', 'What we are building and how we intend to get there.'),
  editorialPage('/company/values', 'Our Values', 'The standards we hold ourselves to.'),
  editorialPage('/company/our-brand', 'Our Brand', 'What the Cheezious brand stands for, and how it is used.'),
  {
    path: '/company/leadership',
    title: 'Leadership',
    summary: 'The people responsible for running the company.',
    type: 'SECTION_INDEX',
    priority: 0.8,
    blocks: [
      {
        key: 'HeroMinimal',
        data: { eyebrow: 'Our company', headline: 'Leadership', standfirst: 'The people responsible for running the company day to day.' },
      },
      { key: 'LeadershipGrid', data: { columns: '3', linkToProfiles: true, showRole: true } },
      {
        key: 'CTAEditorial',
        data: {
          heading: 'Corporate governance',
          body: 'How the company is governed, and the policies that apply.',
          primaryLink: { label: 'Governance', pageId: 'REF:/company/governance', opensInNewTab: false },
          tone: 'muted',
        },
      },
    ],
  },
  editorialPage('/company/organization', 'Organization', 'How the company is structured.'),
  {
    path: '/company/where-we-operate',
    title: 'Where We Operate',
    summary: 'Our corporate footprint across Pakistan.',
    type: 'LANDING',
    blocks: [
      { key: 'HeroMinimal', data: { eyebrow: 'Our company', headline: 'Where we operate', standfirst: 'Our business footprint by region and city.' } },
      { key: 'PakistanFootprint', data: { showCityList: true, metrics: ['restaurants', 'teamMembers', 'firstOpening'] } },
      { key: 'StoryGrid', data: { heading: 'Stories from around the country', kinds: ['EXPANSION', 'STORY'], limit: 3, columns: '3', tone: 'muted' } },
    ],
  },
  editorialPage('/company/timeline', 'Timeline', 'Company milestones by year.', {
    extraBlocks: [{ key: 'Timeline', data: { layout: 'vertical', showMedia: true } }],
  }),
  {
    path: '/company/awards-recognition',
    title: 'Awards & Recognition',
    summary: 'Recognition the company has received.',
    blocks: [
      { key: 'HeroMinimal', data: { eyebrow: 'Our company', headline: 'Awards & recognition' } },
      { key: 'RichText', data: { body: '<p>Awards are managed in the CMS. Only awards the company has actually received are listed.</p>' } },
    ],
  },

  // ===========================================================================
  // C. OUR BUSINESS
  // ===========================================================================
  {
    path: '/company/business',
    title: 'Our Business',
    summary: 'Restaurants, supply chain, digital, technology and quality — the parts that make the company work.',
    type: 'SECTION_INDEX',
    priority: 0.8,
    blocks: [
      {
        key: 'HeroEditorial',
        data: {
          eyebrow: 'Our business',
          headline: 'Behind every restaurant is an operating system',
          standfirst: 'Sourcing, supply chain, restaurants, digital and technology.',
          tone: 'dark',
        },
      },
      {
        key: 'OperationsFlow',
        data: {
          heading: 'How it fits together',
          steps: [
            { label: 'Procurement' },
            { label: 'Supply chain' },
            { label: 'Warehousing' },
            { label: 'Restaurants' },
            { label: 'Digital' },
            { label: 'Customers' },
          ],
        },
      },
      {
        key: 'BusinessPillars',
        data: {
          heading: 'Areas of the business',
          layout: 'editorial',
          tone: 'muted',
          pillars: [
            { title: 'Restaurant Operations', description: 'Running restaurants to a consistent standard.', link: { label: 'Restaurant operations', pageId: 'REF:/company/business/restaurant-operations', opensInNewTab: false } },
            { title: 'Supply Chain', description: 'Procurement, warehousing, cold chain and distribution.', link: { label: 'Supply chain', pageId: 'REF:/company/business/supply-chain', opensInNewTab: false } },
            { title: 'Delivery & Digital', description: 'Ordering, delivery and the digital experience.', link: { label: 'Delivery & digital', pageId: 'REF:/company/business/delivery-digital', opensInNewTab: false } },
            { title: 'Technology', description: 'The systems behind ordering and operations.', link: { label: 'Technology', pageId: 'REF:/company/business/technology', opensInNewTab: false } },
            { title: 'Restaurant Development', description: 'Finding, designing and building restaurants.', link: { label: 'Restaurant development', pageId: 'REF:/company/business/restaurant-development', opensInNewTab: false } },
            { title: 'Food & Quality', description: 'Food safety, quality systems and sourcing.', link: { label: 'Food & quality', pageId: 'REF:/company/food-quality', opensInNewTab: false } },
          ],
        },
      },
      { key: 'StoryGrid', data: { heading: 'Business stories', kinds: ['STORY'], limit: 3, columns: '3' } },
    ],
  },
  editorialPage('/company/business/restaurant-operations', 'Restaurant Operations', 'How restaurants are run, and to what standard.'),
  editorialPage('/company/business/restaurants', 'Our Restaurants', 'The restaurant estate and the formats we operate.'),
  editorialPage('/company/business/delivery-digital', 'Delivery & Digital', 'Ordering, delivery and the digital customer experience.'),
  editorialPage('/company/business/technology', 'Technology', 'The systems that support ordering, restaurants and delivery.', {
    statement:
      'Technology at Cheezious exists to make restaurants work: taking an order, getting it made, getting it to a customer.',
    sections: [
      { heading: 'Customer platforms', body: 'Placeholder copy about the customer app and web ordering.' },
      { heading: 'Restaurant systems', body: 'Placeholder copy about point of sale and kitchen systems.' },
      { heading: 'Data and decisions', body: 'Placeholder copy about how data supports operational decisions.' },
    ],
  }),
  editorialPage('/company/business/supply-chain', 'Supply Chain', 'Procurement, warehousing, cold chain and distribution.', {
    extraBlocks: [
      {
        key: 'SupplierCTA',
        data: {
          eyebrow: 'Suppliers',
          heading: 'Become a Cheezious supplier',
          body: 'We work with suppliers across ingredients, packaging, equipment, logistics and services.',
          primaryLink: { label: 'Register as a supplier', pageId: 'REF:/company/partners/supplier-registration', opensInNewTab: false },
          tone: 'accent',
        },
      },
    ],
  }),
  editorialPage('/company/business/procurement', 'Procurement', 'How we buy, and what we expect from suppliers.'),
  editorialPage('/company/business/food-innovation', 'Food Innovation', 'How new products are developed and tested.'),
  editorialPage('/company/business/restaurant-development', 'Restaurant Development', 'Finding, designing and building restaurants.'),
  editorialPage('/company/business/real-estate', 'Real Estate', 'What we look for in a location, and how to propose one.', {
    extraBlocks: [
      {
        key: 'RealEstateCTA',
        data: {
          eyebrow: 'Real estate',
          heading: 'Have a location for Cheezious?',
          body: 'Tell us about the property and our expansion team will review it.',
          primaryLink: { label: 'Submit a property', pageId: 'REF:/company/partners/submit-property', opensInNewTab: false },
          tone: 'accent',
        },
      },
    ],
  }),
  editorialPage('/company/business/growth-expansion', 'Growth & Expansion', 'How the company is growing.'),

  // ===========================================================================
  // D. FOOD & QUALITY
  // ===========================================================================
  {
    path: '/company/food-quality',
    title: 'Food & Quality',
    summary: 'Food safety, quality systems, sourcing and standards.',
    type: 'SECTION_INDEX',
    blocks: [
      { key: 'HeroEditorial', data: { eyebrow: 'Food & quality', headline: 'Food & Quality', standfirst: 'Food safety, quality systems, sourcing and the standards behind them.', tone: 'dark' } },
      {
        key: 'QualityPillars',
        data: {
          heading: 'Our approach',
          pillars: [
            { title: 'Food safety', description: 'How food safety is managed across the business.', link: { label: 'Food safety', pageId: 'REF:/company/food-quality/food-safety', opensInNewTab: false } },
            { title: 'Sourcing', description: 'How and where ingredients are sourced.', link: { label: 'Sourcing', pageId: 'REF:/company/food-quality/sourcing', opensInNewTab: false } },
            { title: 'Supplier standards', description: 'What we require from suppliers.', link: { label: 'Supplier standards', pageId: 'REF:/company/food-quality/supplier-standards', opensInNewTab: false } },
            { title: 'Restaurant standards', description: 'The standards every restaurant operates to.', link: { label: 'Restaurant standards', pageId: 'REF:/company/food-quality/restaurant-standards', opensInNewTab: false } },
          ],
        },
      },
      { key: 'IngredientGrid', data: { heading: 'Ingredients', columns: '3', tone: 'muted' } },
    ],
  },
  editorialPage('/company/food-quality/our-food', 'Our Food', 'What we make and how we think about it.'),
  editorialPage('/company/food-quality/quality', 'Quality', 'The quality systems behind the food.'),
  editorialPage('/company/food-quality/food-safety', 'Food Safety', 'How food safety is managed across the business.'),
  {
    path: '/company/food-quality/ingredients',
    title: 'Ingredients',
    summary: 'The ingredients we use and where they come from.',
    type: 'SECTION_INDEX',
    blocks: [
      { key: 'HeroMinimal', data: { eyebrow: 'Food & quality', headline: 'Ingredients' } },
      { key: 'IngredientGrid', data: { columns: '3' } },
    ],
  },
  editorialPage('/company/food-quality/sourcing', 'Sourcing', 'How and where we source.'),
  editorialPage('/company/food-quality/supplier-standards', 'Supplier Standards', 'What we require from the suppliers we work with.'),
  editorialPage('/company/food-quality/restaurant-standards', 'Restaurant Standards', 'The standards every restaurant operates to.'),
  editorialPage('/company/food-quality/nutrition-allergens', 'Nutrition & Allergens', 'Nutrition and allergen information.', {
    statement:
      'Nutrition and allergen information is published only where it has been verified. Where a value is not shown, it has not yet been confirmed.',
  }),

  // ===========================================================================
  // E. PEOPLE
  // ===========================================================================
  {
    path: '/company/people',
    title: 'Our People',
    summary: 'The people who run the restaurants, the supply chain and the systems behind them.',
    type: 'SECTION_INDEX',
    priority: 0.8,
    blocks: [
      { key: 'HeroEditorial', data: { eyebrow: 'Our people', headline: 'The people who run it', standfirst: 'Restaurants, kitchens, warehouses, offices and the road in between.', tone: 'dark' } },
      { key: 'EmployeeStoryFeature', data: { fallbackToLatest: true, showCareerTimeline: true } },
      { key: 'StoryGrid', data: { heading: 'People stories', kinds: ['PEOPLE_STORY'], limit: 3, columns: '3', tone: 'muted' } },
      { key: 'CTAEditorial', data: { heading: 'Join us', primaryLink: { label: 'See open roles', pageId: 'REF:/careers', opensInNewTab: false } } },
    ],
  },
  editorialPage('/company/people/culture', 'Culture', 'How we work together.'),
  {
    path: '/company/people/stories',
    title: 'Employee Stories',
    summary: 'Colleagues on their work and their careers.',
    type: 'SECTION_INDEX',
    blocks: [
      { key: 'HeroMinimal', data: { eyebrow: 'Our people', headline: 'Employee stories' } },
      { key: 'StoryGrid', data: { kinds: ['PEOPLE_STORY'], limit: 12, columns: '3' } },
    ],
  },
  editorialPage('/company/people/learning-development', 'Learning & Development', 'How people learn and progress here.'),
  editorialPage('/company/people/life-at-cheezious', 'Life at Cheezious', 'What it is like to work here.'),
  editorialPage('/company/people/recognition', 'Recognition', 'How we recognise good work.'),
  editorialPage('/company/people/workplace', 'Workplace', 'The working environment and the standards behind it.'),

  // ===========================================================================
  // F. CAREERS
  // ===========================================================================
  {
    path: '/careers',
    title: 'Careers',
    summary: 'Restaurant, corporate, technology, supply chain and early-career roles across Pakistan.',
    type: 'LANDING',
    priority: 0.9,
    changeFrequency: 'weekly',
    blocks: [
      {
        key: 'HeroEditorial',
        data: {
          eyebrow: 'Careers',
          headline: 'Grow with Cheezious',
          standfirst: 'Restaurants, supply chain, technology and corporate roles.',
          tone: 'dark',
          primaryLink: { label: 'See open roles', pageId: 'REF:/careers/jobs', opensInNewTab: false },
        },
      },
      { key: 'JobCategories', data: { heading: 'Where you could work', showOpenCount: true, columns: '3' } },
      { key: 'JobSearch', data: { heading: 'Open roles', showFilters: true, pageSize: 10 } },
      { key: 'EmployeeStoryFeature', data: { heading: 'Career stories', fallbackToLatest: true, showCareerTimeline: true, tone: 'muted' } },
      {
        key: 'CareerPath',
        data: {
          heading: 'How careers progress here',
          intro: 'An illustrative progression. Replace with the approved career framework.',
          steps: [
            { title: 'Crew Member', description: 'Learning the operation from the floor up.', durationLabel: 'Year 1' },
            { title: 'Shift Manager', description: 'Running a shift and leading a team.', durationLabel: 'Years 2–3' },
            { title: 'Restaurant Manager', description: 'Accountable for a restaurant end to end.', durationLabel: 'Years 3–5' },
            { title: 'Area Manager', description: 'Supporting several restaurants and their managers.', durationLabel: 'Year 5+' },
          ],
        },
      },
    ],
  },
  editorialPage('/careers/why-cheezious', 'Why Cheezious', 'What we offer, and what we ask.', { priority: 0.7 }),
  {
    path: '/careers/restaurant',
    title: 'Restaurant Careers',
    summary: 'Restaurant management, kitchen, service and delivery roles.',
    blocks: [
      { key: 'HeroMinimal', data: { eyebrow: 'Careers', headline: 'Restaurant careers' } },
      { key: 'JobSearch', data: { categoryId: 'REF:CAREER:RESTAURANT', showFilters: true, pageSize: 10 } },
    ],
  },
  {
    path: '/careers/corporate',
    title: 'Corporate Careers',
    summary: 'Finance, people, marketing, procurement, supply chain and legal roles.',
    blocks: [
      { key: 'HeroMinimal', data: { eyebrow: 'Careers', headline: 'Corporate careers' } },
      { key: 'JobSearch', data: { categoryId: 'REF:CAREER:CORPORATE', showFilters: true, pageSize: 10 } },
    ],
  },
  {
    path: '/careers/technology',
    title: 'Technology Careers',
    summary: 'Engineering, product, data, infrastructure and security roles.',
    blocks: [
      { key: 'HeroMinimal', data: { eyebrow: 'Careers', headline: 'Technology careers' } },
      { key: 'JobSearch', data: { categoryId: 'REF:CAREER:TECHNOLOGY', showFilters: true, pageSize: 10 } },
    ],
  },
  {
    path: '/careers/supply-chain',
    title: 'Supply Chain Careers',
    summary: 'Warehousing, distribution, quality and planning roles.',
    blocks: [
      { key: 'HeroMinimal', data: { eyebrow: 'Careers', headline: 'Supply chain careers' } },
      { key: 'JobSearch', data: { categoryId: 'REF:CAREER:SUPPLY_CHAIN', showFilters: true, pageSize: 10 } },
    ],
  },
  {
    path: '/careers/students-graduates',
    title: 'Students & Graduates',
    summary: 'Internships, graduate programmes and management trainee routes.',
    blocks: [
      { key: 'HeroMinimal', data: { eyebrow: 'Careers', headline: 'Students & graduates' } },
      { key: 'JobSearch', data: { categoryId: 'REF:CAREER:EARLY_CAREERS', showFilters: true, pageSize: 10 } },
    ],
  },
  editorialPage('/careers/internships', 'Internships', 'Internship opportunities across the business.'),
  editorialPage('/careers/career-growth', 'Career Growth', 'How people progress here.'),
  editorialPage('/careers/recruitment-process', 'Recruitment Process', 'What to expect when you apply.', {
    extraBlocks: [
      {
        key: 'FAQ',
        data: {
          heading: 'Common questions',
          emitStructuredData: true,
          items: [
            { question: 'How long does the process take?', answer: '<p>Placeholder answer. Replace with the approved response.</p>' },
            { question: 'Will I hear back if I am unsuccessful?', answer: '<p>Placeholder answer. Replace with the approved response.</p>' },
          ],
        },
      },
    ],
  }),
  {
    path: '/careers/jobs',
    title: 'Open Roles',
    summary: 'Every open role at Cheezious.',
    type: 'SECTION_INDEX',
    priority: 0.9,
    changeFrequency: 'daily',
    blocks: [
      { key: 'HeroMinimal', data: { eyebrow: 'Careers', headline: 'Open roles', standfirst: 'Search and filter every role we are currently hiring for.' } },
      { key: 'JobSearch', data: { showFilters: true, pageSize: 20 } },
    ],
  },

  // ===========================================================================
  // G. IMPACT
  // ===========================================================================
  {
    path: '/company/impact',
    title: 'Our Impact',
    summary: 'People, communities, food and planet — what we are working on and how we measure it.',
    type: 'SECTION_INDEX',
    priority: 0.8,
    blocks: [
      { key: 'HeroEditorial', data: { eyebrow: 'Impact', headline: 'Our Impact', standfirst: 'What we are working on, and the measures we hold ourselves to.', tone: 'dark' } },
      { key: 'ImpactPillars', data: { showMetrics: true, layout: 'editorial' } },
      { key: 'ImpactMetrics', data: { heading: 'Where we are', showTargets: true, columns: '3', tone: 'muted' } },
      { key: 'StoryGrid', data: { heading: 'Impact stories', kinds: ['STORY'], limit: 3, columns: '3' } },
      { key: 'ReportGrid', data: { heading: 'Reporting', limit: 3, columns: '3', tone: 'muted' } },
    ],
  },
  editorialPage('/company/impact/community', 'Community', 'Working with the communities we operate in.'),
  editorialPage('/company/impact/youth', 'Youth', 'Programmes and opportunities for young people.'),
  editorialPage('/company/impact/education', 'Education', 'Education and skills initiatives.'),
  editorialPage('/company/impact/food-hunger', 'Food & Hunger', 'Food-related community work.'),
  editorialPage('/company/impact/people', 'People', 'Jobs, training and progression.'),
  editorialPage('/company/impact/environment', 'Environment', 'Energy, water and emissions.'),
  editorialPage('/company/impact/packaging-waste', 'Packaging & Waste', 'Packaging materials and waste.'),
  editorialPage('/company/impact/responsible-sourcing', 'Responsible Sourcing', 'How sourcing decisions are made.'),
  {
    path: '/company/impact/stories',
    title: 'Impact Stories',
    summary: 'Programmes and initiatives in detail.',
    type: 'SECTION_INDEX',
    blocks: [
      { key: 'HeroMinimal', data: { eyebrow: 'Impact', headline: 'Impact stories' } },
      { key: 'StoryGrid', data: { limit: 12, columns: '3' } },
    ],
  },

  // ===========================================================================
  // H. PARTNERS
  // ===========================================================================
  {
    path: '/company/partners',
    title: 'Partner With Us',
    summary: 'Suppliers, property partners and institutional partnerships.',
    type: 'SECTION_INDEX',
    priority: 0.8,
    blocks: [
      { key: 'HeroEditorial', data: { eyebrow: 'Partners', headline: 'Partner with Cheezious', standfirst: 'Suppliers, property partners and institutions.', tone: 'dark' } },
      { key: 'SupplierCTA', data: { heading: 'Suppliers', body: 'Ingredients, packaging, equipment, logistics and services.', primaryLink: { label: 'Register as a supplier', pageId: 'REF:/company/partners/supplier-registration', opensInNewTab: false } } },
      { key: 'RealEstateCTA', data: { heading: 'Real estate', body: 'Propose a location for a new restaurant.', primaryLink: { label: 'Submit a property', pageId: 'REF:/company/partners/submit-property', opensInNewTab: false }, tone: 'muted' } },
      { key: 'PartnerCTA', data: { heading: 'Institutional partnerships', body: 'Universities, banks, technology companies, developers and community organisations.', primaryLink: { label: 'Make an enquiry', pageId: 'REF:/company/partners/institutional', opensInNewTab: false } } },
    ],
  },
  editorialPage('/company/partners/suppliers', 'Suppliers', 'How we work with suppliers, and what we look for.', {
    extraBlocks: [
      { key: 'SupplierCTA', data: { heading: 'Register your interest', primaryLink: { label: 'Supplier registration', pageId: 'REF:/company/partners/supplier-registration', opensInNewTab: false }, tone: 'accent' } },
    ],
  }),
  {
    path: '/company/partners/supplier-registration',
    title: 'Supplier Registration',
    summary: 'Register your company as a potential Cheezious supplier.',
    type: 'CONTACT',
    blocks: [
      { key: 'HeroMinimal', data: { eyebrow: 'Partners', headline: 'Become a Cheezious supplier', standfirst: 'Tell us about your company and what you supply. Our procurement team reviews every submission.' } },
      { key: 'FormBlock', data: { formKey: 'SUPPLIER_REGISTRATION', width: 'narrow' } },
    ],
  },
  editorialPage('/company/partners/real-estate', 'Real Estate Partners', 'What we look for in a location.'),
  {
    path: '/company/partners/submit-property',
    title: 'Submit a Property',
    summary: 'Propose a location for a new Cheezious restaurant.',
    type: 'CONTACT',
    blocks: [
      { key: 'HeroMinimal', data: { eyebrow: 'Partners', headline: 'Have a location for Cheezious?', standfirst: 'Tell us about the property. Our expansion team reviews every submission.' } },
      { key: 'FormBlock', data: { formKey: 'PROPERTY_SUBMISSION', width: 'narrow' } },
    ],
  },
  {
    path: '/company/partners/institutional',
    title: 'Institutional Partnerships',
    summary: 'Partnership enquiries from universities, banks, brands and organisations.',
    type: 'CONTACT',
    blocks: [
      { key: 'HeroMinimal', data: { eyebrow: 'Partners', headline: 'Institutional partnerships' } },
      { key: 'FormBlock', data: { formKey: 'PARTNERSHIP_ENQUIRY', width: 'narrow' } },
    ],
  },
  {
    path: '/company/partners/business-enquiries',
    title: 'Business Enquiries',
    summary: 'General business enquiries.',
    type: 'CONTACT',
    blocks: [
      { key: 'HeroMinimal', data: { eyebrow: 'Partners', headline: 'Business enquiries' } },
      { key: 'ContactDirectory', data: { entries: [{ title: 'Corporate enquiries', description: 'General questions about the company.' }] } },
    ],
  },

  // ===========================================================================
  // I. GOVERNANCE
  // ===========================================================================
  {
    path: '/company/governance',
    title: 'Governance',
    summary: 'How the company is governed, and the policies that apply.',
    type: 'SECTION_INDEX',
    priority: 0.6,
    blocks: [
      { key: 'HeroMinimal', data: { eyebrow: 'Governance', headline: 'Corporate Governance', standfirst: 'How the company is governed, and the standards that apply across the business.' } },
      { key: 'RichText', data: { body: '<p>Governance content is published only once it has been approved. Sections showing no content are awaiting approved text.</p>' } },
      { key: 'PolicyList', data: { heading: 'Policies', showLastUpdated: true, showDownload: true, tone: 'muted' } },
    ],
  },
  editorialPage('/company/governance/ethics-integrity', 'Ethics & Integrity', 'The standards we hold ourselves to.', { priority: 0.5 }),
  editorialPage('/company/governance/code-of-conduct', 'Code of Conduct', 'How we expect people to behave.', { priority: 0.5 }),
  editorialPage('/company/governance/supplier-code', 'Supplier Code of Conduct', 'What we require from suppliers.', { priority: 0.5 }),
  {
    path: '/company/governance/policies',
    title: 'Policies',
    summary: 'Company policies and the documents behind them.',
    type: 'DOCUMENT_CENTRE',
    blocks: [
      { key: 'HeroMinimal', data: { eyebrow: 'Governance', headline: 'Policies' } },
      { key: 'PolicyList', data: { showLastUpdated: true, showDownload: true } },
    ],
  },
  editorialPage('/company/governance/speak-up', 'Speak Up', 'How to raise a concern.', { priority: 0.5 }),
  editorialPage('/company/governance/privacy', 'Privacy', 'How we handle personal information.', { priority: 0.5 }),
  editorialPage('/company/governance/information-security', 'Information Security', 'How we protect information.', { priority: 0.5 }),

  // ===========================================================================
  // J. NEWSROOM
  // ===========================================================================
  {
    path: '/company/newsroom',
    title: 'Newsroom',
    summary: 'Company news, press releases, stories and media resources.',
    type: 'SECTION_INDEX',
    priority: 0.9,
    changeFrequency: 'daily',
    blocks: [
      { key: 'HeroMinimal', data: { eyebrow: 'Newsroom', headline: 'Newsroom', standfirst: 'Company news, press releases and stories.' } },
      { key: 'StoryFeature', data: { fallbackToLatest: true, layout: 'split' } },
      { key: 'NewsGrid', data: { heading: 'Latest news', limit: 6, columns: '3' } },
      { key: 'PressReleaseList', data: { heading: 'Press releases', limit: 5, showYearFilter: false, tone: 'muted' } },
      { key: 'CTAEditorial', data: { heading: 'Media centre', body: 'Fact sheets, brand assets, leadership photography and media contacts.', primaryLink: { label: 'Visit the media centre', pageId: 'REF:/company/newsroom/media-center', opensInNewTab: false } } },
    ],
  },
  {
    path: '/company/newsroom/news',
    title: 'Company News',
    summary: 'Announcements and updates from the company.',
    type: 'SECTION_INDEX',
    blocks: [
      { key: 'HeroMinimal', data: { eyebrow: 'Newsroom', headline: 'Company news' } },
      { key: 'NewsGrid', data: { limit: 12, columns: '3' } },
    ],
  },
  {
    path: '/company/newsroom/press-releases',
    title: 'Press Releases',
    summary: 'Official press releases.',
    type: 'SECTION_INDEX',
    blocks: [
      { key: 'HeroMinimal', data: { eyebrow: 'Newsroom', headline: 'Press releases' } },
      { key: 'PressReleaseList', data: { limit: 20, showYearFilter: true } },
    ],
  },
  {
    path: '/company/newsroom/stories',
    title: 'Stories',
    summary: 'Longer-form stories about the company and its work.',
    type: 'SECTION_INDEX',
    blocks: [
      { key: 'HeroMinimal', data: { eyebrow: 'Newsroom', headline: 'Stories' } },
      { key: 'StoryGrid', data: { kinds: ['STORY'], limit: 12, columns: '3' } },
    ],
  },
  {
    path: '/company/newsroom/people',
    title: 'People Stories',
    summary: 'Stories about the people who work here.',
    blocks: [
      { key: 'HeroMinimal', data: { eyebrow: 'Newsroom', headline: 'People' } },
      { key: 'StoryGrid', data: { kinds: ['PEOPLE_STORY'], limit: 12, columns: '3' } },
    ],
  },
  {
    path: '/company/newsroom/expansion',
    title: 'Expansion News',
    summary: 'New restaurants, new cities and growth news.',
    blocks: [
      { key: 'HeroMinimal', data: { eyebrow: 'Newsroom', headline: 'Expansion' } },
      { key: 'StoryGrid', data: { kinds: ['EXPANSION'], limit: 12, columns: '3' } },
    ],
  },
  {
    path: '/company/newsroom/media-coverage',
    title: 'Media Coverage',
    summary: 'Cheezious in the press.',
    blocks: [
      { key: 'HeroMinimal', data: { eyebrow: 'Newsroom', headline: 'Media coverage' } },
      { key: 'RichText', data: { body: '<p>Third-party coverage is listed here as it is published.</p>' } },
    ],
  },
  {
    path: '/company/newsroom/media-center',
    title: 'Media Center',
    summary: 'Everything a journalist needs: fact sheet, boilerplate, leadership biographies, photography and contacts.',
    type: 'LANDING',
    priority: 0.7,
    blocks: [
      { key: 'HeroMinimal', data: { eyebrow: 'Newsroom', headline: 'Media centre', standfirst: 'Company information, approved assets and media contacts.' } },
      { key: 'RichText', data: { heading: 'About Cheezious', body: '<p>The approved corporate boilerplate is managed in the CMS and appears here.</p>' } },
      { key: 'MediaDownloadGrid', data: { heading: 'Brand assets', showFileMeta: true, columns: '3', tone: 'muted' } },
      { key: 'LeadershipGrid', data: { heading: 'Leadership', columns: '4', linkToProfiles: true } },
      { key: 'ContactDirectory', data: { heading: 'Media contacts', entries: [{ title: 'Press office', description: 'For media enquiries.' }] } },
      { key: 'ReportGrid', data: { heading: 'Company publications', limit: 4, columns: '4' } },
    ],
  },
  {
    path: '/company/newsroom/media-contacts',
    title: 'Media Contacts',
    summary: 'Who to contact for media enquiries.',
    type: 'CONTACT',
    blocks: [
      { key: 'HeroMinimal', data: { eyebrow: 'Newsroom', headline: 'Media contacts' } },
      { key: 'ContactDirectory', data: { entries: [{ title: 'Press office', description: 'For media enquiries.' }] } },
    ],
  },
  {
    path: '/company/newsroom/media-library',
    title: 'Media Library',
    summary: 'Approved photography and assets for media use.',
    type: 'DOCUMENT_CENTRE',
    blocks: [
      { key: 'HeroMinimal', data: { eyebrow: 'Newsroom', headline: 'Media library' } },
      { key: 'MediaDownloadGrid', data: { showFileMeta: true, columns: '3' } },
    ],
  },
  {
    path: '/company/newsroom/fact-sheet',
    title: 'Fact Sheet',
    summary: 'Key company information in one place.',
    blocks: [
      { key: 'HeroMinimal', data: { eyebrow: 'Newsroom', headline: 'Fact sheet' } },
      {
        key: 'KPIGrid',
        data: {
          heading: 'Company figures',
          columns: '3',
          statistics: [
            { value: '—', label: 'Founded', isPlaceholder: true, animate: false },
            { value: '—', label: 'Restaurants', isPlaceholder: true, animate: false },
            { value: '—', label: 'Cities', isPlaceholder: true, animate: false },
          ],
        },
      },
      { key: 'RichText', data: { heading: 'Boilerplate', body: '<p>The approved corporate boilerplate is managed in the CMS.</p>' } },
    ],
  },
  {
    path: '/company/newsroom/brand-assets',
    title: 'Brand Assets',
    summary: 'Logos and brand assets, with usage guidance.',
    type: 'DOCUMENT_CENTRE',
    blocks: [
      { key: 'HeroMinimal', data: { eyebrow: 'Newsroom', headline: 'Brand assets' } },
      { key: 'MediaDownloadGrid', data: { showFileMeta: true, columns: '3' } },
    ],
  },

  // ===========================================================================
  // K. RESOURCES
  // ===========================================================================
  {
    path: '/company/resources',
    title: 'Corporate Resources',
    summary: 'Company profile, fact sheets, reports, policies and downloads.',
    type: 'DOCUMENT_CENTRE',
    priority: 0.7,
    blocks: [
      { key: 'HeroMinimal', data: { eyebrow: 'Resources', headline: 'Corporate resources', standfirst: 'Company publications, reports and policies.' } },
      { key: 'DocumentLibrary', data: { showFilters: true, filters: ['year', 'type', 'language'], layout: 'rows' } },
    ],
  },
  {
    path: '/company/resources/publications',
    title: 'Publications',
    summary: 'Every company publication.',
    type: 'DOCUMENT_CENTRE',
    blocks: [
      { key: 'HeroMinimal', data: { eyebrow: 'Resources', headline: 'Publications' } },
      { key: 'DocumentLibrary', data: { showFilters: true, layout: 'rows' } },
    ],
  },
  editorialPage('/company/resources/company-profile', 'Company Profile', 'An overview of the company.'),
  editorialPage('/company/resources/fact-sheet', 'Fact Sheet', 'Key company information.'),
  {
    path: '/company/resources/impact-reports',
    title: 'Impact Reports',
    summary: 'Impact and community reporting.',
    type: 'DOCUMENT_CENTRE',
    blocks: [
      { key: 'HeroMinimal', data: { eyebrow: 'Resources', headline: 'Impact reports' } },
      { key: 'ReportGrid', data: { limit: 12, columns: '3' } },
    ],
  },
  {
    path: '/company/resources/policies',
    title: 'Policy Library',
    summary: 'Company policies.',
    type: 'DOCUMENT_CENTRE',
    blocks: [
      { key: 'HeroMinimal', data: { eyebrow: 'Resources', headline: 'Policies' } },
      { key: 'PolicyList', data: { showLastUpdated: true, showDownload: true } },
    ],
  },
  {
    path: '/company/resources/downloads',
    title: 'Downloads',
    summary: 'Documents and assets available to download.',
    type: 'DOCUMENT_CENTRE',
    blocks: [
      { key: 'HeroMinimal', data: { eyebrow: 'Resources', headline: 'Downloads' } },
      { key: 'DocumentLibrary', data: { showFilters: true, layout: 'rows' } },
    ],
  },

  // ===========================================================================
  // L. CONTACT
  // ===========================================================================
  {
    path: '/company/contact',
    title: 'Contact',
    summary: 'Routed contact points for customers, media, careers, suppliers and property partners.',
    type: 'CONTACT',
    priority: 0.7,
    blocks: [
      { key: 'HeroMinimal', data: { eyebrow: 'Contact', headline: 'Contact Cheezious', standfirst: 'Choose the route that fits your enquiry so it reaches the right team.' } },
      {
        key: 'ContactDirectory',
        data: {
          entries: [
            { title: 'Customer care', description: 'Questions or feedback about a visit or an order.' },
            { title: 'Media enquiries', description: 'For journalists and media organisations.' },
            { title: 'Careers', description: 'Questions about applying or a live application.' },
            { title: 'Suppliers', description: 'Supplying Cheezious.' },
            { title: 'Real estate', description: 'Proposing a location.' },
            { title: 'Corporate', description: 'Anything else.' },
          ],
        },
      },
      { key: 'FormBlock', data: { formKey: 'CONTACT', width: 'narrow', heading: 'Send us a message' } },
    ],
  },
  { path: '/company/contact/customer', title: 'Customer Care', summary: 'Questions or feedback about a restaurant visit or an order.', type: 'CONTACT', blocks: [{ key: 'HeroMinimal', data: { eyebrow: 'Contact', headline: 'Customer care' } }, { key: 'FormBlock', data: { formKey: 'CONTACT', width: 'narrow' } }] },
  { path: '/company/contact/media', title: 'Media Enquiries', summary: 'For journalists and media organisations.', type: 'CONTACT', blocks: [{ key: 'HeroMinimal', data: { eyebrow: 'Contact', headline: 'Media enquiries' } }, { key: 'ContactDirectory', data: { entries: [{ title: 'Press office' }] } }, { key: 'FormBlock', data: { formKey: 'CONTACT', width: 'narrow' } }] },
  { path: '/company/contact/careers', title: 'Careers Enquiries', summary: 'Questions about applying or a live application.', type: 'CONTACT', blocks: [{ key: 'HeroMinimal', data: { eyebrow: 'Contact', headline: 'Careers enquiries' } }, { key: 'FormBlock', data: { formKey: 'CONTACT', width: 'narrow' } }] },
  { path: '/company/contact/suppliers', title: 'Supplier Enquiries', summary: 'Questions about supplying Cheezious.', type: 'CONTACT', blocks: [{ key: 'HeroMinimal', data: { eyebrow: 'Contact', headline: 'Supplier enquiries' } }, { key: 'FormBlock', data: { formKey: 'CONTACT', width: 'narrow' } }] },
  { path: '/company/contact/real-estate', title: 'Real Estate Enquiries', summary: 'Questions about proposing a location.', type: 'CONTACT', blocks: [{ key: 'HeroMinimal', data: { eyebrow: 'Contact', headline: 'Real estate enquiries' } }, { key: 'FormBlock', data: { formKey: 'CONTACT', width: 'narrow' } }] },

  // ===========================================================================
  // Utility pages
  // ===========================================================================
  {
    path: '/search',
    title: 'Search',
    summary: 'Search the corporate site.',
    type: 'SYSTEM',
    excludeFromSitemap: true,
    noindex: true,
    blocks: [{ key: 'HeroMinimal', data: { eyebrow: 'Search', headline: 'Search', showBreadcrumb: false } }],
  },
];
