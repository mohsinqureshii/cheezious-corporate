# Deployment

Four things run: the API, the worker, the public site and the CMS. They share a
PostgreSQL database and an object store.

```
  ┌─────────────┐   ┌─────────────┐   ┌─────────────┐   ┌─────────────┐
  │   API       │   │   worker    │   │ public site │   │    CMS      │
  │  :4000      │   │ (no port)   │   │   :3000     │   │   :3001     │
  └──────┬──────┘   └──────┬──────┘   └──────┬──────┘   └──────┬──────┘
         └─────────────────┴─────────┬───────┴─────────────────┘
                                     │
                          PostgreSQL 16 · object store
```

The worker is easy to forget and its absence is quiet: scheduling still sets a
date and still enqueues a job, and nothing ever publishes it. If scheduled
content is not going live, check that the worker is running before looking
anywhere else.

## Environment

41 variables, all documented in `.env.example`. The ones that matter most:

| Variable                                   | Notes                                                                                  |
| ------------------------------------------ | -------------------------------------------------------------------------------------- |
| `DATABASE_URL`                             | Pooled connection for the applications.                                                |
| `DIRECT_DATABASE_URL`                      | Unpooled, for migrations. Prisma needs a direct connection to take advisory locks.     |
| `SESSION_SECRET`                           | Signs sessions. Rotating it signs everybody out.                                       |
| `PREVIEW_SECRET`                           | Signs preview tokens. Rotating it invalidates outstanding preview links.               |
| `REVALIDATE_SECRET`                        | Authorises on-publish revalidation of the public site.                                 |
| `CORS_ALLOWED_ORIGINS`                     | Exactly the CMS and public site origins. Not `*`.                                      |
| `STORAGE_DRIVER`                           | `local` for development, `s3` for anything else.                                       |
| `NEXT_PUBLIC_SEO_NOINDEX`                  | Set to `1` on every non-production deployment.                                         |
| `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD` | Used once, on a fresh database. The account must change its password at first sign-in. |

Secrets come from the environment and are never committed. `.env` is gitignored;
`.env.example` carries placeholders only.

**Do not set `NODE_ENV` in `.env`.** Next.js and the test runner set it
themselves. Forcing it produces a development build from `next build`, which then
fails while prerendering error pages, with an error about `<Html>` outside
`pages/_document` that points nowhere near the cause.

### Staging

`NEXT_PUBLIC_SEO_NOINDEX=1` emits noindex site-wide. The single most damaging SEO
mistake a corporate site can make is letting a staging copy get indexed and
compete with production, so this is set first and removed last.

## PostgreSQL

Any PostgreSQL 14 or newer. The migrations run
`CREATE EXTENSION IF NOT EXISTS pg_trgm` and `unaccent`, which back the
full-text search, so the role in `DIRECT_DATABASE_URL` must be allowed to create
extensions. On a managed provider that gives you an owner or superuser role —
Railway, Neon, Supabase, RDS — this is already true. On one that does not, ask
for the two extensions to be installed before the first migration.

`DIRECT_DATABASE_URL` matters only when `DATABASE_URL` points at a connection
pooler: Prisma takes an advisory lock while migrating and a pooler can hand the
unlock to a different connection. Without a pooler, set both to the same value.

Redis is **not** required. `REDIS_URL` is accepted and validated, and nothing
reads it yet — the rate limiter's Redis store is not implemented. Provisioning
Redis today buys nothing; see the status document.

## How the API is built

`tsc` alone cannot produce a runnable API, for two reasons that compound:

- `apps/api` is an ES module compiled with `moduleResolution: bundler`, so its
  relative imports are emitted without file extensions, and Node's ESM loader
  refuses those.
- The workspace packages deliberately ship TypeScript source
  (`"exports": "./src/index.ts"`), which Node cannot load at all.

In development `tsx` transpiles both on the fly. Nothing does that in a deploy,
so `pnpm --filter @cheezious/api build` runs `esbuild.config.mjs` instead: it
bundles `src/server.ts` and `src/worker.ts`, inlines the `@cheezious/*`
packages, and leaves everything in `node_modules` external. Output is CommonJS
with a `.cjs` extension, which is what tells Node how to read it inside a
`"type": "module"` package.

Because the bundle inlines the workspace packages, their runtime dependencies
become the API's own — `@prisma/client`, `argon2`, `pino`, `pino-pretty` and
`dotenv` are declared in `apps/api/package.json` for exactly that reason. Adding
a dependency to a `@cheezious/*` package that the API bundles means declaring it
there too, or the bundle will fail at startup with `MODULE_NOT_FOUND`.

The Next.js apps need none of this: `next build` transpiles workspace packages
itself.

## Ports

Every process binds `PORT` when the platform sets one — Railway, Fly, Heroku and
Cloud Run all inject it. `API_PORT` remains the configured name and is used when
`PORT` is absent; the public site and CMS fall back to 3000 and 3001.

## Railway

Five services: PostgreSQL, the API, the worker, the public site and the CMS. The
four application services all deploy the same repository and differ only in
their build and start commands, which live in `railway/*.json`. Point each
service at its file under **Settings → Config-as-code**:

| Service     | Config file           |
| ----------- | --------------------- |
| API         | `railway/api.json`    |
| Worker      | `railway/worker.json` |
| Public site | `railway/web.json`    |
| CMS         | `railway/cms.json`    |

Leave the root directory at the repository root. Setting it to `apps/api` breaks
pnpm workspace resolution, because the lockfile and the `@cheezious/*` packages
live above it.

The API service carries `pnpm db:migrate:deploy` as its pre-deploy command, so
migrations run once per release rather than from four services at once. Seeding
is a one-off: run `pnpm db:seed` from the API service's shell against the empty
database, and never again.

Database variables, on every service that needs them:

```
DATABASE_URL        = ${{Postgres.DATABASE_URL}}
DIRECT_DATABASE_URL = ${{Postgres.DATABASE_URL}}
```

Both point at the same place on purpose: Railway's PostgreSQL is not pooled, and
the two differ only when it is.

## Releasing

```bash
pnpm install --frozen-lockfile
pnpm db:migrate:deploy     # migrations first; they are additive
pnpm build                 # packages, then applications
```

Then restart the API, the worker, the public site and the CMS. Their production
entry points are:

| Process     | Start command                                  | Runs              |
| ----------- | ---------------------------------------------- | ----------------- |
| API         | `pnpm --filter @cheezious/api start`           | `dist/server.cjs` |
| Worker      | `pnpm --filter @cheezious/api worker:start`    | `dist/worker.cjs` |
| Public site | `pnpm --filter @cheezious/corporate-web start` | `next start`      |
| CMS         | `pnpm --filter @cheezious/cms start`           | `next start`      |

The `dev` and `worker` scripts are for development only: they run TypeScript
through `tsx` and read the root `.env`, neither of which belongs in a deploy.

Migrations run before the new code, and are additive, so the old code keeps
working against the new schema for the length of the deploy. A migration that
drops a column is split across two releases — stop writing it, then drop it —
so a rollback does not lose data written in between.

## Storage

`local` writes beneath `STORAGE_LOCAL_ROOT` and serves through the API, which is
fine for development and wrong for anything with more than one instance.

`s3` targets any S3-compatible service. Public assets are served from the bucket
or a CDN in front of it; **private keys are never served publicly**, from either
driver. Anything beneath `private/` — a CV, a supplier's certificate, a property
owner's floor plan — is refused by the public file route whatever the key says,
and reachable only through the submission queue that owns it, under that queue's
permission, with every download audited.

## Health and readiness

- `GET /health` — the process is up.
- `GET /ready` — the database is reachable. This is the one a load balancer
  should use; an API that cannot reach PostgreSQL should not be sent traffic.

## Security headers and CORS

`helmet` sets the standard headers; the CMS adds `X-Robots-Tag: noindex` on every
response, because an indexed CMS is an inventory of a company's internal tooling.
CORS is an explicit allow-list with credentials enabled — a wildcard origin and
credentials cannot be combined, and should not be attempted.

Rate limits apply per route class: authentication, public submissions, public
reads and CMS writes each have their own budget, so a burst of form submissions
cannot lock editors out of publishing.

## Backups

The database is the system of record: content, versions, audit log and
submissions. Back it up on a schedule and test a restore, because an untested
backup is a hypothesis.

The object store holds media and submitted files. Media can be re-uploaded;
submitted files cannot — they belong to somebody outside the company and there is
no second copy.

Retention is configured in settings: job applications and supplier and property
submissions each carry a retention period, and every submission records the
consent text the sender agreed to and when.

## Before the first public launch

- Replace every seeded placeholder with approved corporate data. Nothing factual
  in the seed is a statement about Cheezious; see
  [the content model](CONTENT_MODEL.md#what-is-deliberately-absent).
- Set the site-wide social sharing image to the approved asset.
- Confirm `NEXT_PUBLIC_SEO_NOINDEX` is **unset** in production and set
  everywhere else.
- Confirm the worker is running and a scheduled publish fires.
- Confirm the sitemap and `robots.txt` resolve to the production origin.
- Review Content health and clear the errors.
- Change the seeded administrator's password and give real people their own
  accounts. A shared administrator account makes the audit log useless.
