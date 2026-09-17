import type { Locale } from '@cheezious/config';
import { Fragment, type ReactNode } from 'react';

import {
  getCareerCategories,
  getEmployeeStories,
  getImpactStories,
  getFootprint,
  getImpact,
  getJobs,
  getLeadership,
  getPolicies,
  getPressReleases,
  getReports,
  getStories,
  getTimeline,
  type MediaImage,
  type PageBlock,
} from '@/lib/content';

import {
  CareerPath,
  EmployeeStoryGrid,
  ImpactStoryGrid,
  JobCategories,
  LeadershipGrid,
  PolicyList,
  PressReleaseList,
  ReportGrid,
  StoryFeature,
  StoryGrid,
} from './collections';
import { CTABand, CTAEditorial, ContactDirectory, FormBlock } from './cta';
import {
  BusinessPillars,
  KPIBand,
  KPIEditorial,
  KPIGrid,
  OperationsFlow,
  PakistanFootprint,
  Timeline,
} from './data';
import {
  Accordion,
  EditorialSplit,
  FullBleedImage,
  QuoteBlock,
  RelatedContent,
  RichTextBlock,
  Spacer,
  ThreeColumnEditorial,
  TwoColumnText,
} from './editorial';
import {
  HeroEditorial,
  HeroMedia,
  HeroMinimal,
  HeroVideo,
  IntroStatement,
  type BlockContext,
} from './heroes';
import { ImpactMetrics, ImpactPillars, JobSearchBlock } from './impact-and-jobs';

/**
 * Block renderer.
 *
 * Two responsibilities:
 *
 *   1. **Resolve data.** Collection blocks declare what they want (six published
 *      stories, the leadership groups); this loads it. Requests are issued in
 *      parallel across the whole page rather than serially per block, so a
 *      homepage with eight data-driven sections costs one round of queries, not
 *      eight.
 *
 *   2. **Fail safely.** An unknown block type, or a block whose data could not
 *      be loaded, renders nothing. A single bad block must never take down the
 *      page it sits on.
 */

export interface BlockRendererProps {
  blocks: PageBlock[];
  locale: Locale;
  images: Map<string, MediaImage>;
  pathById: Map<string, string>;
  related?: Array<{ title: string; href: string; eyebrow?: string; summary?: string }>;
  /**
   * Rendered immediately after the first block. Used for breadcrumbs on pages
   * whose hero is full-bleed: the trail still belongs on the page, but placing it
   * above a cinematic hero would break the opening.
   */
  afterFirstBlock?: ReactNode;
}

/** Data a page's blocks collectively need, loaded once. */
interface ResolvedData {
  stories: Map<string, Awaited<ReturnType<typeof getStories>>['items']>;
  pressReleases?: Awaited<ReturnType<typeof getPressReleases>>['items'];
  leadership?: Awaited<ReturnType<typeof getLeadership>>['groups'];
  timeline?: Awaited<ReturnType<typeof getTimeline>>['events'];
  footprint?: Awaited<ReturnType<typeof getFootprint>>['regions'];
  impact?: Awaited<ReturnType<typeof getImpact>>['pillars'];
  reports?: Awaited<ReturnType<typeof getReports>>['items'];
  policies?: Awaited<ReturnType<typeof getPolicies>>['categories'];
  jobs?: Awaited<ReturnType<typeof getJobs>>;
  careerCategories?: Awaited<ReturnType<typeof getCareerCategories>>['categories'];
  employeeStories?: Awaited<ReturnType<typeof getEmployeeStories>>['items'];
  impactStories?: Awaited<ReturnType<typeof getImpactStories>>['items'];
  employeeStoryList?: Awaited<ReturnType<typeof getEmployeeStories>>['items'];
}

/**
 * Inspect the page's blocks and load exactly what they need.
 *
 * A page with no story grid never queries stories. Everything that is needed is
 * requested concurrently, and a failed load degrades that one block rather than
 * the page.
 */
async function resolveBlockData(blocks: PageBlock[], locale: Locale): Promise<ResolvedData> {
  const keys = new Set(blocks.map((block) => block.blockKey));
  const data: ResolvedData = { stories: new Map() };

  const tasks: Array<Promise<void>> = [];

  const safely = async (label: string, run: () => Promise<void>): Promise<void> => {
    try {
      await run();
    } catch (error) {
      // A collection that cannot load renders as absent. Logging keeps it
      // visible in operations without breaking the page for a visitor.
      console.error(`[BlockRenderer] failed to load data for ${label}:`, error);
    }
  };

  const storyBlocks = blocks.filter((block) =>
    ['StoryGrid', 'StoryCarousel', 'NewsGrid', 'StoryFeature'].includes(block.blockKey),
  );

  for (const block of storyBlocks) {
    tasks.push(
      safely(block.blockKey, async () => {
        const kinds = (block.data.kinds as string[] | undefined)?.join(',');
        const result = await getStories(locale, {
          kind: kinds,
          category: block.data.categoryId as string | undefined,
          featured: block.data.featuredOnly === true ? true : undefined,
          pageSize: (block.data.limit as number) ?? 6,
        });
        data.stories.set(`${block.blockKey}:${block.sortOrder}`, result.items);
      }),
    );
  }

  if (keys.has('PressReleaseList')) {
    tasks.push(
      safely('PressReleaseList', async () => {
        const result = await getPressReleases(locale, { pageSize: 10 });
        data.pressReleases = result.items as never;
      }),
    );
  }

  if (keys.has('LeadershipGrid') || keys.has('PeopleGrid') || keys.has('LeadershipFeature')) {
    tasks.push(
      safely('LeadershipGrid', async () => {
        data.leadership = (await getLeadership(locale)).groups;
      }),
    );
  }

  if (keys.has('Timeline') || keys.has('MilestoneTimeline')) {
    tasks.push(
      safely('Timeline', async () => {
        data.timeline = (await getTimeline(locale)).events;
      }),
    );
  }

  if (keys.has('RegionMap') || keys.has('PakistanFootprint')) {
    tasks.push(
      safely('PakistanFootprint', async () => {
        data.footprint = (await getFootprint(locale)).regions;
      }),
    );
  }

  if (keys.has('ImpactPillars') || keys.has('ImpactMetrics') || keys.has('ImpactProgress')) {
    tasks.push(
      safely('Impact', async () => {
        data.impact = (await getImpact(locale)).pillars;
      }),
    );
  }

  if (keys.has('ImpactStoryGrid')) {
    tasks.push(
      safely('ImpactStoryGrid', async () => {
        // The pillar filter is a block setting rather than a query parameter:
        // the page decides what it is about, not the visitor.
        const pillar = blocks.find((block) => block.blockKey === 'ImpactStoryGrid')?.data
          ?.pillarSlug;
        data.impactStories = (
          await getImpactStories(locale, {
            pageSize: 12,
            ...(typeof pillar === 'string' && pillar ? { pillar } : {}),
          })
        ).items;
      }),
    );
  }

  if (keys.has('ReportGrid') || keys.has('DocumentLibrary')) {
    tasks.push(
      safely('ReportGrid', async () => {
        data.reports = (await getReports(locale, { pageSize: 12 })).items;
      }),
    );
  }

  if (keys.has('PolicyList')) {
    tasks.push(
      safely('PolicyList', async () => {
        data.policies = (await getPolicies(locale)).categories;
      }),
    );
  }

  if (keys.has('JobSearch')) {
    const jobBlock = blocks.find((block) => block.blockKey === 'JobSearch');
    tasks.push(
      safely('JobSearch', async () => {
        data.jobs = await getJobs(locale, {
          category: jobBlock?.data.categoryId as string | undefined,
          department: jobBlock?.data.departmentId as string | undefined,
          location: jobBlock?.data.locationId as string | undefined,
          pageSize: (jobBlock?.data.pageSize as number) ?? 10,
        });
      }),
    );
  }

  if (keys.has('JobCategories')) {
    tasks.push(
      safely('JobCategories', async () => {
        data.careerCategories = (await getCareerCategories(locale)).categories;
      }),
    );
  }

  if (keys.has('EmployeeStoryGrid')) {
    tasks.push(
      safely('EmployeeStoryGrid', async () => {
        data.employeeStoryList = (await getEmployeeStories(locale, { pageSize: 12 })).items;
      }),
    );
  }

  if (keys.has('EmployeeStoryFeature')) {
    tasks.push(
      safely('EmployeeStoryFeature', async () => {
        data.employeeStories = (await getEmployeeStories(locale, { pageSize: 3 })).items;
      }),
    );
  }

  await Promise.all(tasks);
  return data;
}

export async function BlockRenderer({
  blocks,
  locale,
  images,
  pathById,
  related,
  afterFirstBlock,
}: BlockRendererProps) {
  const sorted = [...blocks].sort((a, b) => a.sortOrder - b.sortOrder);
  const data = await resolveBlockData(sorted, locale);

  return (
    <>
      {sorted.map((block, index) => {
        const context: BlockContext = { locale, images, pathById, isFirst: index === 0 };
        const key = `${block.blockKey}-${block.sortOrder}`;
        const anchor = block.anchor ?? undefined;

        const rendered = renderBlock(block, context, data, related);
        if (!rendered) return null;

        // Anchors are wrapped rather than injected into every block component,
        // so linking to a section is uniform across all 60 block types.
        const wrapped = anchor ? (
          <div id={anchor} className="scroll-mt-[calc(var(--header-height)+2rem)]">
            {rendered}
          </div>
        ) : (
          <div>{rendered}</div>
        );

        return (
          <Fragment key={key}>
            {wrapped}
            {index === 0 ? afterFirstBlock : null}
          </Fragment>
        );
      })}
    </>
  );
}

function renderBlock(
  block: PageBlock,
  context: BlockContext,
  data: ResolvedData,
  related?: BlockRendererProps['related'],
) {
  const props = { data: block.data, context };
  const storyKey = `${block.blockKey}:${block.sortOrder}`;

  switch (block.blockKey) {
    // --- Heroes -------------------------------------------------------------
    case 'HeroEditorial':
      return <HeroEditorial {...props} />;
    case 'HeroMedia':
      return <HeroMedia {...props} />;
    case 'HeroVideo':
      return <HeroVideo {...props} />;
    case 'HeroMinimal':
      return <HeroMinimal {...props} />;
    case 'IntroStatement':
      return <IntroStatement {...props} />;

    // --- Editorial ----------------------------------------------------------
    case 'RichText':
      return <RichTextBlock {...props} />;
    case 'TwoColumnText':
      return <TwoColumnText {...props} />;
    case 'ThreeColumnEditorial':
      return <ThreeColumnEditorial {...props} />;
    case 'EditorialSplit':
    case 'EditorialImageText':
    case 'EditorialTextImage':
      return <EditorialSplit {...props} />;
    case 'FullBleedImage':
      return <FullBleedImage {...props} />;
    case 'QuoteBlock':
    case 'LeadershipQuote':
      return <QuoteBlock {...props} />;
    case 'Accordion':
    case 'FAQ':
      return <Accordion {...props} />;
    case 'Spacer':
      return <Spacer {...props} />;
    case 'RelatedContent':
      return <RelatedContent {...props} related={related} />;

    // --- Data ---------------------------------------------------------------
    case 'KPIGrid':
      return <KPIGrid {...props} />;
    case 'KPIBand':
      return <KPIBand {...props} />;
    case 'KPIEditorial':
      return <KPIEditorial {...props} />;
    case 'BusinessPillars':
    case 'QualityPillars':
      return <BusinessPillars {...props} />;
    case 'OperationsFlow':
      return <OperationsFlow {...props} />;
    case 'Timeline':
    case 'MilestoneTimeline':
      return <Timeline {...props} events={(data.timeline ?? []) as never} />;
    case 'RegionMap':
    case 'PakistanFootprint':
      return <PakistanFootprint {...props} regions={(data.footprint ?? []) as never} />;
    case 'ImpactPillars':
      return <ImpactPillars {...props} pillars={(data.impact ?? []) as never} />;
    case 'ImpactMetrics':
    case 'ImpactProgress':
      return <ImpactMetrics {...props} pillars={(data.impact ?? []) as never} />;

    // --- Collections --------------------------------------------------------
    case 'StoryGrid':
    case 'StoryCarousel':
    case 'NewsGrid':
      return <StoryGrid {...props} stories={data.stories.get(storyKey) ?? []} />;
    case 'StoryFeature':
      return <StoryFeature {...props} story={data.stories.get(storyKey)?.[0] ?? null} />;
    case 'PressReleaseList':
      return <PressReleaseList {...props} releases={(data.pressReleases ?? []) as never} />;
    case 'LeadershipGrid':
    case 'PeopleGrid':
      return <LeadershipGrid {...props} groups={data.leadership ?? []} />;
    case 'EmployeeStoryGrid':
      return <EmployeeStoryGrid {...props} stories={(data.employeeStoryList ?? []) as never} />;
    case 'ImpactStoryGrid':
      return <ImpactStoryGrid {...props} stories={(data.impactStories ?? []) as never} />;
    case 'ReportGrid':
    case 'DocumentLibrary':
      return <ReportGrid {...props} reports={(data.reports ?? []) as never} />;
    case 'PolicyList':
      return <PolicyList {...props} categories={(data.policies ?? []) as never} />;

    // --- Careers ------------------------------------------------------------
    case 'JobSearch':
      return (
        <JobSearchBlock {...props} jobs={data.jobs?.items ?? []} total={data.jobs?.total ?? 0} />
      );
    case 'JobCategories':
      return <JobCategories {...props} categories={data.careerCategories ?? []} />;
    case 'CareerPath':
      return <CareerPath {...props} />;
    case 'EmployeeStoryFeature':
      return (
        <StoryFeature
          {...props}
          section="people"
          story={(data.employeeStories?.[0] ?? null) as never}
        />
      );

    // --- Calls to action ----------------------------------------------------
    case 'CTAEditorial':
    case 'SupplierCTA':
    case 'RealEstateCTA':
    case 'PartnerCTA':
      return <CTAEditorial {...props} />;
    case 'CTABand':
      return <CTABand {...props} />;
    case 'ContactDirectory':
      return <ContactDirectory {...props} />;
    case 'FormBlock':
      return <FormBlock {...props} />;

    default:
      // An unknown block is content the renderer does not understand yet —
      // rendering nothing is correct, and the warning surfaces it in logs.
      console.warn(`[BlockRenderer] no renderer for block type "${block.blockKey}"`);
      return null;
  }
}
