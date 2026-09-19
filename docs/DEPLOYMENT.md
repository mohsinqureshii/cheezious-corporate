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

## One service, or four

The platform can run either way, and the choice is one variable.

**`SERVICE=all`** runs everything in one process. The API serves its own routes
and puts the public site and the CMS behind them, each as a child on loopback,
with the CMS under `/admin`. One service, one domain, one set of variables.

That single origin is the point. A browser that only ever talks to one host
needs no CORS, no preflight, and no API origin compiled into a bundle — which
between them are most of what makes the four-service arrangement fiddly to
configure. It is the right default below the traffic at which the trade starts
to hurt.

What it gives up: the site and the CMS can no longer be deployed or scaled
apart, and one process holds three applications, so a crash takes all of them.
When that matters, deploy `api`, `web` and `cms` separately again — the code is
identical, and only the variables change.

Two details follow from the single origin and are worth knowing:

- **The content policy is scoped by path.** `default-src 'none'` is right for
  JSON and wrong for an HTML page — it blocks the inline bootstrap and the
  fetches that hydrate it, so the page arrives complete and never becomes
  usable. It applies to `/api` and `/files` only; the two applications keep the
  headers they set themselves.
- **Same-origin requests are recognised.** A browser sends `Origin` on anything
  that is not a simple GET, including to its own host, and the deployment's own
  domain cannot be known in advance. With `SERVE_ALL`, an `Origin` whose host
  matches the request's `Host` is allowed; anything else still goes through
  `CORS_ALLOWED_ORIGINS`.
- **Redirects and canonicals resolve the origin themselves.** See below; a
  deployment that is assigned its domain after the build cannot get either from
  a compiled-in value.

## Knowing its own address

Two things need the site's origin, and they need different answers.

A **redirect** — the locale prefix middleware adds to an unprefixed path — needs
the origin the visitor is actually using. Next cannot supply it: self-hosted, its
`request.url` is built from the address the server is bound to and ignores the
`Host` header entirely, so `NextResponse.redirect(new URL(path, request.url))`
sends every visitor to `localhost:3000`. That is not a misconfiguration and no
variable fixes it. The middleware reads `Host` (falling back to
`X-Forwarded-Host`) and the proxy's `X-Forwarded-Proto` instead. `Host` is
preferred because the edge routes to this service by it, so it is the one name
known to reach us, and a forged `X-Forwarded-Host` cannot redirect a visitor
somewhere else.

A **canonical URL** — and hreflang, JSON-LD and the sitemap — needs the origin
the site is _published_ at, which has to be the same for every visitor or search
engines see a different canonical per hostname. That comes from configuration,
resolved in this order:

| Source                  | When it is read | Use it for                          |
| ----------------------- | --------------- | ----------------------------------- |
| `SITE_URL`              | Runtime         | Any deployment. Prefer this.        |
| `NEXT_PUBLIC_SITE_URL`  | Build           | Local development.                  |
| `RAILWAY_PUBLIC_DOMAIN` | Runtime         | Nothing to set; Railway injects it. |
| `http://localhost:3000` | —               | Last resort.                        |

Runtime comes first deliberately. `NEXT_PUBLIC_*` is compiled into the bundle, so
a wrong value survives every restart and can only be corrected by rebuilding —
and on a platform that assigns the domain _after_ the image is built, the value
at build time is necessarily wrong. `SITE_URL` is read by the running server.

On Railway neither needs to be set: `RAILWAY_PUBLIC_DOMAIN` is the service's
primary domain. Set `SITE_URL` once a real domain is attached, because the
canonical should name the domain the brand publishes, not the platform's.

`robots.txt` and `sitemap.xml` render per request for this reason — prerendering
them would freeze the origin into the build. Content pages are prerendered but
revalidate every five minutes, so a corrected origin reaches them shortly after a
restart without a rebuild.

## One repository, four processes

Most platforms infer what to run from the root `package.json`. This repository
has four answers, so the root has no single `start` script and detection fails —
Railway's Railpack reports "no start command detected" and refuses to build.

`scripts/service.mjs` is that command. It reads `SERVICE` and dispatches:

| `SERVICE` | `pnpm build` builds | `pnpm start` runs               |
| --------- | ------------------- | ------------------------------- |
| `all`     | everything          | the API, the site and the CMS   |
| `api`     | packages + API      | `apps/api/dist/server.cjs`      |
| `worker`  | packages + API      | `apps/api/dist/worker.cjs`      |
| `web`     | packages + web      | `next start` on the public site |
| `cms`     | packages + CMS      | `next start` on the CMS         |
| unset     | everything          | refuses, and says what to set   |

`pnpm build` with no `SERVICE` still builds the whole workspace, so a
developer's workflow is unchanged. `pnpm start` with no `SERVICE` falls back to
the platform's own name for the service — `RAILWAY_SERVICE_NAME` and its
equivalents — so a service named `api`, `worker`, `web` or `cms` needs no
variable at all. When neither is available it fails with a message naming the
four values and where to set them, rather than starting something arbitrary.

The wrapper forwards SIGTERM and SIGINT to the process it started. Without that,
a deploy's shutdown signal stops at the wrapper and the service is killed
mid-request instead of draining.

## Running the worker inside the API

`RUN_WORKER=true` on the API service runs the background loop in that process
instead of as its own service, and the worker service can then be deleted. It is
off by default.

Separate is the better arrangement and stays the default: a long job cannot
block a request, and the two scale independently. Embedding trades that for one
fewer thing to deploy, which is the right trade at low traffic.

**Never set it with more than one API replica.** Each replica would run its own
loop. Jobs are claimed by conditional update so they would not double-publish,
but the content-health scan and the expiry sweep are not claimed, and would run
once per replica.

It is the same code either way — `worker-runtime.ts` — so nothing behaves
differently, and moving back to a separate service is deleting the variable.

## The public site's build needs the API running

`next build` prerenders around 108 pages, and each one fetches its content from
`NEXT_PUBLIC_API_URL`. With the API unreachable the build does not fail loudly:
it logs `ECONNREFUSED`, leaves `.next` incomplete, and the site then dies at
startup on a missing `prerender-manifest.json`.

So the API must be deployed and serving **before** the public site or the CMS is
built. `NEXT_PUBLIC_API_URL` must also be the API's _public_ origin, never a
private network address: it is inlined into the client bundle, so the browser
uses the same value.

## Railway

Two services: PostgreSQL and one application service running `SERVICE=all`. That
is the arrangement this section describes, and the one to start from.

Splitting into four application services is supported and documented at the end
of this section, but it is not where to begin: four services mean four sets of
variables, two domains that must be told about each other, and a CORS
configuration whose only symptom when wrong is a sign-in that silently fails.

`railway/*.json` carry per-service build and start commands, but they apply only
to a service pointed at one under **Settings → Config-as-code**, and services
created after 26 August 2026 cannot be. Do not rely on them. `SERVICE` is what
makes the build work, on any service, with nothing to configure.

Leave the root directory at the repository root. Setting it to `apps/api` breaks
pnpm workspace resolution, because the lockfile and the `@cheezious/*` packages
live above it.

### First deployment, step by step

1. **Add PostgreSQL.** Railway's own PostgreSQL service. Nothing to configure.

2. **Deploy this repository** as a second service. Leave the root directory
   empty, and set no build or start command — the root scripts read `SERVICE`.

3. **Generate a domain** under **Settings → Networking**. Generate exactly one.
   A second domain is not harmful, but only one can be canonical, and having two
   makes it ambiguous which one that is.

4. **Set the pre-deploy command** to `pnpm db:migrate:deploy`, under
   **Settings → Deploy**. Migrations then run once per release, before the new
   version starts serving.

5. **Set the variables.** This is the complete list; everything else has a
   working default:

   ```
   SERVICE=all
   PORT=8080
   RUN_WORKER=true
   DATABASE_URL=${{Postgres.DATABASE_URL}}
   DIRECT_DATABASE_URL=${{Postgres.DATABASE_URL}}
   SESSION_SECRET=<openssl rand -base64 48>
   PREVIEW_SECRET=<a different one>
   REVALIDATE_SECRET=<a different one>
   INTERNAL_API_KEY=<a different one>
   NEXT_PUBLIC_SEO_NOINDEX=1
   ```

   No URL variables at all. The single origin means the browser never needs one,
   and the site reads its own domain from `RAILWAY_PUBLIC_DOMAIN` for canonicals
   — see "Knowing its own address" above.

   Both database URLs point at the same place on purpose: Railway's PostgreSQL is
   not pooled, and the two differ only when it is. Four _distinct_ secrets, not
   one value repeated — the API refuses to start in production with a
   placeholder, but it cannot tell that you reused a real one.

6. **Deploy, and wait for it to come up.** The first build is slow: it builds the
   API, the public site and the CMS in turn.

7. **Seed once.** Migrations run themselves; seeding does not. Open the
   service's shell and run `pnpm db:seed` against the empty database, once.

8. **Check it.** On the generated domain:

   - `/ready` returns `{"status":"ready"}`
   - `/` redirects to `/en/company` **on that same domain** — if it redirects to
     `localhost:3000`, the deployment predates the fix described in "Knowing its
     own address"
   - `/admin` redirects to `/admin/sign-in`

   Sign in as the seeded administrator, which immediately requires a new
   password. That is intended, not a fault.

Keep `NEXT_PUBLIC_SEO_NOINDEX=1` until approved content has replaced the
placeholders. Everything the seed writes is demonstration data and says so.

Once a real domain is attached, add `SITE_URL=https://<that domain>` so the
canonical names the brand's domain rather than the platform's.

### Splitting it into four

Only worth doing when the site and the CMS need to scale or deploy apart. Deploy
this repository four times, with one variable different in each:

| Service     | Variable         |
| ----------- | ---------------- |
| API         | `SERVICE=api`    |
| Worker      | `SERVICE=worker` |
| Public site | `SERVICE=web`    |
| CMS         | `SERVICE=cms`    |

Name the API service `api` and the site `web`; the others reference them by
name. Generate domains for `api`, `web` and `cms` — the worker serves no HTTP.
Put the pre-deploy migration on the API service only, so migrations run once per
release rather than from four services at once.

Then, once the domains exist:

```
# web
NEXT_PUBLIC_API_URL=https://${{api.RAILWAY_PUBLIC_DOMAIN}}
SITE_URL=https://${{web.RAILWAY_PUBLIC_DOMAIN}}
NEXT_PUBLIC_SEO_NOINDEX=1

# cms
NEXT_PUBLIC_CMS_API_URL=https://${{api.RAILWAY_PUBLIC_DOMAIN}}

# api and worker
API_PUBLIC_URL=https://${{api.RAILWAY_PUBLIC_DOMAIN}}
CORPORATE_WEB_URL=https://${{web.RAILWAY_PUBLIC_DOMAIN}}
CMS_URL=https://${{cms.RAILWAY_PUBLIC_DOMAIN}}
CORS_ALLOWED_ORIGINS=https://${{web.RAILWAY_PUBLIC_DOMAIN}},https://${{cms.RAILWAY_PUBLIC_DOMAIN}}
```

Deploy in order — api, then worker, then web and cms — and wait for
`https://<api>/ready` to return 200 before the two Next.js apps build. They
prerender against it, and an unreachable API does not fail their build loudly;
see "The public site's build needs the API running" above.

`CORS_ALLOWED_ORIGINS` is the one that fails confusingly: get it wrong and the
browser refuses every call the CMS makes, which presents as a broken sign-in
rather than as a configuration error.

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

## Seeding, and what it needs from the host

`pnpm db:seed` is content: permissions, roles, block definitions, the site map
and the demonstration records. It is idempotent, and it needs the migrations to
have run first — `pnpm db:migrate:deploy` creates the tables.

One step depends on the host rather than the database. Placeholder photography
is rendered by `sharp`, which draws text through libvips and therefore wants
fontconfig and a font; a slim container often has neither, and emits
`Fontconfig error: Cannot load default config file`. That warning alone is
harmless. A genuine failure is caught per image: the seed reports how many were
skipped and carries on, because a hundred pages of content matters more than
twenty decorative images. Re-running the seed after installing fonts fills them
in.

**Readiness does not check the schema.** `/ready` runs a connectivity query, so
it returns 200 against a database with no tables in it. A green health check is
not evidence that the migrations have run.

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
