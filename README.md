# Cheezious Corporate Digital Platform

A public corporate website, a platform API and an enterprise CMS, in one pnpm
monorepo.

The consumer site says _come and eat with us_. This one says _look at what we
are building_ — it is the surface a journalist, a supplier, a candidate, a
landlord or a prospective partner arrives at, and it is written for them.

---

## What is in here

| Path                                     | What it is                                                                                                                           |
| ---------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| `apps/corporate-web`                     | The public corporate site. Next.js App Router, statically generated with ISR, bilingual (English and Urdu, RTL).                     |
| `apps/cms`                               | The CMS. Next.js App Router, IBM Carbon-inspired, dense and operational.                                                             |
| `apps/api`                               | The platform API and the background worker. Express, Prisma, PostgreSQL.                                                             |
| `packages/database`                      | Prisma schema (91 models), migrations and the seed.                                                                                  |
| `packages/permissions`                   | The permission catalogue, the eleven seeded roles and the editorial workflow state machine.                                          |
| `packages/page-builder`                  | 58 block definitions with Zod schemas — the single source of truth for the CMS editor, the public renderer, the seed and validation. |
| `packages/seo`                           | Metadata resolution, structured data and the sitemap renderer. Framework-agnostic and unit tested.                                   |
| `packages/auth`                          | Password hashing, sessions, tokens, lockout and rate limiting.                                                                       |
| `packages/validation`                    | Shared Zod primitives, HTML sanitisation and upload validation.                                                                      |
| `packages/config`, `logger`, `utilities` | Environment parsing, structured logging and shared helpers.                                                                          |

Further reading:

- [Architecture](docs/ARCHITECTURE.md) — how the three applications fit together and why.
- [Content model](docs/CONTENT_MODEL.md) — what a page is, what a collection is, and how drafts stay separate from what is published.
- [Database](docs/DATABASE.md) — the schema, the migrations and the parts that need explaining.
- [CMS](docs/CMS.md) — what each screen is for.
- [Permissions](docs/PERMISSIONS.md) — the catalogue, the roles and where enforcement actually happens.
- [Design system](docs/DESIGN_SYSTEM.md) — the two visual languages and the rules behind them.
- [Deployment](docs/DEPLOYMENT.md) — environment, migrations, the worker and what to check before going live.
- [Implementation status](docs/IMPLEMENTATION_STATUS.md) — what is done, what is not, and what to do next.

---

## Running it locally

**Prerequisites:** Node 20.11+, pnpm 9+, PostgreSQL 16+.

```bash
pnpm install
cp .env.example .env          # then edit DATABASE_URL and the secrets
pnpm db:migrate               # create the schema
pnpm db:seed                  # structural content plus clearly-marked demo content
pnpm dev                      # API on :4000, site on :3000, CMS on :3001
```

The seed prints the first administrator's credentials. That account is required
to change its password at first sign-in.

Scheduled publishing needs the worker, which is a separate process:

```bash
pnpm --filter @cheezious/api worker
```

Without it, content can be scheduled but nothing will publish it.

### One thing worth knowing about `.env`

`NODE_ENV` is deliberately **not** set in `.env`. Next.js and the test runner
set it themselves, and forcing it from `.env` makes `next build` produce a
development build, which then fails while prerendering error pages. The symptom
is an error about `<Html>` being imported outside `pages/_document`, which
points nowhere near the cause.

---

## Checks

```bash
pnpm typecheck      # every package and app
pnpm lint           # eslint, zero warnings tolerated
pnpm format:check   # prettier
pnpm test           # unit tests, plus API integration tests against a real database
pnpm ci             # all of the above, in the order CI runs them
```

The API integration tests run against the database in `DATABASE_URL`. They
create their own users and content, prefixed and cleaned up afterwards, so they
are safe against a development database — but not against one you care about.

---

## The rule that governs the seed

**No fact about Cheezious is invented.**

Every seeded statistic, milestone, award, biography, certification and impact
metric is a structural placeholder, marked as one in the CMS and visible as one
on the page. Restaurant counts, employee numbers, sourcing claims and
environmental figures are examples of _where approved data goes_ — never
assertions about the real company. Impact metrics in particular are seeded with
no values at all and `isPublishable` set to false, because publishing an
unverified environmental or community number is a claim the company has not
made.

Replace them with approved corporate data before anything is published.
