import 'server-only';

import { CACHE_TAGS, type Locale } from '@cheezious/config';

import { apiFetch, apiFetchOptional, type FetchOptions } from './api';

/**
 * Content loaders.
 *
 * Every read the site performs goes through a named function here, with its
 * cache tags declared alongside it. That keeps invalidation honest: when
 * publishing needs to clear something, there is one place to look for what that
 * something is called.
 */

// -----------------------------------------------------------------------------
// Types (the shape the API actually returns)
// -----------------------------------------------------------------------------

export interface MediaImage {
  id: string;
  storageKey: string;
  altText: string | null;
  caption: string | null;
  credit: string | null;
  width: number | null;
  height: number | null;
  focalX: number;
  focalY: number;
  blurDataUrl: string | null;
  placeholderColor: string | null;
}

export interface PageBlock {
  blockKey: string;
  data: Record<string, unknown>;
  sortOrder: number;
  anchor?: string | null;
}

export interface PageSeoData {
  title: string | null;
  description: string | null;
  canonicalUrl: string | null;
  noindex: boolean;
  nofollow: boolean;
  ogTitle: string | null;
  ogDescription: string | null;
  ogImageId: string | null;
  ogImage?: MediaImage | null;
  twitterCard: string | null;
  structuredData: unknown;
  keywords: string[];
  changeFrequency: string | null;
  priority: number | null;
}

export interface CorporatePage {
  id: string;
  title: string;
  navLabel: string | null;
  summary: string | null;
  path: string;
  locale: Locale;
  type: string;
  parent: { id: string; path: string; title: string; navLabel: string | null } | null;
  blocks: PageBlock[];
  seo: PageSeoData | null;
  publishedAt: string | null;
  updatedAt: string;
  excludeFromSitemap: boolean;
  alternates: Partial<Record<Locale, string>>;
}

export interface PageResponse {
  page?: CorporatePage;
  redirect?: { destination: string; statusCode: number };
  isPreview?: boolean;
}

export interface NavigationItem {
  id: string;
  kind: string;
  label: string;
  descriptor: string | null;
  externalUrl: string | null;
  opensInNewTab: boolean;
  isCallToAction: boolean;
  sortOrder: number;
  page: { id: string; path: string; status: string; navLabel: string | null; title: string } | null;
  featuredStory: {
    id: string;
    title: string;
    slug: string;
    excerpt: string | null;
    heroImage: MediaImage | null;
  } | null;
  featuredImage: MediaImage | null;
  featuredEyebrow: string | null;
  featuredHeadline: string | null;
  children: NavigationItem[];
}

export interface NavigationGroup {
  id: string;
  key: string;
  label: string;
  location: string;
  items: NavigationItem[];
}

export interface FooterData {
  footer: {
    copyrightTemplate: string;
    showLocaleSwitch: boolean;
    socialLinks: Array<{ platform: string; label: string; url: string }>;
    legalLinks: Array<{ label: string; path: string }>;
    regionLabel: string;
    note: string | null;
  } | null;
  groups: NavigationItem[];
}

export interface StorySummary {
  id: string;
  kind: string;
  title: string;
  slug: string;
  excerpt: string | null;
  publishedAt: string | null;
  readingMinutes: number | null;
  isFeatured: boolean;
  category: { name: string; slug: string; family: string } | null;
  heroImage: MediaImage | null;
  thumbnail: MediaImage | null;
  tags: Array<{ tag: { name: string; slug: string } }>;
}

export interface JobSummary {
  id: string;
  title: string;
  slug: string;
  summary: string | null;
  employmentType: string;
  workplaceType: string;
  postedAt: string | null;
  applicationDeadline: string | null;
  isFeatured: boolean;
  openingsCount: number | null;
  category: { name: string; slug: string } | null;
  department: { name: string; slug: string } | null;
  location: {
    name: string;
    slug: string;
    isRemote: boolean;
    city: { name: string; slug: string } | null;
  } | null;
}

export interface PersonSummary {
  id: string;
  name: string;
  slug: string;
  role: string;
  roleDetail: string | null;
  shortBio: string | null;
  isFeatured: boolean;
  portrait: MediaImage | null;
}

// -----------------------------------------------------------------------------
// Loaders
// -----------------------------------------------------------------------------

/** Resolve a path to a page, a redirect, or nothing. */
export async function getPage(
  locale: Locale,
  path: string,
  options: { previewToken?: string } = {},
): Promise<PageResponse | null> {
  // A preview is per-visitor and shows unpublished content, so it must never be
  // cached or shared.
  if (options.previewToken) {
    return apiFetchOptional<PageResponse>(`/api/public/${locale}/pages`, {
      searchParams: { path, previewToken: options.previewToken },
      noStore: true,
    });
  }

  return apiFetchOptional<PageResponse>(`/api/public/${locale}/pages`, {
    searchParams: { path },
    revalidate: 300,
    tags: [CACHE_TAGS.pathname(`${locale}${path}`), CACHE_TAGS.collection('pages')],
  });
}

export async function getPagePaths(locale: Locale): Promise<
  Array<{
    id: string;
    path: string;
    type: string;
    publishedAt: string | null;
    updatedAt: string;
    excludeFromSitemap: boolean;
    translationGroupId: string;
  }>
> {
  const data = await apiFetch<{ paths: Array<never> }>(`/api/public/${locale}/pages/paths`, {
    revalidate: 600,
    tags: [CACHE_TAGS.sitemap, CACHE_TAGS.collection('pages')],
  });
  return data.paths;
}

export async function getNavigation(locale: Locale): Promise<NavigationGroup[]> {
  const data = await apiFetch<{ navigations: NavigationGroup[] }>(
    `/api/public/${locale}/navigation`,
    {
      revalidate: 600,
      tags: [CACHE_TAGS.navigation],
    },
  );
  return data.navigations;
}

export async function getFooter(locale: Locale): Promise<FooterData> {
  return apiFetch<FooterData>(`/api/public/${locale}/footer`, {
    revalidate: 600,
    tags: [CACHE_TAGS.footer],
  });
}

export async function getSettings(locale: Locale): Promise<Record<string, unknown>> {
  const data = await apiFetch<{ settings: Record<string, unknown> }>(
    `/api/public/${locale}/settings`,
    {
      revalidate: 600,
      tags: [CACHE_TAGS.settings],
    },
  );
  return data.settings;
}

export async function getStories(
  locale: Locale,
  params: {
    kind?: string;
    category?: string;
    tag?: string;
    featured?: boolean;
    page?: number;
    pageSize?: number;
  } = {},
): Promise<{ items: StorySummary[]; total: number; page: number; pageSize: number }> {
  return apiFetch(`/api/public/${locale}/stories`, {
    searchParams: params as never,
    revalidate: 120,
    tags: [CACHE_TAGS.collection('stories')],
  });
}

export async function getStory(locale: Locale, slug: string) {
  return apiFetchOptional<{
    story: StorySummary & { body: string | null; related: StorySummary[] };
    alternates: Record<string, string>;
  }>(`/api/public/${locale}/stories/${encodeURIComponent(slug)}`, {
    revalidate: 300,
    tags: [CACHE_TAGS.collection('stories')],
  });
}

export async function getPressReleases(
  locale: Locale,
  params: { year?: number; category?: string; page?: number; pageSize?: number } = {},
) {
  return apiFetch<{ items: Array<Record<string, unknown>>; total: number; years: number[] }>(
    `/api/public/${locale}/press-releases`,
    {
      searchParams: params as never,
      revalidate: 120,
      tags: [CACHE_TAGS.collection('pressReleases')],
    },
  );
}

export async function getPressRelease(locale: Locale, slug: string) {
  return apiFetchOptional<{
    pressRelease: Record<string, unknown>;
    alternates: Record<string, string>;
  }>(`/api/public/${locale}/press-releases/${encodeURIComponent(slug)}`, {
    revalidate: 300,
    tags: [CACHE_TAGS.collection('pressReleases')],
  });
}

export async function getLeadership(locale: Locale) {
  return apiFetch<{
    groups: Array<{
      id: string;
      name: string;
      slug: string;
      summary: string | null;
      people: PersonSummary[];
    }>;
  }>(`/api/public/${locale}/leadership`, {
    revalidate: 600,
    tags: [CACHE_TAGS.collection('people')],
  });
}

export async function getPerson(locale: Locale, slug: string) {
  return apiFetchOptional<{ person: Record<string, unknown>; alternates: Record<string, string> }>(
    `/api/public/${locale}/people/${encodeURIComponent(slug)}`,
    { revalidate: 600, tags: [CACHE_TAGS.collection('people')] },
  );
}

export async function getJobs(
  locale: Locale,
  params: Record<string, string | number | boolean | undefined> = {},
) {
  // Job listings change whenever HR opens or closes a role, so they carry a
  // short revalidation window.
  return apiFetch<{
    items: JobSummary[];
    total: number;
    page: number;
    pageSize: number;
    facets: Record<string, unknown>;
  }>(`/api/public/${locale}/jobs`, {
    searchParams: params,
    revalidate: 60,
    tags: [CACHE_TAGS.collection('jobs')],
  });
}

export async function getJob(locale: Locale, slug: string) {
  return apiFetchOptional<{
    job: Record<string, unknown>;
    alternates: Record<string, string>;
    similar: JobSummary[];
  }>(`/api/public/${locale}/jobs/${encodeURIComponent(slug)}`, {
    revalidate: 60,
    tags: [CACHE_TAGS.collection('jobs')],
  });
}

export async function getCareerCategories(locale: Locale) {
  return apiFetch<{
    categories: Array<{
      id: string;
      key: string;
      name: string;
      slug: string;
      summary: string | null;
      openRoles: number;
    }>;
  }>(`/api/public/${locale}/careers/categories`, {
    revalidate: 120,
    tags: [CACHE_TAGS.collection('jobs')],
  });
}

export async function getTimeline(
  locale: Locale,
  params: { featured?: boolean; fromYear?: number; toYear?: number } = {},
) {
  return apiFetch<{ events: Array<Record<string, unknown>> }>(`/api/public/${locale}/timeline`, {
    searchParams: params as never,
    revalidate: 600,
    tags: [CACHE_TAGS.collection('timeline')],
  });
}

export async function getFootprint(locale: Locale) {
  return apiFetch<{ regions: Array<Record<string, unknown>> }>(`/api/public/${locale}/footprint`, {
    revalidate: 600,
    tags: [CACHE_TAGS.collection('footprint')],
  });
}

export async function getImpact(locale: Locale, params: { year?: number } = {}) {
  return apiFetch<{ pillars: Array<Record<string, unknown>> }>(`/api/public/${locale}/impact`, {
    searchParams: params as never,
    revalidate: 600,
    tags: [CACHE_TAGS.collection('impact')],
  });
}

export async function getReports(
  locale: Locale,
  params: Record<string, string | number | undefined> = {},
) {
  return apiFetch<{
    items: Array<Record<string, unknown>>;
    total: number;
    facets: { years: number[]; types: string[] };
  }>(`/api/public/${locale}/reports`, {
    searchParams: params,
    revalidate: 600,
    tags: [CACHE_TAGS.collection('reports')],
  });
}

export async function getReport(locale: Locale, slug: string) {
  return apiFetchOptional<{
    report: Record<string, unknown>;
    related: Array<Record<string, unknown>>;
    alternates: Record<string, string>;
  }>(`/api/public/${locale}/reports/${encodeURIComponent(slug)}`, {
    revalidate: 600,
    tags: [CACHE_TAGS.collection('reports')],
  });
}

export async function getPolicies(locale: Locale, params: { category?: string } = {}) {
  return apiFetch<{ categories: Array<Record<string, unknown>> }>(
    `/api/public/${locale}/policies`,
    {
      searchParams: params as never,
      revalidate: 600,
      tags: [CACHE_TAGS.collection('policies')],
    },
  );
}

export interface SitemapEntryRecord {
  slug: string;
  updatedAt: string | null;
  publishedAt?: string | null;
  postedAt?: string | null;
  /** Reports date by publication rather than by a workflow timestamp. */
  publicationDate?: string | null;
  translationGroupId: string;
}

export interface SitemapPayload {
  pages: Array<{
    path: string;
    type: string;
    updatedAt: string | null;
    publishedAt: string | null;
    translationGroupId: string;
  }>;
  stories: SitemapEntryRecord[];
  pressReleases: SitemapEntryRecord[];
  people: SitemapEntryRecord[];
  policies: SitemapEntryRecord[];
  jobs: SitemapEntryRecord[];
  reports: SitemapEntryRecord[];
  impactStories: SitemapEntryRecord[];
  employeeStories: SitemapEntryRecord[];
}

/** Everything with a public URL, uncapped, for the sitemap. */
export async function getSitemap(locale: Locale): Promise<SitemapPayload> {
  return apiFetch(`/api/public/${locale}/sitemap`, {
    revalidate: 900,
    tags: [CACHE_TAGS.sitemap],
  });
}

export async function getPolicy(locale: Locale, slug: string) {
  return apiFetchOptional<{ policy: Record<string, unknown>; alternates: Record<string, string> }>(
    `/api/public/${locale}/policies/${encodeURIComponent(slug)}`,
    { revalidate: 600, tags: [CACHE_TAGS.collection('policies')] },
  );
}

export async function getEmployeeStory(locale: Locale, slug: string) {
  return apiFetchOptional<{ story: Record<string, unknown>; alternates: Record<string, string> }>(
    `/api/public/${locale}/employee-stories/${encodeURIComponent(slug)}`,
    { revalidate: 600, tags: [CACHE_TAGS.collection('employeeStories')] },
  );
}

export async function getImpactStories(
  locale: Locale,
  params: { page?: number; pageSize?: number; pillar?: string } = {},
) {
  return apiFetch<{ items: Array<Record<string, unknown>>; total: number }>(
    `/api/public/${locale}/impact/stories`,
    {
      searchParams: params as never,
      revalidate: 600,
      tags: [CACHE_TAGS.collection('impact')],
    },
  );
}

export async function getImpactStory(locale: Locale, slug: string) {
  return apiFetchOptional<{ story: Record<string, unknown>; alternates: Record<string, string> }>(
    `/api/public/${locale}/impact/stories/${encodeURIComponent(slug)}`,
    { revalidate: 600, tags: [CACHE_TAGS.collection('impact')] },
  );
}

export async function getAwards(locale: Locale) {
  return apiFetch<{ awards: Array<Record<string, unknown>> }>(`/api/public/${locale}/awards`, {
    revalidate: 600,
    tags: [CACHE_TAGS.collection('awards')],
  });
}

export async function getEmployeeStories(
  locale: Locale,
  params: { page?: number; pageSize?: number } = {},
) {
  return apiFetch<{ items: Array<Record<string, unknown>>; total: number }>(
    `/api/public/${locale}/employee-stories`,
    {
      searchParams: params as never,
      revalidate: 300,
      tags: [CACHE_TAGS.collection('employeeStories')],
    },
  );
}

export async function getIngredients(locale: Locale) {
  return apiFetch<{ categories: Array<Record<string, unknown>> }>(
    `/api/public/${locale}/ingredients`,
    {
      revalidate: 600,
      tags: [CACHE_TAGS.collection('ingredients')],
    },
  );
}

export async function getMediaLibrary(
  locale: Locale,
  params: Record<string, string | boolean | undefined> = {},
) {
  return apiFetch<{ assets: Array<Record<string, unknown>> }>(
    `/api/public/${locale}/media-library`,
    {
      searchParams: params as never,
      revalidate: 600,
      tags: [CACHE_TAGS.collection('media')],
    },
  );
}

export async function search(
  locale: Locale,
  params: { q: string; types?: string; page?: number; pageSize?: number },
) {
  // Search responses are per-query; caching them broadly is not useful.
  return apiFetch<{
    hits: Array<Record<string, unknown>>;
    total: number;
    facets: Array<{ type: string; count: number }>;
    usedFuzzyFallback: boolean;
  }>(`/api/public/${locale}/search`, { searchParams: params as never, revalidate: 30 });
}

export type { FetchOptions };
