# Database

PostgreSQL 16, Prisma 6. 91 models, 29 enums, two migrations.

```bash
pnpm db:migrate         # create and apply a migration in development
pnpm db:migrate:deploy  # apply pending migrations (what production runs)
pnpm db:seed            # idempotent; every write is an upsert on a stable key
pnpm db:studio          # Prisma Studio
pnpm db:reset           # drop, recreate, migrate, seed — development only
```

## The parts that need explaining

### Full-text search is a trigger, not a generated column

`search_documents.searchVector` is a `tsvector` maintained by a
`BEFORE INSERT OR UPDATE` trigger, with a GIN index over it and a `pg_trgm` index
over the title for fuzzy matching.

It is not a `GENERATED ALWAYS AS` column, and the reason is worth recording so
nobody tries to "simplify" it back: PostgreSQL requires a generation expression
to be immutable, and neither `to_tsvector` with a configuration name nor a cast
from an enum to text qualifies. Both were tried; both fail at migration time with
"generation expression is not immutable".

Prisma cannot model a `tsvector`, so the column is declared
`Unsupported("tsvector")?` and the two GIN indexes are declared with raw operator
classes. Without those declarations, the next `prisma migrate dev` writes a
migration that drops all three.

### Case-insensitive email uniqueness

`users_email_lower_key` is a unique index on `lower(email)`. Two accounts that
differ only in case are one account to every person involved, and a login that
matches case-insensitively against a column unique case-sensitively is an
account-takeover shape.

### Soft deletes, and what they cost

Content carries `deletedAt` rather than being removed, so an accidental delete is
recoverable. The unique constraint on `(locale, slug)` counts soft-deleted rows,
which means a deleted record would otherwise reserve its address forever — so
deleting also releases the slug by renaming it. Somebody who deletes a draft
called "Annual Report" can use the name again.

### Versions are polymorphic

One `content_versions` table serves every versioned type, keyed by
`(entityType, entityId, versionNumber)` with a unique constraint on the triple.
The version number is derived inside the same transaction as the insert, so two
editors saving simultaneously cannot both produce version 7 — one retries.

### Publishing jobs are idempotent by key

`publishing_jobs.idempotencyKey` is unique and takes the form
`publish:<entityType>:<entityId>`. Scheduling upserts on it, so rescheduling
moves the existing job rather than adding a second one that would publish twice.

## Seeding

The seed is idempotent: every write is an upsert keyed on a stable business key,
so running it twice does not duplicate anything, and re-running it does not
clobber an editor's work — blocks are written only when a page has none.

It deliberately does **not** re-sync permissions onto existing non-system roles.
An administrator who has customised a role should not have that undone by a
deploy. The consequence is that adding a permission to the catalogue does not
reach existing roles automatically; see [Permissions](PERMISSIONS.md) for how to
propagate one.

What it creates: the permission catalogue and eleven roles, the first
administrator, 58 block definitions, settings and locales, company reference
data, demonstration editorial content, careers data, impact and publications,
submission reference data, placeholder photography, ~50 page specifications that
expand to 103 published pages, an eight-page Urdu spine and the navigation.

Everything factual in it is a marked placeholder. See
[the content model](CONTENT_MODEL.md#what-is-deliberately-absent).

## Migrations

| Migration                           | What it does                                                                                                                    |
| ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| `20260916223859_init`               | The whole schema.                                                                                                               |
| `20260916224500_search_and_indexes` | The search trigger, the GIN and trigram indexes, partial indexes on hot filtered queries, and the case-insensitive email index. |

Migrations are additive and applied with `migrate deploy` in production. A
migration that drops a column should be split in two — stop writing it, then drop
it in a later release — so a rollback does not lose data written between the two.
