/**
 * Shared CMS row shapes.
 *
 * Kept out of the route files because a Next.js page module may only export a
 * fixed set of names — exporting a type from a page works, but colocating them
 * here keeps the route files to their single responsibility.
 */

export interface PageRow {
  id: string;
  title: string;
  path: string;
  type: string;
  locale: string;
  status: string;
  translationStatus: string;
  hasUnpublishedChanges: boolean;
  publishedAt: string | null;
  scheduledFor: string | null;
  reviewDate: string | null;
  updatedAt: string;
  createdBy: { id: string; name: string } | null;
  updatedBy: { id: string; name: string } | null;
}

export interface ListMeta {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export interface StatusFacet {
  value: string;
  label: string;
  count: number;
}
