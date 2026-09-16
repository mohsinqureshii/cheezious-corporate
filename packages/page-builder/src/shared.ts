import { z } from 'zod';

/**
 * Shared block primitives.
 *
 * The page builder is deliberately *not* an unrestricted layout tool. Editors
 * choose from named design-system options — `tone`, `width`, `emphasis` — rather
 * than arbitrary colours, fonts and pixel values. That is what keeps sixty
 * corporate pages looking like one company rather than sixty templates.
 */

/** Media reference. Blocks store an asset id; URLs are resolved at render time. */
export const mediaRef = z.object({
  assetId: z.string().min(1),
  /** Per-use override; falls back to the asset's own alt text when absent. */
  altText: z.string().max(300).optional(),
  caption: z.string().max(500).optional(),
  credit: z.string().max(200).optional(),
});
export type MediaRef = z.infer<typeof mediaRef>;

/**
 * Link reference. Internal links carry a page id rather than a URL so that
 * renaming a page cannot break them.
 */
export const linkRef = z
  .object({
    label: z.string().min(1).max(120),
    pageId: z.string().optional(),
    externalUrl: z.string().url().optional(),
    opensInNewTab: z.boolean().default(false),
  })
  .refine((v) => Boolean(v.pageId) !== Boolean(v.externalUrl), {
    message: 'Choose either an internal page or an external URL, not both.',
  });
export type LinkRef = z.infer<typeof linkRef>;

export const richText = z.string().max(50_000);
export const headingText = z.string().max(200);
export const eyebrowText = z.string().max(80);

/** Surface treatment. Constrained to the corporate palette, not free colour. */
export const tone = z.enum(['light', 'muted', 'dark', 'accent']).default('light');
export type Tone = z.infer<typeof tone>;

/** Horizontal measure. Editorial text is never allowed to run full-bleed. */
export const width = z.enum(['narrow', 'standard', 'wide', 'full']).default('standard');

/** Vertical rhythm between sections. */
export const spacing = z.enum(['compact', 'standard', 'generous']).default('standard');

export const alignment = z.enum(['start', 'center']).default('start');

export const mediaPosition = z.enum(['left', 'right']).default('right');

/** Aspect ratios chosen to match how corporate photography is actually shot. */
export const aspectRatio = z.enum(['16:9', '4:3', '3:2', '1:1', '4:5', '21:9']).default('3:2');

export const baseBlock = z.object({
  /** Section heading rendered above the block content. */
  eyebrow: eyebrowText.optional(),
  heading: headingText.optional(),
  intro: z.string().max(1200).optional(),
  tone,
  spacing,
});

/** A statistic. `value` is a string so the CMS can express "12,000+" or "1.2M". */
export const statistic = z.object({
  value: z.string().min(1).max(24),
  prefix: z.string().max(8).optional(),
  suffix: z.string().max(16).optional(),
  label: z.string().min(1).max(120),
  description: z.string().max(300).optional(),
  /** Set when the figure is seeded demo data rather than approved company data. */
  isPlaceholder: z.boolean().default(false),
  /** Enables the count-up animation. Ignored under prefers-reduced-motion. */
  animate: z.boolean().default(true),
});
export type Statistic = z.infer<typeof statistic>;

export const pillar = z.object({
  title: z.string().min(1).max(120),
  description: z.string().max(600).optional(),
  icon: z.string().max(40).optional(),
  image: mediaRef.optional(),
  link: linkRef.optional(),
});

export const quote = z.object({
  text: z.string().min(1).max(1200),
  attribution: z.string().max(160).optional(),
  role: z.string().max(160).optional(),
  portrait: mediaRef.optional(),
});
