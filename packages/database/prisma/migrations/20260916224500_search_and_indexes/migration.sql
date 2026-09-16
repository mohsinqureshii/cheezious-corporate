-- ---------------------------------------------------------------------------
-- Full-text search support for the corporate search experience.
--
-- The search index is a denormalised table (search_documents) maintained by the
-- application on publish. This migration adds the PostgreSQL machinery that
-- turns it into a real search engine: a generated tsvector column, a GIN index
-- for ranked matching, and a trigram index for fuzzy title matching so that
-- "leadrship" still finds "Leadership".
--
-- Urdu has no PostgreSQL text-search configuration, so Urdu rows are indexed
-- with the 'simple' configuration (no stemming, no stop words), which is the
-- correct behaviour for a language the server cannot stem. The locale branch is
-- written inline rather than in a helper function because PostgreSQL rejects
-- search_path-dependent user functions inside generated columns.
-- ---------------------------------------------------------------------------

CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS unaccent;

-- Weighted document vector: title (A) outranks tags/summary (B), which outrank
-- body (C). This is maintained by a trigger rather than a GENERATED column
-- because PostgreSQL treats the enum-to-text cast on "locale" as STABLE rather
-- than IMMUTABLE, which generated columns forbid.
ALTER TABLE "search_documents" ADD COLUMN IF NOT EXISTS "searchVector" tsvector;

CREATE OR REPLACE FUNCTION cheezious_search_documents_vector()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $$
DECLARE
  cfg regconfig := CASE WHEN NEW."locale"::text = 'en' THEN 'english'::regconfig ELSE 'simple'::regconfig END;
BEGIN
  NEW."searchVector" :=
    setweight(to_tsvector(cfg, coalesce(NEW."title", '')), 'A') ||
    setweight(to_tsvector(cfg, coalesce(NEW."summary", '')), 'B') ||
    setweight(to_tsvector('simple'::regconfig, coalesce(array_to_string(NEW."tags", ' '), '')), 'B') ||
    setweight(to_tsvector(cfg, coalesce(NEW."body", '')), 'C');
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS search_documents_vector_trg ON "search_documents";
CREATE TRIGGER search_documents_vector_trg
  BEFORE INSERT OR UPDATE OF "title", "summary", "body", "tags", "locale"
  ON "search_documents"
  FOR EACH ROW EXECUTE FUNCTION cheezious_search_documents_vector();

CREATE INDEX IF NOT EXISTS "search_documents_vector_idx"
  ON "search_documents" USING GIN ("searchVector");

CREATE INDEX IF NOT EXISTS "search_documents_title_trgm_idx"
  ON "search_documents" USING GIN ("title" gin_trgm_ops);

-- Case-insensitive uniqueness for user email addresses. Two accounts differing
-- only by capitalisation would be an authentication hazard.
CREATE UNIQUE INDEX IF NOT EXISTS "users_email_lower_key"
  ON "users" (lower("email"));

-- Partial index: the publishing worker only ever scans pending/running jobs.
CREATE INDEX IF NOT EXISTS "publishing_jobs_due_idx"
  ON "publishing_jobs" ("runAt")
  WHERE "status" IN ('PENDING', 'RUNNING');

-- Partial index: the content-health dashboard only reads unresolved issues.
CREATE INDEX IF NOT EXISTS "content_health_open_idx"
  ON "content_health_issues" ("type", "severity", "detectedAt")
  WHERE "resolvedAt" IS NULL AND "dismissedAt" IS NULL;

-- Scheduled publishing lookups across every versioned content type.
CREATE INDEX IF NOT EXISTS "pages_due_idx" ON "pages" ("scheduledFor") WHERE "status" = 'SCHEDULED';
CREATE INDEX IF NOT EXISTS "stories_due_idx" ON "stories" ("scheduledFor") WHERE "status" = 'SCHEDULED';
CREATE INDEX IF NOT EXISTS "press_releases_due_idx" ON "press_releases" ("scheduledFor") WHERE "status" = 'SCHEDULED';

-- Live content lookups skip soft-deleted rows entirely.
CREATE INDEX IF NOT EXISTS "pages_live_idx" ON "pages" ("locale", "status") WHERE "deletedAt" IS NULL;
CREATE INDEX IF NOT EXISTS "stories_live_idx" ON "stories" ("locale", "kind", "publishedAt" DESC) WHERE "deletedAt" IS NULL;
CREATE INDEX IF NOT EXISTS "jobs_live_idx" ON "jobs" ("locale", "status", "postedAt" DESC) WHERE "deletedAt" IS NULL;
