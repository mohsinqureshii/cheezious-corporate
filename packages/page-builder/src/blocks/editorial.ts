import { z } from 'zod';

import {
  alignment,
  aspectRatio,
  baseBlock,
  headingText,
  linkRef,
  mediaPosition,
  mediaRef,
  quote,
  richText,
  width,
} from '../shared';

/** Editorial composition blocks — the backbone of corporate storytelling. */

export const richTextBlock = baseBlock.extend({
  body: richText,
  width: width.default('narrow'),
  align: alignment,
});

export const twoColumnText = baseBlock.extend({
  left: richText,
  right: richText,
  width: width.default('standard'),
});

export const threeColumnEditorial = baseBlock.extend({
  columns: z
    .array(
      z.object({
        heading: headingText.optional(),
        body: richText,
        link: linkRef.optional(),
      }),
    )
    .min(2)
    .max(3),
});

export const editorialSplit = baseBlock.extend({
  body: richText,
  image: mediaRef,
  mediaPosition,
  aspectRatio: aspectRatio.default('4:5'),
  /** Lets the image break the grid for a more editorial composition. */
  overlapGrid: z.boolean().default(false),
  links: z.array(linkRef).max(3).default([]),
});

export const editorialImageText = editorialSplit.extend({
  mediaPosition: mediaPosition.default('left'),
});
export const editorialTextImage = editorialSplit.extend({
  mediaPosition: mediaPosition.default('right'),
});

export const fullBleedImage = z.object({
  image: mediaRef,
  aspectRatio: aspectRatio.default('21:9'),
  caption: z.string().max(400).optional(),
  /** Optional text laid over the image. */
  overlayHeading: headingText.optional(),
  overlayBody: z.string().max(600).optional(),
});

export const fullBleedVideo = z.object({
  poster: mediaRef,
  video: mediaRef.optional(),
  videoUrl: z.string().url().optional(),
  caption: z.string().max(400).optional(),
  autoplay: z.boolean().default(false),
});

export const quoteBlock = baseBlock.extend({ quote });

export const leadershipQuote = baseBlock.extend({
  quote,
  personId: z.string().optional(),
  link: linkRef.optional(),
});

export const accordion = baseBlock.extend({
  items: z
    .array(z.object({ question: z.string().min(1).max(300), answer: richText }))
    .min(1)
    .max(30),
  /** Allow more than one panel open at a time. */
  allowMultiple: z.boolean().default(false),
});

export const faq = accordion.extend({
  /** Emits FAQPage structured data. Only enable where the content is a genuine
   *  question-and-answer list, otherwise it is structured-data abuse. */
  emitStructuredData: z.boolean().default(false),
});

export const spacer = z.object({
  size: z.enum(['small', 'medium', 'large']).default('medium'),
  showRule: z.boolean().default(false),
});
