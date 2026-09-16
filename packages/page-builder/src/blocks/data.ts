import { z } from 'zod';

import { baseBlock, headingText, linkRef, mediaRef, pillar, statistic, width } from '../shared';

/** Data-led blocks: statistics, pillars, process flows and the footprint map. */

export const kpiGrid = baseBlock.extend({
  statistics: z.array(statistic).min(1).max(12),
  columns: z.enum(['2', '3', '4']).default('3'),
  showDividers: z.boolean().default(true),
});

/** Full-width band of headline figures. */
export const kpiBand = baseBlock.extend({
  statistics: z.array(statistic).min(2).max(6),
  tone: baseBlock.shape.tone.default('dark'),
});

/** A single dominant figure carrying an editorial paragraph. */
export const kpiEditorial = baseBlock.extend({
  statistic,
  body: z.string().max(1200).optional(),
  link: linkRef.optional(),
});

export const businessPillars = baseBlock.extend({
  pillars: z.array(pillar).min(2).max(8),
  layout: z.enum(['grid', 'list', 'editorial']).default('grid'),
});

export const operationsFlow = baseBlock.extend({
  steps: z
    .array(
      z.object({
        label: z.string().min(1).max(80),
        description: z.string().max(400).optional(),
        icon: z.string().max(40).optional(),
        image: mediaRef.optional(),
      }),
    )
    .min(3)
    .max(8),
  orientation: z.enum(['horizontal', 'vertical']).default('horizontal'),
});

export const qualityPillars = businessPillars;
export const impactPillars = baseBlock.extend({
  /** Pulls live pillars from the impact module rather than duplicating copy. */
  pillarIds: z.array(z.string()).max(8).default([]),
  showMetrics: z.boolean().default(true),
  layout: z.enum(['grid', 'editorial']).default('grid'),
});

export const impactMetrics = baseBlock.extend({
  metricIds: z.array(z.string()).max(12).default([]),
  year: z.number().int().min(1990).max(2100).optional(),
  showTargets: z.boolean().default(true),
  columns: z.enum(['2', '3', '4']).default('3'),
});

export const impactProgress = baseBlock.extend({
  metricIds: z.array(z.string()).min(1).max(8),
  /** Renders progress against target. Only metrics with an approved target and
   *  value are shown; the rest are omitted rather than shown as zero. */
  showMethodology: z.boolean().default(true),
});

export const timeline = baseBlock.extend({
  /** Empty means "all published events"; otherwise a curated subset. */
  eventIds: z.array(z.string()).max(60).default([]),
  fromYear: z.number().int().optional(),
  toYear: z.number().int().optional(),
  layout: z.enum(['vertical', 'horizontal']).default('vertical'),
  showMedia: z.boolean().default(true),
});

export const milestoneTimeline = timeline.extend({ limit: z.number().int().min(2).max(12).default(5) });

export const regionMap = baseBlock.extend({
  /** The corporate footprint map — business presence, not a restaurant locator. */
  regionIds: z.array(z.string()).max(20).default([]),
  showCityList: z.boolean().default(true),
  /** Metrics rendered per city, only where an approved value exists. */
  metrics: z.array(z.enum(['restaurants', 'teamMembers', 'firstOpening'])).default(['restaurants']),
});

export const pakistanFootprint = regionMap;

export const logoWall = baseBlock.extend({
  logos: z.array(z.object({ image: mediaRef, name: z.string().max(120), url: z.string().url().optional() })).min(2).max(30),
  grayscale: z.boolean().default(true),
});

export const ingredientGrid = baseBlock.extend({
  ingredientIds: z.array(z.string()).max(24).default([]),
  categoryId: z.string().optional(),
  columns: z.enum(['2', '3', '4']).default('3'),
});

export const contactDirectory = baseBlock.extend({
  entries: z
    .array(
      z.object({
        title: headingText,
        description: z.string().max(400).optional(),
        email: z.string().email().optional(),
        phone: z.string().max(40).optional(),
        link: linkRef.optional(),
      }),
    )
    .min(1)
    .max(12),
  width: width.default('standard'),
});
