import { z } from 'zod';

import {
  alignment,
  aspectRatio,
  baseBlock,
  eyebrowText,
  headingText,
  linkRef,
  mediaRef,
  tone,
} from '../shared';

/**
 * Hero blocks.
 *
 * Four variants rather than one configurable hero, because a corporate landing
 * page, an editorial section index and a policy page genuinely need different
 * compositions — and naming them stops editors from building a fifth by hand.
 */

export const heroEditorial = z.object({
  eyebrow: eyebrowText.optional(),
  headline: headingText,
  standfirst: z.string().max(600).optional(),
  /** Overlay heroes let the sticky header sit transparently over the image. */
  overlayHeader: z.boolean().default(true),
  image: mediaRef.optional(),
  aspectRatio: aspectRatio.default('21:9'),
  primaryLink: linkRef.optional(),
  secondaryLink: linkRef.optional(),
  tone: tone.default('dark'),
  align: alignment,
});

export const heroMedia = z.object({
  eyebrow: eyebrowText.optional(),
  headline: headingText,
  standfirst: z.string().max(600).optional(),
  image: mediaRef,
  aspectRatio: aspectRatio.default('16:9'),
  /** Where the text sits relative to the image. */
  layout: z.enum(['overlay', 'below', 'split']).default('overlay'),
  primaryLink: linkRef.optional(),
  tone: tone.default('dark'),
});

export const heroVideo = z.object({
  eyebrow: eyebrowText.optional(),
  headline: headingText,
  standfirst: z.string().max(600).optional(),
  /** Poster is required: it is what renders before the video loads, on slow
   *  connections, and for anyone using reduced motion. */
  poster: mediaRef,
  video: mediaRef.optional(),
  videoUrl: z.string().url().optional(),
  autoplay: z.boolean().default(true),
  loop: z.boolean().default(true),
  primaryLink: linkRef.optional(),
  tone: tone.default('dark'),
});

/** Typographic hero for governance, policy and document pages. */
export const heroMinimal = z.object({
  eyebrow: eyebrowText.optional(),
  headline: headingText,
  standfirst: z.string().max(600).optional(),
  showBreadcrumb: z.boolean().default(true),
  tone: tone.default('light'),
});

export const introStatement = baseBlock.extend({
  statement: z.string().min(1).max(1200),
  attribution: z.string().max(160).optional(),
  link: linkRef.optional(),
});
