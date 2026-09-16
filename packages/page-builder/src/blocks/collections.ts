import { z } from 'zod';

import { baseBlock, headingText, linkRef, mediaRef, width } from '../shared';

/**
 * Collection blocks pull live content from the structured modules.
 *
 * They never copy content. An editor curates *which* records appear; the titles,
 * images and dates always come from the source record, so a corrected headline
 * propagates everywhere it is featured.
 */

const collectionSource = z.object({
  /** Curated ids take precedence; otherwise the block queries by filter. */
  itemIds: z.array(z.string()).max(24).default([]),
  categoryId: z.string().optional(),
  tagIds: z.array(z.string()).max(10).default([]),
  limit: z.number().int().min(1).max(24).default(6),
  featuredOnly: z.boolean().default(false),
});

export const storyGrid = baseBlock.extend({
  ...collectionSource.shape,
  kinds: z.array(z.enum(['STORY', 'NEWS', 'PEOPLE_STORY', 'EXPANSION'])).default(['STORY']),
  columns: z.enum(['2', '3', '4']).default('3'),
  showExcerpt: z.boolean().default(true),
  viewAllLink: linkRef.optional(),
});

export const storyFeature = baseBlock.extend({
  storyId: z.string().optional(),
  /** When no story is pinned, the most recent featured story is used. */
  fallbackToLatest: z.boolean().default(true),
  layout: z.enum(['split', 'overlay']).default('split'),
});

export const storyCarousel = storyGrid.extend({ itemsPerView: z.enum(['2', '3']).default('3') });

export const newsGrid = storyGrid.extend({ kinds: z.array(z.enum(['NEWS'])).default(['NEWS']) });

export const pressReleaseList = baseBlock.extend({
  ...collectionSource.shape,
  showYearFilter: z.boolean().default(true),
  viewAllLink: linkRef.optional(),
});

export const leadershipGrid = baseBlock.extend({
  groupIds: z.array(z.string()).max(6).default([]),
  personIds: z.array(z.string()).max(40).default([]),
  columns: z.enum(['2', '3', '4']).default('3'),
  showRole: z.boolean().default(true),
  linkToProfiles: z.boolean().default(true),
});

export const leadershipFeature = baseBlock.extend({
  personId: z.string(),
  showQuote: z.boolean().default(true),
  link: linkRef.optional(),
});

export const peopleGrid = leadershipGrid;

export const employeeStoryFeature = baseBlock.extend({
  storyId: z.string().optional(),
  fallbackToLatest: z.boolean().default(true),
  showCareerTimeline: z.boolean().default(true),
});

export const reportGrid = baseBlock.extend({
  ...collectionSource.shape,
  type: z.string().optional(),
  year: z.number().int().optional(),
  columns: z.enum(['2', '3', '4']).default('3'),
  viewAllLink: linkRef.optional(),
});

export const documentLibrary = baseBlock.extend({
  ...collectionSource.shape,
  showFilters: z.boolean().default(true),
  filters: z.array(z.enum(['year', 'type', 'topic', 'language'])).default(['year', 'type']),
  layout: z.enum(['rows', 'cards']).default('rows'),
});

export const policyList = baseBlock.extend({
  categoryId: z.string().optional(),
  policyIds: z.array(z.string()).max(40).default([]),
  showLastUpdated: z.boolean().default(true),
  showDownload: z.boolean().default(true),
});

export const mediaGallery = baseBlock.extend({
  images: z.array(mediaRef).min(1).max(40),
  layout: z.enum(['grid', 'masonry', 'carousel']).default('grid'),
  columns: z.enum(['2', '3', '4']).default('3'),
});

export const mediaDownloadGrid = baseBlock.extend({
  /** Only assets marked PUBLIC_DOWNLOAD are ever served here; the API filters
   *  server-side, so a mis-curated id cannot leak an internal asset. */
  assetIds: z.array(z.string()).max(60).default([]),
  folderId: z.string().optional(),
  showFileMeta: z.boolean().default(true),
  columns: z.enum(['2', '3', '4']).default('3'),
});

export const relatedContent = baseBlock.extend({
  items: z
    .array(
      z.object({
        entityType: z.enum(['page', 'story', 'pressRelease', 'report', 'policy', 'person', 'job']),
        entityId: z.string(),
      }),
    )
    .max(8)
    .default([]),
  /** When empty, related content is derived from shared categories and people. */
  autoDerive: z.boolean().default(true),
  width: width.default('standard'),
});

export const jobSearch = baseBlock.extend({
  /** Pre-applied filters, e.g. a technology careers page. */
  categoryId: z.string().optional(),
  departmentId: z.string().optional(),
  locationId: z.string().optional(),
  showFilters: z.boolean().default(true),
  pageSize: z.number().int().min(5).max(50).default(10),
});

export const jobCategories = baseBlock.extend({
  categoryIds: z.array(z.string()).max(12).default([]),
  showOpenCount: z.boolean().default(true),
  columns: z.enum(['2', '3', '4']).default('3'),
});

export const careerPath = baseBlock.extend({
  steps: z
    .array(
      z.object({
        title: headingText,
        description: z.string().max(500).optional(),
        durationLabel: z.string().max(60).optional(),
      }),
    )
    .min(2)
    .max(8),
});
