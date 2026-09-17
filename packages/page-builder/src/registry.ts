import { type z } from 'zod';

import * as cta from './blocks/calls-to-action';
import * as collections from './blocks/collections';
import * as data from './blocks/data';
import * as editorial from './blocks/editorial';
import * as hero from './blocks/hero';

/**
 * The block registry.
 *
 * Every block the page builder offers is declared exactly once, here, with its
 * schema, its editor metadata and where it is allowed to be used. The CMS editor
 * UI, the public renderer, the seed and the validation layer all read from this
 * single source, so a new block cannot be half-added.
 */

export type BlockCategory =
  | 'hero'
  | 'editorial'
  | 'data'
  | 'people'
  | 'collections'
  | 'media'
  | 'careers'
  | 'cta'
  | 'utility';

export interface BlockDefinitionSpec {
  key: string;
  name: string;
  description: string;
  category: BlockCategory;
  /** Lucide icon name used in the CMS block picker. */
  icon: string;
  schema: z.ZodTypeAny;
  /** Blocks limited to particular page types. Empty means "anywhere". */
  allowedPageTypes?: string[];
  /** At most one per page (heroes, for instance). */
  singleton?: boolean;
  /** Renders edge-to-edge; the renderer skips the standard container. */
  fullBleed?: boolean;
  sortOrder: number;
}

function spec(
  key: string,
  name: string,
  description: string,
  category: BlockCategory,
  icon: string,
  schema: z.ZodTypeAny,
  extra: Partial<BlockDefinitionSpec> = {},
): BlockDefinitionSpec {
  return { key, name, description, category, icon, schema, sortOrder: 0, ...extra };
}

export const BLOCK_SPECS: BlockDefinitionSpec[] = [
  // --- Heroes --------------------------------------------------------------
  spec(
    'HeroEditorial',
    'Editorial hero',
    'Large headline over a full-bleed image. The default page opening.',
    'hero',
    'LayoutPanelTop',
    hero.heroEditorial,
    { singleton: true, fullBleed: true },
  ),
  spec(
    'HeroMedia',
    'Media hero',
    'Headline paired with a photograph, either overlaid or side by side.',
    'hero',
    'Image',
    hero.heroMedia,
    { singleton: true, fullBleed: true },
  ),
  spec(
    'HeroVideo',
    'Video hero',
    'Looping video with a required poster image for slow connections and reduced motion.',
    'hero',
    'Video',
    hero.heroVideo,
    { singleton: true, fullBleed: true },
  ),
  spec(
    'HeroMinimal',
    'Minimal hero',
    'Typographic opening for governance, policy and document pages.',
    'hero',
    'Type',
    hero.heroMinimal,
    { singleton: true },
  ),
  spec(
    'IntroStatement',
    'Intro statement',
    'A single large paragraph that sets up the page.',
    'editorial',
    'AlignLeft',
    hero.introStatement,
  ),

  // --- Editorial -----------------------------------------------------------
  spec(
    'RichText',
    'Rich text',
    'Formatted body copy at a controlled reading width.',
    'editorial',
    'FileText',
    editorial.richTextBlock,
  ),
  spec(
    'TwoColumnText',
    'Two-column text',
    'Two parallel columns of body copy.',
    'editorial',
    'Columns2',
    editorial.twoColumnText,
  ),
  spec(
    'ThreeColumnEditorial',
    'Three-column editorial',
    'Two or three short editorial columns with optional links.',
    'editorial',
    'Columns3',
    editorial.threeColumnEditorial,
  ),
  spec(
    'EditorialSplit',
    'Editorial split',
    'Copy and photography side by side, with an option to break the grid.',
    'editorial',
    'SplitSquareHorizontal',
    editorial.editorialSplit,
  ),
  spec(
    'EditorialImageText',
    'Image and text',
    'Image on the left, copy on the right.',
    'editorial',
    'PanelLeft',
    editorial.editorialImageText,
  ),
  spec(
    'EditorialTextImage',
    'Text and image',
    'Copy on the left, image on the right.',
    'editorial',
    'PanelRight',
    editorial.editorialTextImage,
  ),
  spec(
    'FullBleedImage',
    'Full-bleed image',
    'Edge-to-edge photography with an optional overlaid caption.',
    'media',
    'Maximize',
    editorial.fullBleedImage,
    { fullBleed: true },
  ),
  spec(
    'FullBleedVideo',
    'Full-bleed video',
    'Edge-to-edge video with a poster image.',
    'media',
    'Film',
    editorial.fullBleedVideo,
    { fullBleed: true },
  ),
  spec(
    'QuoteBlock',
    'Quote',
    'A pulled quote set in large editorial type.',
    'editorial',
    'Quote',
    editorial.quoteBlock,
  ),
  spec(
    'LeadershipQuote',
    'Leadership quote',
    'A quote attributed to a leadership profile, with portrait.',
    'people',
    'MessageSquareQuote',
    editorial.leadershipQuote,
  ),
  spec(
    'Accordion',
    'Accordion',
    'Collapsible sections for dense reference content.',
    'editorial',
    'ChevronsUpDown',
    editorial.accordion,
  ),
  spec(
    'FAQ',
    'FAQ',
    'Question and answer list, optionally emitting FAQPage structured data.',
    'editorial',
    'HelpCircle',
    editorial.faq,
  ),
  spec(
    'Spacer',
    'Spacer',
    'Controlled vertical space, with an optional rule.',
    'utility',
    'Minus',
    editorial.spacer,
  ),

  // --- Data ----------------------------------------------------------------
  spec(
    'KPIGrid',
    'KPI grid',
    'A grid of headline company figures.',
    'data',
    'Grid3x3',
    data.kpiGrid,
  ),
  spec(
    'KPIBand',
    'KPI band',
    'A full-width band of figures on a dark surface.',
    'data',
    'Rows3',
    data.kpiBand,
    { fullBleed: true },
  ),
  spec(
    'KPIEditorial',
    'KPI editorial',
    'One dominant figure carrying an explanatory paragraph.',
    'data',
    'TrendingUp',
    data.kpiEditorial,
  ),
  spec(
    'BusinessPillars',
    'Business pillars',
    'The parts of the business, as titled pillars.',
    'data',
    'Layers',
    data.businessPillars,
  ),
  spec(
    'OperationsFlow',
    'Operations flow',
    'A sequential process, from sourcing through to the customer.',
    'data',
    'GitBranch',
    data.operationsFlow,
  ),
  spec(
    'QualityPillars',
    'Quality pillars',
    'Food quality and safety principles as pillars.',
    'data',
    'ShieldCheck',
    data.qualityPillars,
  ),
  spec(
    'ImpactPillars',
    'Impact pillars',
    'Live impact pillars pulled from the impact module.',
    'data',
    'Sprout',
    data.impactPillars,
  ),
  spec(
    'ImpactMetrics',
    'Impact metrics',
    'Measured impact figures with optional targets.',
    'data',
    'BarChart3',
    data.impactMetrics,
  ),
  spec(
    'ImpactProgress',
    'Impact progress',
    'Progress against published impact targets.',
    'data',
    'Target',
    data.impactProgress,
  ),
  spec(
    'Timeline',
    'Timeline',
    'The corporate timeline, full or filtered by year.',
    'data',
    'History',
    data.timeline,
  ),
  spec(
    'MilestoneTimeline',
    'Milestone timeline',
    'A short timeline of selected milestones.',
    'data',
    'Flag',
    data.milestoneTimeline,
  ),
  spec(
    'RegionMap',
    'Region map',
    'Interactive corporate footprint by region and city.',
    'data',
    'Map',
    data.regionMap,
  ),
  spec(
    'PakistanFootprint',
    'Pakistan footprint',
    'The national corporate footprint, with an accessible list fallback.',
    'data',
    'MapPin',
    data.pakistanFootprint,
  ),
  spec(
    'LogoWall',
    'Logo wall',
    'A restrained grid of partner or certification marks.',
    'media',
    'Building2',
    data.logoWall,
  ),
  spec(
    'IngredientGrid',
    'Ingredient grid',
    'Ingredients with sourcing and quality information.',
    'collections',
    'Wheat',
    data.ingredientGrid,
  ),
  spec(
    'ContactDirectory',
    'Contact directory',
    'Routed contact points rather than one generic form.',
    'cta',
    'Contact',
    data.contactDirectory,
  ),

  // --- Collections ---------------------------------------------------------
  spec(
    'StoryGrid',
    'Story grid',
    'A grid of stories, curated or queried.',
    'collections',
    'LayoutGrid',
    collections.storyGrid,
  ),
  spec(
    'StoryFeature',
    'Story feature',
    'One story presented at full editorial scale.',
    'collections',
    'Star',
    collections.storyFeature,
  ),
  spec(
    'StoryCarousel',
    'Story carousel',
    'A horizontally scrolling set of stories.',
    'collections',
    'GalleryHorizontal',
    collections.storyCarousel,
  ),
  spec(
    'NewsGrid',
    'News grid',
    'Latest company news.',
    'collections',
    'Newspaper',
    collections.newsGrid,
  ),
  spec(
    'PressReleaseList',
    'Press release list',
    'Press releases with an optional year filter.',
    'collections',
    'ScrollText',
    collections.pressReleaseList,
  ),
  spec(
    'LeadershipGrid',
    'Leadership grid',
    'Leadership profiles grouped by leadership group.',
    'people',
    'Users',
    collections.leadershipGrid,
  ),
  spec(
    'LeadershipFeature',
    'Leadership feature',
    'A single leader presented at scale.',
    'people',
    'UserRound',
    collections.leadershipFeature,
  ),
  spec(
    'PeopleGrid',
    'People grid',
    'A grid of people profiles.',
    'people',
    'UsersRound',
    collections.peopleGrid,
  ),
  spec(
    'EmployeeStoryFeature',
    'Employee story',
    'An employee journey, with career timeline.',
    'people',
    'Route',
    collections.employeeStoryFeature,
  ),
  spec(
    'EmployeeStoryGrid',
    'Employee story grid',
    'Employee stories as cards.',
    'people',
    'UsersRound',
    collections.employeeStoryGrid,
  ),
  spec(
    'ImpactStoryGrid',
    'Impact story grid',
    'Impact stories as cards, optionally limited to one pillar.',
    'collections',
    'Sprout',
    collections.impactStoryGrid,
  ),
  spec(
    'ReportGrid',
    'Report grid',
    'Reports and publications as cards.',
    'collections',
    'FileBarChart',
    collections.reportGrid,
  ),
  spec(
    'DocumentLibrary',
    'Document library',
    'A filterable document centre.',
    'collections',
    'Library',
    collections.documentLibrary,
  ),
  spec(
    'PolicyList',
    'Policy list',
    'Policies with version and last-updated information.',
    'collections',
    'FileCheck',
    collections.policyList,
  ),
  spec(
    'MediaGallery',
    'Media gallery',
    'A gallery of photography.',
    'media',
    'Images',
    collections.mediaGallery,
  ),
  spec(
    'MediaDownloadGrid',
    'Media downloads',
    'Downloadable press and brand assets. Only public assets are served.',
    'media',
    'Download',
    collections.mediaDownloadGrid,
  ),
  spec(
    'RelatedContent',
    'Related content',
    'Related pages, stories and documents.',
    'collections',
    'Link2',
    collections.relatedContent,
  ),

  // --- Careers -------------------------------------------------------------
  spec(
    'JobSearch',
    'Job search',
    'Searchable, filterable list of open roles.',
    'careers',
    'Search',
    collections.jobSearch,
  ),
  spec(
    'JobCategories',
    'Job categories',
    'Career paths with live open-role counts.',
    'careers',
    'FolderTree',
    collections.jobCategories,
  ),
  spec(
    'CareerPath',
    'Career path',
    'A progression path through the organisation.',
    'careers',
    'TrendingUp',
    collections.careerPath,
  ),

  // --- Calls to action -----------------------------------------------------
  spec(
    'CTAEditorial',
    'Editorial call to action',
    'A call to action with supporting copy and imagery.',
    'cta',
    'MousePointerClick',
    cta.ctaEditorial,
  ),
  spec(
    'CTABand',
    'Call-to-action band',
    'A full-width band with a single clear action.',
    'cta',
    'RectangleHorizontal',
    cta.ctaBand,
    { fullBleed: true },
  ),
  spec(
    'SupplierCTA',
    'Supplier call to action',
    'Routes to supplier registration.',
    'cta',
    'Truck',
    cta.supplierCta,
  ),
  spec(
    'RealEstateCTA',
    'Real-estate call to action',
    'Routes to property submission.',
    'cta',
    'Building',
    cta.realEstateCta,
  ),
  spec(
    'PartnerCTA',
    'Partnership call to action',
    'Routes to institutional partnership enquiries.',
    'cta',
    'Handshake',
    cta.partnerCta,
  ),
  spec(
    'FormBlock',
    'Form',
    'Embeds a form defined in the CMS.',
    'cta',
    'ClipboardList',
    cta.formBlock,
  ),
].map((definition, index) => ({ ...definition, sortOrder: index }));

export const BLOCK_KEYS = BLOCK_SPECS.map((b) => b.key);
export type BlockKey = (typeof BLOCK_KEYS)[number];

const BY_KEY = new Map(BLOCK_SPECS.map((b) => [b.key, b]));

export function getBlockSpec(key: string): BlockDefinitionSpec | undefined {
  return BY_KEY.get(key);
}

export function isBlockKey(key: string): boolean {
  return BY_KEY.has(key);
}

export function blocksByCategory(): Record<BlockCategory, BlockDefinitionSpec[]> {
  const out = {} as Record<BlockCategory, BlockDefinitionSpec[]>;
  for (const block of BLOCK_SPECS) (out[block.category] ??= []).push(block);
  return out;
}

export interface BlockValidationSuccess {
  ok: true;
  key: string;
  data: Record<string, unknown>;
}

export interface BlockValidationFailure {
  ok: false;
  key: string;
  errors: Array<{ field: string; message: string }>;
}

/**
 * Validate one block's props against its schema.
 *
 * This runs server-side before a page is saved. An invalid block is rejected
 * rather than stored, so the public renderer never has to defend against
 * malformed block data at request time.
 */
export function validateBlock(
  key: string,
  data: unknown,
): BlockValidationSuccess | BlockValidationFailure {
  const definition = BY_KEY.get(key);
  if (!definition) {
    return { ok: false, key, errors: [{ field: '_block', message: `Unknown block type: ${key}` }] };
  }

  const result = definition.schema.safeParse(data ?? {});
  if (!result.success) {
    return {
      ok: false,
      key,
      errors: result.error.issues.map((issue) => ({
        field: issue.path.join('.') || '_root',
        message: issue.message,
      })),
    };
  }

  return { ok: true, key, data: result.data as Record<string, unknown> };
}

/** Default props for a freshly inserted block, derived from its schema. */
export function defaultBlockData(key: string): Record<string, unknown> {
  const definition = BY_KEY.get(key);
  if (!definition) return {};
  const result = definition.schema.safeParse({});
  return result.success ? (result.data as Record<string, unknown>) : {};
}

export interface PageBlockInput {
  blockKey: string;
  data: unknown;
  sortOrder?: number;
  isHidden?: boolean;
  label?: string;
  anchor?: string;
}

export interface PageCompositionResult {
  ok: boolean;
  errors: Array<{ index: number; blockKey: string; field: string; message: string }>;
  blocks: Array<{ blockKey: string; data: Record<string, unknown>; sortOrder: number }>;
}

/**
 * Validate a whole page composition, enforcing both per-block schemas and
 * page-level rules (singletons, hero placement).
 */
export function validateComposition(blocks: PageBlockInput[]): PageCompositionResult {
  const errors: PageCompositionResult['errors'] = [];
  const valid: PageCompositionResult['blocks'] = [];
  const seenSingletons = new Set<string>();

  blocks.forEach((block, index) => {
    const definition = BY_KEY.get(block.blockKey);

    if (definition?.singleton) {
      if (seenSingletons.has(block.blockKey)) {
        errors.push({
          index,
          blockKey: block.blockKey,
          field: '_block',
          message: `Only one ${definition.name} is allowed per page.`,
        });
        return;
      }
      seenSingletons.add(block.blockKey);

      // A hero that is not the first block is almost always an editing mistake.
      if (definition.category === 'hero' && index !== 0) {
        errors.push({
          index,
          blockKey: block.blockKey,
          field: '_block',
          message: `${definition.name} must be the first block on the page.`,
        });
        return;
      }
    }

    const result = validateBlock(block.blockKey, block.data);
    if (result.ok) {
      valid.push({
        blockKey: block.blockKey,
        data: result.data,
        sortOrder: block.sortOrder ?? index,
      });
    } else {
      for (const error of result.errors) {
        errors.push({ index, blockKey: block.blockKey, ...error });
      }
    }
  });

  return { ok: errors.length === 0, errors, blocks: valid };
}

/** Collect every media asset id referenced anywhere in a block tree. */
export function collectMediaReferences(data: unknown, found = new Set<string>()): Set<string> {
  if (!data || typeof data !== 'object') return found;

  if (Array.isArray(data)) {
    for (const item of data) collectMediaReferences(item, found);
    return found;
  }

  const record = data as Record<string, unknown>;
  if (typeof record.assetId === 'string' && record.assetId) found.add(record.assetId);
  for (const key of ['assetIds', 'imageIds']) {
    const value = record[key];
    if (Array.isArray(value)) for (const id of value) if (typeof id === 'string') found.add(id);
  }
  for (const value of Object.values(record)) collectMediaReferences(value, found);

  return found;
}

/** Collect every internal page id referenced by links in a block tree. */
export function collectPageReferences(data: unknown, found = new Set<string>()): Set<string> {
  if (!data || typeof data !== 'object') return found;

  if (Array.isArray(data)) {
    for (const item of data) collectPageReferences(item, found);
    return found;
  }

  const record = data as Record<string, unknown>;
  if (typeof record.pageId === 'string' && record.pageId) found.add(record.pageId);
  for (const value of Object.values(record)) collectPageReferences(value, found);

  return found;
}

/**
 * Flatten a block tree to plain text.
 *
 * Used to build the search index and to derive a meta description when an editor
 * has not written one.
 */
export function extractTextFromBlocks(
  blocks: Array<{ blockKey: string; data: Record<string, unknown> }>,
): string {
  const parts: string[] = [];

  const walk = (value: unknown, depth = 0): void => {
    if (depth > 12 || value == null) return;
    if (typeof value === 'string') {
      // Skip identifiers and enum-like tokens; keep human-readable prose.
      if (value.length > 2 && /\s/.test(value)) parts.push(value);
      return;
    }
    if (Array.isArray(value)) {
      for (const item of value) walk(item, depth + 1);
      return;
    }
    if (typeof value === 'object') {
      for (const [key, nested] of Object.entries(value as Record<string, unknown>)) {
        if (['assetId', 'pageId', 'externalUrl', 'icon', 'tone', 'spacing', 'width'].includes(key))
          continue;
        walk(nested, depth + 1);
      }
    }
  };

  for (const block of blocks) walk(block.data);
  return parts.join(' ').replace(/\s+/g, ' ').trim();
}
