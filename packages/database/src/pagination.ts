/** Cursor- and offset-based pagination helpers shared by every list endpoint. */

export interface PageRequest {
  page?: number;
  pageSize?: number;
}

export interface PageMeta {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
}

export interface Paginated<T> {
  items: T[];
  meta: PageMeta;
}

export function resolvePaging(
  request: PageRequest,
  defaults: { pageSize: number; maxPageSize: number } = { pageSize: 20, maxPageSize: 100 },
): { skip: number; take: number; page: number; pageSize: number } {
  const page = Math.max(1, Math.floor(request.page ?? 1));
  const pageSize = Math.min(
    defaults.maxPageSize,
    Math.max(1, Math.floor(request.pageSize ?? defaults.pageSize)),
  );
  return { skip: (page - 1) * pageSize, take: pageSize, page, pageSize };
}

export function buildPageMeta(total: number, page: number, pageSize: number): PageMeta {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  return {
    page,
    pageSize,
    total,
    totalPages,
    hasNextPage: page < totalPages,
    hasPreviousPage: page > 1,
  };
}

export function paginate<T>(items: T[], total: number, page: number, pageSize: number): Paginated<T> {
  return { items, meta: buildPageMeta(total, page, pageSize) };
}
