import type { Permission } from '@cheezious/permissions';
import { z } from 'zod';

import { audienceSchema, localeField, seoFields } from './editorial';
import type { CollectionConfig, FieldSpec } from './types';

/**
 * Reference collections.
 *
 * Curated lists rather than documents: awards, timeline milestones, categories,
 * departments, locations. Their whole lifecycle is "is this shown, and where in
 * the order", so they carry a publish flag and a sort order instead of an
 * editorial workflow. They are audited and permission-checked exactly like
 * editorial content — the difference is the lifecycle, not the rigour.
 *
 * Impact metrics are the exception worth reading: they are seeded with no values
 * and `isPublishable` false on purpose, because publishing an unverified
 * environmental or community number is a claim the company has not made.
 */

/** Defaults every reference collection shares. */
function reference(config: Partial<CollectionConfig> & Pick<CollectionConfig,
  'path' | 'model' | 'entityType' | 'permissionPrefix' | 'permissions' | 'label' | 'labelPlural' |
  'labelField' | 'searchFields' | 'listSelect' | 'createSchema' | 'updateSchema' | 'fields'
>): CollectionConfig {
  return {
    slugField: 'slug',
    localized: false,
    workflow: false,
    softDelete: false,
    hasPublishedAt: false,
    hasCreatedBy: false,
    hasUpdatedBy: false,
    sortableFields: ['sortOrder', 'updatedAt'],
    defaultSort: 'sortOrder',
    richTextFields: [],
    versionedFields: [],
    auditedFields: ['name', 'slug', 'sortOrder'],
    ...config,
  } as CollectionConfig;
}

// ---------------------------------------------------------------------------
// Taxonomies: name, slug, order, and whichever description column the table has.
//
// These tables were designed for the content that uses them rather than for a
// uniform shape, so each one declares what it actually has. The alternative —
// selecting a column that is not there — is a 500 on a list screen.
// ---------------------------------------------------------------------------

interface TaxonomyShape {
  /** A stable identifier the seed and blocks refer to. Derived from the slug. */
  key: boolean;
  summary: boolean;
  description: boolean;
  timestamps: boolean;
  isPublished: boolean;
}

const NO_EXTRAS: TaxonomyShape = {
  key: true,
  summary: false,
  description: false,
  timestamps: false,
  isPublished: false,
};

function taxonomySchema(shape: TaxonomyShape) {
  return {
    name: z.string().min(1).max(120),
    slug: z.string().max(140).optional(),
    sortOrder: z.number().int().min(0).max(100_000).optional(),
    ...(shape.summary ? { summary: z.string().max(600).nullish() } : {}),
    ...(shape.description ? { description: z.string().max(2000).nullish() } : {}),
    ...(shape.isPublished ? { isPublished: z.boolean().optional() } : {}),
  };
}

function taxonomyFieldsFor(shape: TaxonomyShape): FieldSpec[] {
  return [
    { name: 'name', label: 'Name', type: 'text', required: true, max: 120, group: 'content', inList: true },
    { name: 'slug', label: 'URL slug', type: 'slug', max: 140, group: 'content' },
    ...(shape.summary
      ? [{ name: 'summary', label: 'Summary', type: 'textarea', max: 600, group: 'content' } as FieldSpec]
      : []),
    ...(shape.description
      ? [{ name: 'description', label: 'Description', type: 'textarea', max: 2000, group: 'content' } as FieldSpec]
      : []),
    ...(shape.isPublished
      ? [{ name: 'isPublished', label: 'Published', type: 'boolean', group: 'publishing', inList: true } as FieldSpec]
      : []),
    { name: 'sortOrder', label: 'Order', type: 'number', group: 'publishing', inList: true, help: 'Lower numbers appear first.' },
  ];
}

function taxonomy(options: {
  path: string;
  model: string;
  entityType: string;
  label: string;
  labelPlural: string;
  read: Permission;
  manage: Permission;
  shape?: Partial<TaxonomyShape>;
  extraSelect?: Record<string, unknown>;
}): CollectionConfig {
  const shape: TaxonomyShape = { ...NO_EXTRAS, ...(options.shape ?? {}) };

  return reference({
    path: options.path,
    model: options.model,
    entityType: options.entityType,
    permissionPrefix: options.entityType,
    permissions: {
      read: options.read,
      create: options.manage,
      update: options.manage,
      delete: options.manage,
      publish: options.manage,
    },
    label: options.label,
    labelPlural: options.labelPlural,
    labelField: 'name',
    searchFields: ['name', 'slug'],
    sortableFields: shape.timestamps ? ['sortOrder', 'name', 'updatedAt'] : ['sortOrder', 'name'],
    defaultSort: 'sortOrder',
    deriveKeyFromSlug: shape.key,
    listSelect: {
      id: true,
      name: true,
      slug: true,
      sortOrder: true,
      ...(shape.summary ? { summary: true } : {}),
      ...(shape.description ? { description: true } : {}),
      ...(shape.isPublished ? { isPublished: true } : {}),
      ...(options.extraSelect ?? {}),
    },
    createSchema: z.object(taxonomySchema(shape)).strict(),
    updateSchema: z.object(taxonomySchema(shape)).partial().strict(),
    fields: taxonomyFieldsFor(shape),
  });
}

// ---------------------------------------------------------------------------

const timelineWritable = {
  year: z.number().int().min(1900).max(2200),
  eventDate: z.coerce.date().nullish(),
  headline: z.string().min(1).max(250),
  description: z.string().max(4000).nullish(),
  category: z.string().max(80).nullish(),
  location: z.string().max(160).nullish(),
  mediaId: z.string().cuid().nullish(),
  isFeatured: z.boolean().optional(),
  isPublished: z.boolean().optional(),
  sortOrder: z.number().int().min(0).max(100_000).optional(),
};

const awardWritable = {
  name: z.string().min(1).max(200),
  organisation: z.string().min(1).max(200),
  year: z.number().int().min(1900).max(2200),
  description: z.string().max(2000).nullish(),
  externalUrl: z.string().url().max(400).nullish().or(z.literal('')),
  categoryId: z.string().cuid().nullish(),
  imageId: z.string().cuid().nullish(),
  isFeatured: z.boolean().optional(),
  isPublished: z.boolean().optional(),
  sortOrder: z.number().int().min(0).max(100_000).optional(),
};

const reportWritable = {
  title: z.string().min(1).max(200),
  slug: z.string().max(200).optional(),
  year: z.number().int().min(1900).max(2200),
  type: z.enum(['ANNUAL', 'SUSTAINABILITY', 'GOVERNANCE', 'FINANCIAL', 'IMPACT', 'POLICY', 'FACT_SHEET', 'OTHER']).optional(),
  description: z.string().max(2000).nullish(),
  categoryId: z.string().cuid().nullish(),
  coverId: z.string().cuid().nullish(),
  publicationDate: z.coerce.date().nullish(),
  isFeatured: z.boolean().optional(),
  isPublished: z.boolean().optional(),
  sortOrder: z.number().int().min(0).max(100_000).optional(),
  seoTitle: z.string().max(200).nullish(),
  seoDescription: z.string().max(400).nullish(),
};

const employeeStoryWritable = {
  title: z.string().min(1).max(200),
  slug: z.string().max(200).optional(),
  excerpt: z.string().max(800).nullish(),
  body: z.string().max(100_000).nullish(),
  personId: z.string().cuid().nullish(),
  personName: z.string().max(160).nullish(),
  roleLabel: z.string().max(200).nullish(),
  departmentLabel: z.string().max(160).nullish(),
  locationLabel: z.string().max(160).nullish(),
  portraitId: z.string().cuid().nullish(),
  heroImageId: z.string().cuid().nullish(),
  quote: z.string().max(1000).nullish(),
  isFeatured: z.boolean().optional(),
  isPublished: z.boolean().optional(),
  seoTitle: z.string().max(200).nullish(),
  seoDescription: z.string().max(400).nullish(),
};

const impactMetricWritable = {
  pillarId: z.string().cuid(),
  key: z.string().min(1).max(80),
  name: z.string().min(1).max(200),
  unit: z.string().max(40).nullish(),
  prefix: z.string().max(20).nullish(),
  suffix: z.string().max(20).nullish(),
  description: z.string().max(2000).nullish(),
  methodology: z.string().max(4000).nullish(),
  internalSource: z.string().max(400).nullish(),
  targetValue: z.number().nullish(),
  targetYear: z.number().int().min(1900).max(2200).nullish(),
  isPublishable: z.boolean().optional(),
  sortOrder: z.number().int().min(0).max(100_000).optional(),
};

const impactPillarWritable = {
  name: z.string().min(1).max(120),
  slug: z.string().max(140).optional(),
  summary: z.string().max(600).nullish(),
  description: z.string().max(2000).nullish(),
  icon: z.string().max(40).nullish(),
  isPublished: z.boolean().optional(),
  sortOrder: z.number().int().min(0).max(100_000).optional(),
};

const impactStoryWritable = {
  title: z.string().min(1).max(200),
  slug: z.string().max(200).optional(),
  excerpt: z.string().max(800).nullish(),
  body: z.string().max(100_000).nullish(),
  pillarId: z.string().cuid().nullish(),
  imageId: z.string().cuid().nullish(),
  location: z.string().max(160).nullish(),
  year: z.number().int().min(1900).max(2200).nullish(),
  isFeatured: z.boolean().optional(),
  isPublished: z.boolean().optional(),
  seoTitle: z.string().max(200).nullish(),
  seoDescription: z.string().max(400).nullish(),
};

// ---------------------------------------------------------------------------

export const REFERENCE_COLLECTIONS: CollectionConfig[] = [
  reference({
    path: 'timeline',
    model: 'timelineEvent',
    entityType: 'timelineEvent',
    permissionPrefix: 'timeline',
    permissions: {
      read: 'timeline.manage', create: 'timeline.manage', update: 'timeline.manage',
      delete: 'timeline.manage', publish: 'timeline.manage',
    },
    label: 'Milestone',
    labelPlural: 'Timeline',
    labelField: 'headline',
    slugField: null,
    localized: true,
    publishFlag: 'isPublished',
    searchFields: ['headline', 'description'],
    sortableFields: ['year', 'sortOrder', 'updatedAt'],
    defaultSort: 'year',
    auditedFields: ['headline', 'year', 'isPublished', 'sortOrder'],
    listSelect: {
      id: true, locale: true, year: true, eventDate: true, headline: true, category: true,
      isFeatured: true, isPublished: true, isDemoContent: true, sortOrder: true, updatedAt: true,
    },
    createSchema: z.object({ ...audienceSchema, ...timelineWritable }).strict(),
    updateSchema: z.object(timelineWritable).partial().strict(),
    fields: [
      { name: 'year', label: 'Year', type: 'number', required: true, group: 'content', inList: true },
      { name: 'eventDate', label: 'Exact date', type: 'date', group: 'content', help: 'Optional. Early milestones are often known only to the year.' },
      { name: 'headline', label: 'Headline', type: 'text', required: true, max: 250, group: 'content', inList: true },
      { name: 'description', label: 'Description', type: 'textarea', max: 4000, group: 'content' },
      { name: 'category', label: 'Category', type: 'text', max: 80, group: 'details' },
      { name: 'location', label: 'Location', type: 'text', max: 160, group: 'details' },
      { name: 'mediaId', label: 'Image', type: 'media', group: 'details' },
      localeField,
      { name: 'isFeatured', label: 'Feature this', type: 'boolean', group: 'publishing' },
      { name: 'isPublished', label: 'Published', type: 'boolean', group: 'publishing', inList: true },
      { name: 'sortOrder', label: 'Order within the year', type: 'number', group: 'publishing' },
    ],
  }),

  reference({
    path: 'awards',
    model: 'award',
    entityType: 'award',
    permissionPrefix: 'awards',
    permissions: {
      read: 'awards.manage', create: 'awards.manage', update: 'awards.manage',
      delete: 'awards.manage', publish: 'awards.manage',
    },
    label: 'Award',
    labelPlural: 'Awards',
    labelField: 'name',
    slugField: null,
    localized: true,
    publishFlag: 'isPublished',
    searchFields: ['name', 'organisation'],
    sortableFields: ['year', 'sortOrder', 'updatedAt'],
    defaultSort: 'year',
    auditedFields: ['name', 'organisation', 'year', 'isPublished'],
    listSelect: {
      id: true, locale: true, name: true, organisation: true, year: true,
      isFeatured: true, isPublished: true, isDemoContent: true, sortOrder: true, updatedAt: true,
      category: { select: { id: true, name: true } },
    },
    createSchema: z.object({ ...audienceSchema, ...awardWritable }).strict(),
    updateSchema: z.object(awardWritable).partial().strict(),
    fields: [
      { name: 'name', label: 'Award', type: 'text', required: true, max: 200, group: 'content', inList: true },
      { name: 'organisation', label: 'Awarded by', type: 'text', required: true, max: 200, group: 'content', inList: true, help: 'The body that granted it. Only record awards actually received.' },
      { name: 'year', label: 'Year', type: 'number', required: true, group: 'content', inList: true },
      { name: 'description', label: 'Description', type: 'textarea', max: 2000, group: 'content' },
      { name: 'externalUrl', label: 'Source link', type: 'url', max: 400, group: 'details', help: 'A public reference for the award, where one exists.' },
      { name: 'categoryId', label: 'Category', type: 'reference', collection: 'award-categories', group: 'details' },
      { name: 'imageId', label: 'Image', type: 'media', group: 'details' },
      localeField,
      { name: 'isFeatured', label: 'Feature this', type: 'boolean', group: 'publishing' },
      { name: 'isPublished', label: 'Published', type: 'boolean', group: 'publishing', inList: true },
      { name: 'sortOrder', label: 'Order', type: 'number', group: 'publishing' },
    ],
  }),

  reference({
    path: 'reports',
    model: 'report',
    entityType: 'report',
    permissionPrefix: 'reports',
    permissions: {
      read: 'reports.read', create: 'reports.manage', update: 'reports.manage',
      delete: 'reports.manage', publish: 'reports.manage',
    },
    label: 'Report',
    labelPlural: 'Reports',
    labelField: 'title',
    localized: true,
    publishFlag: 'isPublished',
    searchFields: ['title', 'description', 'slug'],
    sortableFields: ['year', 'publicationDate', 'sortOrder', 'updatedAt'],
    defaultSort: 'year',
    auditedFields: ['title', 'year', 'type', 'isPublished', 'publicationDate'],
    listSelect: {
      id: true, locale: true, title: true, slug: true, year: true, type: true,
      publicationDate: true, isFeatured: true, isPublished: true, isDemoContent: true,
      sortOrder: true, updatedAt: true,
      category: { select: { id: true, name: true } },
      _count: { select: { files: true } },
    },
    createSchema: z.object({ ...audienceSchema, ...reportWritable }).strict(),
    updateSchema: z.object(reportWritable).partial().strict(),
    fields: [
      { name: 'title', label: 'Title', type: 'text', required: true, max: 200, group: 'content', inList: true },
      { name: 'slug', label: 'URL slug', type: 'slug', max: 200, group: 'content' },
      { name: 'year', label: 'Year', type: 'number', required: true, group: 'content', inList: true },
      {
        name: 'type', label: 'Type', type: 'select', group: 'content', inList: true,
        options: [
          { value: 'ANNUAL', label: 'Annual report' },
          { value: 'SUSTAINABILITY', label: 'Sustainability report' },
          { value: 'GOVERNANCE', label: 'Governance' },
          { value: 'FINANCIAL', label: 'Financial' },
          { value: 'IMPACT', label: 'Impact' },
          { value: 'POLICY', label: 'Policy' },
          { value: 'FACT_SHEET', label: 'Fact sheet' },
          { value: 'OTHER', label: 'Other' },
        ],
      },
      { name: 'description', label: 'Description', type: 'textarea', max: 2000, group: 'content' },
      { name: 'categoryId', label: 'Category', type: 'reference', collection: 'report-categories', group: 'details' },
      { name: 'coverId', label: 'Cover image', type: 'media', group: 'details' },
      localeField,
      { name: 'publicationDate', label: 'Published on', type: 'date', group: 'publishing' },
      { name: 'isFeatured', label: 'Feature this', type: 'boolean', group: 'publishing' },
      { name: 'isPublished', label: 'Published', type: 'boolean', group: 'publishing', inList: true },
      { name: 'sortOrder', label: 'Order', type: 'number', group: 'publishing' },
      ...seoFields,
    ],
  }),

  reference({
    path: 'employee-stories',
    model: 'employeeStory',
    entityType: 'employeeStory',
    permissionPrefix: 'employeeStories',
    permissions: {
      read: 'employeeStories.manage', create: 'employeeStories.manage', update: 'employeeStories.manage',
      delete: 'employeeStories.manage', publish: 'employeeStories.manage',
    },
    label: 'Employee story',
    labelPlural: 'Employee stories',
    labelField: 'title',
    localized: true,
    publishFlag: 'isPublished',
    searchFields: ['title', 'excerpt', 'personName', 'slug'],
    sortableFields: ['updatedAt', 'publishedAt', 'title'],
    defaultSort: 'updatedAt',
    richTextFields: ['body'],
    auditedFields: ['title', 'personId', 'isPublished'],
    listSelect: {
      id: true, locale: true, title: true, slug: true, personName: true, roleLabel: true,
      isFeatured: true, isPublished: true, isDemoContent: true, publishedAt: true, updatedAt: true,
      person: { select: { id: true, name: true } },
    },
    createSchema: z.object({ ...audienceSchema, ...employeeStoryWritable }).strict(),
    updateSchema: z.object(employeeStoryWritable).partial().strict(),
    fields: [
      { name: 'title', label: 'Title', type: 'text', required: true, max: 200, group: 'content', inList: true },
      { name: 'slug', label: 'URL slug', type: 'slug', max: 200, group: 'content' },
      { name: 'excerpt', label: 'Standfirst', type: 'textarea', max: 800, group: 'content' },
      { name: 'body', label: 'Body', type: 'richtext', group: 'content' },
      { name: 'quote', label: 'Pull quote', type: 'textarea', max: 1000, group: 'content' },
      { name: 'personId', label: 'Person record', type: 'reference', collection: 'people', group: 'details', help: 'Optional. A story can feature someone without a full profile.' },
      { name: 'personName', label: 'Name', type: 'text', max: 160, group: 'details', inList: true, help: 'Only publish a colleague’s name and story with their consent.' },
      { name: 'roleLabel', label: 'Role', type: 'text', max: 200, group: 'details' },
      { name: 'departmentLabel', label: 'Department', type: 'text', max: 160, group: 'details' },
      { name: 'locationLabel', label: 'Location', type: 'text', max: 160, group: 'details' },
      { name: 'portraitId', label: 'Portrait', type: 'media', group: 'details' },
      { name: 'heroImageId', label: 'Hero image', type: 'media', group: 'details' },
      localeField,
      { name: 'isFeatured', label: 'Feature this', type: 'boolean', group: 'publishing' },
      { name: 'isPublished', label: 'Published', type: 'boolean', group: 'publishing', inList: true },
      ...seoFields,
    ],
  }),

  reference({
    path: 'impact-metrics',
    model: 'impactMetric',
    entityType: 'impactMetric',
    permissionPrefix: 'impact',
    permissions: {
      read: 'impact.read', create: 'impact.manage', update: 'impact.manage',
      delete: 'impact.manage', publish: 'impact.manage',
    },
    label: 'Impact metric',
    labelPlural: 'Impact metrics',
    labelField: 'name',
    slugField: null,
    publishFlag: 'isPublishable',
    searchFields: ['name', 'key', 'description'],
    sortableFields: ['sortOrder', 'updatedAt', 'name'],
    defaultSort: 'sortOrder',
    auditedFields: ['name', 'key', 'isPublishable', 'targetValue', 'targetYear'],
    listSelect: {
      id: true, key: true, name: true, unit: true, isPublishable: true, sortOrder: true,
      targetValue: true, targetYear: true, updatedAt: true,
      pillar: { select: { id: true, name: true } },
      _count: { select: { values: true } },
    },
    createSchema: z.object(impactMetricWritable).strict(),
    updateSchema: z.object(impactMetricWritable).partial().strict(),
    fields: [
      { name: 'name', label: 'Metric', type: 'text', required: true, max: 200, group: 'content', inList: true },
      { name: 'key', label: 'Key', type: 'text', required: true, max: 80, group: 'content', help: 'Stable identifier used in blocks and reports. Do not change it once in use.' },
      { name: 'pillarId', label: 'Pillar', type: 'reference', collection: 'impact-pillars', group: 'content', inList: true },
      { name: 'description', label: 'Description', type: 'textarea', max: 2000, group: 'content' },
      { name: 'unit', label: 'Unit', type: 'text', max: 40, group: 'details', inList: true },
      { name: 'prefix', label: 'Prefix', type: 'text', max: 20, group: 'details' },
      { name: 'suffix', label: 'Suffix', type: 'text', max: 20, group: 'details' },
      { name: 'methodology', label: 'How it is measured', type: 'textarea', max: 4000, group: 'details', help: 'Required before a metric is published: a number without a method is not a fact.' },
      { name: 'internalSource', label: 'Internal source', type: 'text', max: 400, group: 'details', help: 'Never shown publicly. Where the number comes from and who owns it.' },
      { name: 'targetValue', label: 'Target', type: 'number', group: 'details' },
      { name: 'targetYear', label: 'Target year', type: 'number', group: 'details' },
      {
        name: 'isPublishable', label: 'Cleared for publication', type: 'boolean', group: 'publishing', inList: true,
        help: 'Leave this off until the figure and its methodology have been verified. Nothing is published while it is off.',
      },
      { name: 'sortOrder', label: 'Order', type: 'number', group: 'publishing' },
    ],
  }),

  reference({
    path: 'impact-stories',
    model: 'impactStory',
    entityType: 'impactStory',
    permissionPrefix: 'impact',
    permissions: {
      read: 'impact.read', create: 'impact.manage', update: 'impact.manage',
      delete: 'impact.manage', publish: 'impact.manage',
    },
    label: 'Impact story',
    labelPlural: 'Impact stories',
    labelField: 'title',
    localized: true,
    publishFlag: 'isPublished',
    searchFields: ['title', 'excerpt', 'slug'],
    sortableFields: ['updatedAt', 'publishedAt', 'year', 'title'],
    defaultSort: 'updatedAt',
    richTextFields: ['body'],
    auditedFields: ['title', 'pillarId', 'isPublished'],
    listSelect: {
      id: true, locale: true, title: true, slug: true, year: true, location: true,
      isFeatured: true, isPublished: true, isDemoContent: true, publishedAt: true, updatedAt: true,
      pillar: { select: { id: true, name: true } },
    },
    createSchema: z.object({ ...audienceSchema, ...impactStoryWritable }).strict(),
    updateSchema: z.object(impactStoryWritable).partial().strict(),
    fields: [
      { name: 'title', label: 'Title', type: 'text', required: true, max: 200, group: 'content', inList: true },
      { name: 'slug', label: 'URL slug', type: 'slug', max: 200, group: 'content' },
      { name: 'excerpt', label: 'Standfirst', type: 'textarea', max: 800, group: 'content' },
      { name: 'body', label: 'Body', type: 'richtext', group: 'content' },
      { name: 'pillarId', label: 'Pillar', type: 'reference', collection: 'impact-pillars', group: 'details', inList: true },
      { name: 'imageId', label: 'Image', type: 'media', group: 'details' },
      { name: 'location', label: 'Location', type: 'text', max: 160, group: 'details' },
      { name: 'year', label: 'Year', type: 'number', group: 'details', inList: true },
      localeField,
      { name: 'isFeatured', label: 'Feature this', type: 'boolean', group: 'publishing' },
      { name: 'isPublished', label: 'Published', type: 'boolean', group: 'publishing', inList: true },
      ...seoFields,
    ],
  }),

  // --- Structural lists ----------------------------------------------------

  taxonomy({
    path: 'departments', model: 'department', entityType: 'department',
    label: 'Department', labelPlural: 'Departments',
    read: 'careers.read', manage: 'careers.manage',
    shape: { summary: true, description: true, timestamps: true },
    extraSelect: { _count: { select: { jobs: true, people: true } } },
  }),

  taxonomy({
    path: 'job-locations', model: 'jobLocation', entityType: 'jobLocation',
    label: 'Location', labelPlural: 'Locations',
    read: 'careers.read', manage: 'locations.manage',
    shape: { key: false },
    extraSelect: { isRemote: true, _count: { select: { jobs: true } } },
  }),

  reference({
    path: 'impact-pillars',
    model: 'impactPillar',
    entityType: 'impactPillar',
    permissionPrefix: 'impact',
    permissions: {
      read: 'impact.read', create: 'impact.manage', update: 'impact.manage',
      delete: 'impact.manage', publish: 'impact.manage',
    },
    label: 'Impact pillar',
    labelPlural: 'Impact pillars',
    labelField: 'name',
    localized: true,
    publishFlag: 'isPublished',
    searchFields: ['name', 'slug', 'summary'],
    sortableFields: ['sortOrder', 'name', 'updatedAt'],
    defaultSort: 'sortOrder',
    auditedFields: ['name', 'slug', 'isPublished', 'sortOrder'],
    deriveKeyFromSlug: true,
    listSelect: {
      id: true, locale: true, key: true, name: true, slug: true, summary: true,
      isPublished: true, sortOrder: true, updatedAt: true,
      _count: { select: { metrics: true, stories: true } },
    },
    createSchema: z.object({ ...audienceSchema, ...impactPillarWritable }).strict(),
    updateSchema: z.object(impactPillarWritable).partial().strict(),
    fields: [
      { name: 'name', label: 'Pillar', type: 'text', required: true, max: 120, group: 'content', inList: true },
      { name: 'slug', label: 'URL slug', type: 'slug', max: 140, group: 'content' },
      { name: 'summary', label: 'Summary', type: 'textarea', max: 600, group: 'content' },
      { name: 'description', label: 'Description', type: 'textarea', max: 2000, group: 'content' },
      { name: 'icon', label: 'Icon', type: 'text', max: 40, group: 'details' },
      localeField,
      { name: 'isPublished', label: 'Published', type: 'boolean', group: 'publishing', inList: true },
      { name: 'sortOrder', label: 'Order', type: 'number', group: 'publishing', inList: true },
    ],
  }),

  taxonomy({
    path: 'story-categories', model: 'storyCategory', entityType: 'storyCategory',
    label: 'Story category', labelPlural: 'Story categories',
    read: 'stories.read', manage: 'stories.update',
    shape: { summary: true },
    extraSelect: { family: true, _count: { select: { stories: true } } },
  }),
  taxonomy({
    path: 'press-release-categories', model: 'pressReleaseCategory', entityType: 'pressReleaseCategory',
    label: 'Press release category', labelPlural: 'Press release categories',
    read: 'pressReleases.read', manage: 'pressReleases.update',
    extraSelect: { _count: { select: { pressReleases: true } } },
  }),
  taxonomy({
    path: 'report-categories', model: 'reportCategory', entityType: 'reportCategory',
    label: 'Report category', labelPlural: 'Report categories',
    read: 'reports.read', manage: 'reports.manage',
    shape: { summary: true },
    extraSelect: { _count: { select: { reports: true } } },
  }),
  taxonomy({
    path: 'policy-categories', model: 'policyCategory', entityType: 'policyCategory',
    label: 'Policy category', labelPlural: 'Policy categories',
    read: 'policies.read', manage: 'policies.manage',
    shape: { summary: true },
    extraSelect: { _count: { select: { policies: true } } },
  }),
  taxonomy({
    path: 'career-categories', model: 'careerCategory', entityType: 'careerCategory',
    label: 'Career category', labelPlural: 'Career categories',
    read: 'careers.read', manage: 'careers.manage',
    shape: { summary: true, description: true, isPublished: true },
    extraSelect: { _count: { select: { jobs: true } } },
  }),
  taxonomy({
    path: 'award-categories', model: 'awardCategory', entityType: 'awardCategory',
    label: 'Award category', labelPlural: 'Award categories',
    read: 'awards.manage', manage: 'awards.manage',
    extraSelect: { _count: { select: { awards: true } } },
  }),
  taxonomy({
    path: 'leadership-groups', model: 'leadershipGroup', entityType: 'leadershipGroup',
    label: 'Leadership group', labelPlural: 'Leadership groups',
    read: 'people.read', manage: 'leadership.manage',
    shape: { summary: true, timestamps: true, isPublished: true },
    extraSelect: { _count: { select: { people: true } } },
  }),
];
