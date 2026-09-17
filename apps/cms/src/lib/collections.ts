import type { ListMeta, StatusFacet } from '@/lib/types';

/**
 * The CMS side of the collection system.
 *
 * The API describes each collection — its fields, whether it runs the editorial
 * workflow, what may be sorted on — and the CMS builds the list and the editor
 * from that description. Adding a field to a collection therefore means editing
 * one file in the API, not four files here.
 */

export type FieldType =
  | 'text'
  | 'textarea'
  | 'richtext'
  | 'slug'
  | 'number'
  | 'boolean'
  | 'date'
  | 'datetime'
  | 'select'
  | 'media'
  | 'reference'
  | 'url';

export interface FieldSpec {
  name: string;
  label: string;
  type: FieldType;
  help?: string;
  required?: boolean;
  options?: Array<{ value: string; label: string }>;
  collection?: string;
  max?: number;
  group?: 'content' | 'details' | 'publishing' | 'seo';
  inList?: boolean;
}

export interface CollectionDescriptor {
  path: string;
  label: string;
  labelPlural: string;
  labelField: string;
  slugField: string | null;
  workflow: boolean;
  localized: boolean;
  publishFlag: string | null;
  sortableFields: string[];
  fields: FieldSpec[];
}

export type RecordRow = Record<string, unknown> & { id: string };

export interface CollectionListResponse {
  items: RecordRow[];
  meta: ListMeta;
  facets: { statuses: StatusFacet[] };
  collection: CollectionDescriptor;
}

export interface CollectionItemResponse {
  item: RecordRow;
  collection: CollectionDescriptor;
  transitions?: Array<{ action: string; label: string; requires: string; tone?: string }>;
}

/**
 * Where each collection lives in the CMS.
 *
 * The sidebar groups screens the way the business divides work, which does not
 * always match the API's flat collection namespace — jobs are careers' problem,
 * departments belong to both. This map is the single place those two vocabularies
 * meet.
 */
export const COLLECTION_ROUTES: Record<string, string> = {
  stories: '/content/stories',
  news: '/content/news',
  'press-releases': '/content/press-releases',
  people: '/content/people',
  'leadership-groups': '/content/leadership',
  timeline: '/content/timeline',
  awards: '/content/awards',
  'impact-pillars': '/content/impact',
  'impact-metrics': '/content/impact/metrics',
  'impact-stories': '/content/impact/stories',
  reports: '/content/reports',
  policies: '/content/policies',
  jobs: '/careers/jobs',
  'employee-stories': '/careers/employee-stories',
  departments: '/careers/departments',
  'job-locations': '/careers/locations',
  'story-categories': '/content/stories/categories',
  'press-release-categories': '/content/press-releases/categories',
  'report-categories': '/content/reports/categories',
  'policy-categories': '/content/policies/categories',
  'career-categories': '/careers/jobs/categories',
  'award-categories': '/content/awards/categories',
};

/** The CMS URL for a record, or for the list when no id is given. */
export function collectionHref(collection: string, id?: string): string {
  const base = COLLECTION_ROUTES[collection] ?? `/content/${collection}`;
  return id ? `${base}/${id}` : base;
}

/** A readable value for a list cell, given the field that produced it. */
export function displayValue(row: RecordRow, field: FieldSpec): string {
  const value = row[field.name];

  if (value === null || value === undefined || value === '') return '—';

  if (field.type === 'boolean') return value === true ? 'Yes' : 'No';

  if (field.type === 'select') {
    return field.options?.find((option) => option.value === value)?.label ?? String(value);
  }

  if (field.type === 'reference') {
    // The API returns the related record alongside its id, so the name is shown
    // rather than a cuid nobody can read.
    const related = row[field.name.replace(/Id$/, '')] as { name?: string; title?: string } | undefined;
    return related?.name ?? related?.title ?? '—';
  }

  return String(value);
}

/** Group a collection's fields for the editor's panels, preserving order. */
export function groupFields(fields: FieldSpec[]): Array<{ key: string; label: string; fields: FieldSpec[] }> {
  const groups: Array<{ key: FieldSpec['group']; label: string }> = [
    { key: 'content', label: 'Content' },
    { key: 'details', label: 'Details' },
    { key: 'publishing', label: 'Publishing' },
    { key: 'seo', label: 'Search & sharing' },
  ];

  return groups
    .map((group) => ({
      key: group.key ?? 'content',
      label: group.label,
      fields: fields.filter((field) => (field.group ?? 'content') === group.key),
    }))
    .filter((group) => group.fields.length > 0);
}
