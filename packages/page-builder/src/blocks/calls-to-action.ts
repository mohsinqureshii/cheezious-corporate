import { z } from 'zod';

import { baseBlock, headingText, linkRef, mediaRef, width } from '../shared';

/** Calls to action. Each maps to a real business process, not generic marketing. */

export const ctaEditorial = baseBlock.extend({
  body: z.string().max(800).optional(),
  image: mediaRef.optional(),
  primaryLink: linkRef,
  secondaryLink: linkRef.optional(),
  width: width.default('standard'),
});

export const ctaBand = baseBlock.extend({
  headline: headingText,
  body: z.string().max(400).optional(),
  primaryLink: linkRef,
  secondaryLink: linkRef.optional(),
  tone: baseBlock.shape.tone.default('accent'),
});

/** Routes to the supplier registration flow. */
export const supplierCta = ctaEditorial.extend({
  showCategories: z.boolean().default(true),
});

/** Routes to the property submission flow. */
export const realEstateCta = ctaEditorial.extend({
  showCriteria: z.boolean().default(true),
});

/** Routes to institutional partnership enquiries. */
export const partnerCta = ctaEditorial;

/** Embeds a CMS-defined form directly into a page. */
export const formBlock = baseBlock.extend({
  formKey: z.string().min(1).max(64),
  width: width.default('narrow'),
  successHeading: headingText.optional(),
});
