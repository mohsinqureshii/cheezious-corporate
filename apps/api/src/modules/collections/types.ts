import type { Permission } from '@cheezious/permissions';
import type { z } from 'zod';

/**
 * The structured content collections.
 *
 * One entry per collection the CMS manages. Everything the generic content API
 * and the generic CMS editor need is here: which model it is, who may do what to
 * it, which fields it has and how each should be edited.
 *
 * `fields` is not decoration. It is shipped to the CMS, which builds the editor
 * from it, so adding a column to a collection means adding it here once rather
 * than in a schema, an API, a form and a table.
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
  /** Shown beneath the control. Written for the editor, not the developer. */
  help?: string;
  required?: boolean;
  options?: Array<{ value: string; label: string }>;
  /** For `reference`: the collection path whose records may be chosen. */
  collection?: string;
  max?: number;
  /** Which panel of the editor the field belongs in. */
  group?: 'content' | 'details' | 'publishing' | 'seo';
  /** Shown as a column in the list view. */
  inList?: boolean;
}

export interface CollectionConfig {
  /** URL segment beneath /api/cms/content, and the CMS route segment. */
  path: string;
  model: string;
  /** Matches the versioning and workflow services' entity type. */
  entityType: string;
  permissionPrefix: string;
  permissions: {
    read: Permission;
    create: Permission;
    update: Permission;
    delete: Permission;
    publish: Permission;
  };
  label: string;
  labelPlural: string;
  labelField: string;
  slugField: string | null;
  localized: boolean;
  workflow: boolean;
  softDelete: boolean;
  hasPublishedAt: boolean;
  hasCreatedBy: boolean;
  hasUpdatedBy: boolean;
  /** Simple collections publish with a boolean instead of a workflow. */
  publishFlag?: string;
  /** Narrows the collection to one slice of a shared table. */
  fixedWhere?: Record<string, unknown>;
  searchFields: string[];
  sortableFields: string[];
  defaultSort: string;
  richTextFields: string[];
  /** Captured in a version and served publicly once published. */
  versionedFields: string[];
  /** Diffed in the audit log. */
  auditedFields: string[];
  /** Values that may only be set by someone holding the named permission. */
  guardedFields?: Array<{ field: string; values: string[]; permission: Permission }>;
  /**
   * Fill the table's `key` column from the slug on create.
   *
   * Taxonomies carry a stable key that seeds and blocks refer to, separate from
   * the display name so renaming a category cannot break a reference to it.
   */
  deriveKeyFromSlug?: boolean;
  listSelect: Record<string, unknown>;
  detailSelect?: Record<string, unknown>;
  createSchema: z.ZodTypeAny;
  updateSchema: z.ZodTypeAny;
  fields: FieldSpec[];
}
