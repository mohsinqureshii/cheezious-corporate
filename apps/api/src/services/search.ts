import { Prisma, type Locale, type PrismaClient, type SearchDocumentType } from '@cheezious/database';
import { htmlToText, truncate } from '@cheezious/utilities';

/**
 * Corporate search.
 *
 * Backed by PostgreSQL full-text search over a denormalised index that the
 * publishing pipeline maintains. Ranking is weighted — a term in a title beats
 * the same term buried in a body — and a trigram fallback catches misspellings
 * so "leadrship" still finds the leadership page.
 *
 * The index shape matches what an external engine would need, so moving to
 * OpenSearch later is an adapter swap, not a schema migration.
 */

export interface IndexDocumentInput {
  type: SearchDocumentType;
  entityId: string;
  locale: Locale;
  title: string;
  summary?: string | null;
  /** Raw content; HTML is flattened before indexing. */
  body: string;
  url: string;
  section?: string | null;
  category?: string | null;
  tags?: string[];
  publishedAt?: Date | null;
  boost?: number;
}

export interface SearchHit {
  type: SearchDocumentType;
  entityId: string;
  title: string;
  summary: string | null;
  url: string;
  section: string | null;
  category: string | null;
  publishedAt: Date | null;
  rank: number;
  /** Matching fragment with <mark> around the query terms. */
  highlight: string | null;
}

export interface SearchOptions {
  locale: Locale;
  query: string;
  types?: SearchDocumentType[];
  section?: string;
  page?: number;
  pageSize?: number;
}

export interface SearchResults {
  hits: SearchHit[];
  total: number;
  /** Counts per type, used to render the result group tabs. */
  facets: Array<{ type: SearchDocumentType; count: number }>;
  page: number;
  pageSize: number;
  /** Set when the trigram fallback was used rather than full-text matching. */
  usedFuzzyFallback: boolean;
}

/** Boosts reflect what a corporate visitor is usually looking for. */
const DEFAULT_BOOST: Record<SearchDocumentType, number> = {
  PAGE: 1.2,
  JOB: 1.3,
  PRESS_RELEASE: 1.1,
  NEWS: 1.0,
  STORY: 1.0,
  PERSON: 1.1,
  EMPLOYEE_STORY: 0.9,
  REPORT: 1.0,
  POLICY: 0.9,
  INGREDIENT: 0.8,
  AWARD: 0.7,
  LOCATION: 0.8,
};

export class SearchService {
  constructor(private readonly prisma: PrismaClient) {}

  /** Insert or update one document in the index. */
  async index(input: IndexDocumentInput, tx?: Prisma.TransactionClient): Promise<void> {
    const client = tx ?? this.prisma;
    const body = htmlToText(input.body).slice(0, 60_000);
    const summary = input.summary ? htmlToText(input.summary).slice(0, 600) : truncate(body, 300);

    await client.searchDocument.upsert({
      where: { type_entityId_locale: { type: input.type, entityId: input.entityId, locale: input.locale } },
      create: {
        type: input.type,
        entityId: input.entityId,
        locale: input.locale,
        title: input.title,
        summary,
        body,
        url: input.url,
        section: input.section ?? null,
        category: input.category ?? null,
        tags: input.tags ?? [],
        publishedAt: input.publishedAt ?? null,
        boost: input.boost ?? DEFAULT_BOOST[input.type] ?? 1,
      },
      update: {
        title: input.title,
        summary,
        body,
        url: input.url,
        section: input.section ?? null,
        category: input.category ?? null,
        tags: input.tags ?? [],
        publishedAt: input.publishedAt ?? null,
        boost: input.boost ?? DEFAULT_BOOST[input.type] ?? 1,
      },
    });
  }

  /** Remove a document — called when content is unpublished, archived or deleted. */
  async remove(
    type: SearchDocumentType,
    entityId: string,
    locale?: Locale,
    tx?: Prisma.TransactionClient,
  ): Promise<void> {
    const client = tx ?? this.prisma;
    await client.searchDocument.deleteMany({
      where: { type, entityId, ...(locale ? { locale } : {}) },
    });
  }

  /**
   * Run a search.
   *
   * `websearch_to_tsquery` is used rather than `plainto_tsquery` because it
   * understands quoted phrases and `-exclusions`, which is what people actually
   * type, and it never throws on malformed input.
   */
  async search(options: SearchOptions): Promise<SearchResults> {
    const page = Math.max(1, options.page ?? 1);
    const pageSize = Math.min(50, Math.max(1, options.pageSize ?? 20));
    const offset = (page - 1) * pageSize;

    const query = options.query.trim();
    if (!query) {
      return { hits: [], total: 0, facets: [], page, pageSize, usedFuzzyFallback: false };
    }

    const config = options.locale === 'en' ? 'english' : 'simple';
    const types = options.types?.length ? options.types : null;

    const rows = await this.prisma.$queryRaw<
      Array<{
        type: SearchDocumentType;
        entityId: string;
        title: string;
        summary: string | null;
        url: string;
        section: string | null;
        category: string | null;
        publishedAt: Date | null;
        rank: number;
        highlight: string | null;
        total: bigint;
      }>
    >(Prisma.sql`
      WITH q AS (
        SELECT websearch_to_tsquery(${config}::regconfig, ${query}) AS tsq
      )
      SELECT
        d."type",
        d."entityId",
        d."title",
        d."summary",
        d."url",
        d."section",
        d."category",
        d."publishedAt",
        ts_rank_cd(d."searchVector", q.tsq) * d."boost" AS rank,
        ts_headline(
          ${config}::regconfig,
          d."body",
          q.tsq,
          'StartSel=<mark>, StopSel=</mark>, MaxWords=32, MinWords=12, ShortWord=3, MaxFragments=1'
        ) AS highlight,
        COUNT(*) OVER () AS total
      FROM "search_documents" d, q
      WHERE d."locale" = ${options.locale}::"Locale"
        AND d."searchVector" @@ q.tsq
        ${types ? Prisma.sql`AND d."type" = ANY(${types}::"SearchDocumentType"[])` : Prisma.empty}
        ${options.section ? Prisma.sql`AND d."section" = ${options.section}` : Prisma.empty}
      ORDER BY rank DESC, d."publishedAt" DESC NULLS LAST
      LIMIT ${pageSize} OFFSET ${offset}
    `);

    if (rows.length > 0) {
      return {
        hits: rows.map(toHit),
        total: Number(rows[0]?.total ?? 0),
        facets: await this.facets(options.locale, query, config),
        page,
        pageSize,
        usedFuzzyFallback: false,
      };
    }

    // Nothing matched exactly — try trigram similarity on titles before giving up.
    return this.fuzzySearch(options, page, pageSize);
  }

  private async fuzzySearch(options: SearchOptions, page: number, pageSize: number): Promise<SearchResults> {
    const offset = (page - 1) * pageSize;
    const types = options.types?.length ? options.types : null;

    const rows = await this.prisma.$queryRaw<
      Array<{
        type: SearchDocumentType;
        entityId: string;
        title: string;
        summary: string | null;
        url: string;
        section: string | null;
        category: string | null;
        publishedAt: Date | null;
        rank: number;
        total: bigint;
      }>
    >(Prisma.sql`
      SELECT
        d."type", d."entityId", d."title", d."summary", d."url",
        d."section", d."category", d."publishedAt",
        similarity(d."title", ${options.query}) * d."boost" AS rank,
        COUNT(*) OVER () AS total
      FROM "search_documents" d
      WHERE d."locale" = ${options.locale}::"Locale"
        AND similarity(d."title", ${options.query}) > 0.25
        ${types ? Prisma.sql`AND d."type" = ANY(${types}::"SearchDocumentType"[])` : Prisma.empty}
      ORDER BY rank DESC
      LIMIT ${pageSize} OFFSET ${offset}
    `);

    return {
      hits: rows.map((row) => toHit({ ...row, highlight: null })),
      total: Number(rows[0]?.total ?? 0),
      facets: [],
      page,
      pageSize,
      usedFuzzyFallback: rows.length > 0,
    };
  }

  private async facets(
    locale: Locale,
    query: string,
    config: string,
  ): Promise<Array<{ type: SearchDocumentType; count: number }>> {
    const rows = await this.prisma.$queryRaw<Array<{ type: SearchDocumentType; count: bigint }>>(Prisma.sql`
      SELECT d."type", COUNT(*) AS count
      FROM "search_documents" d
      WHERE d."locale" = ${locale}::"Locale"
        AND d."searchVector" @@ websearch_to_tsquery(${config}::regconfig, ${query})
      GROUP BY d."type"
      ORDER BY count DESC
    `);
    return rows.map((row) => ({ type: row.type, count: Number(row.count) }));
  }

  /** Type-ahead suggestions for the search overlay. */
  async suggest(locale: Locale, query: string, limit = 6): Promise<Array<{ title: string; url: string; type: SearchDocumentType }>> {
    const trimmed = query.trim();
    if (trimmed.length < 2) return [];

    return this.prisma.$queryRaw(Prisma.sql`
      SELECT d."title", d."url", d."type"
      FROM "search_documents" d
      WHERE d."locale" = ${locale}::"Locale"
        AND d."title" ILIKE ${`%${trimmed}%`}
      ORDER BY similarity(d."title", ${trimmed}) DESC, d."boost" DESC
      LIMIT ${limit}
    `);
  }
}

function toHit(row: {
  type: SearchDocumentType;
  entityId: string;
  title: string;
  summary: string | null;
  url: string;
  section: string | null;
  category: string | null;
  publishedAt: Date | null;
  rank: number;
  highlight: string | null;
}): SearchHit {
  return {
    type: row.type,
    entityId: row.entityId,
    title: row.title,
    summary: row.summary,
    url: row.url,
    section: row.section,
    category: row.category,
    publishedAt: row.publishedAt,
    rank: Number(row.rank),
    highlight: row.highlight,
  };
}
