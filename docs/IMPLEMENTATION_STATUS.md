# Implementation status

Last updated at the end of the build session that produced this branch.

Everything below was verified by running it, not by reading the code. Where
something is partial or missing, it says so.

---

## Completed

### Platform foundation

- pnpm workspace monorepo, TypeScript strict throughout (including
  `noUncheckedIndexedAccess`). `pnpm typecheck`, `pnpm lint` (zero warnings
  tolerated) and `pnpm format:check` all pass.
- 167 tests across seven packages: 59 API integration tests against a real
  database, plus unit tests for SEO (32), validation (22), utilities (22),
  page-builder (19), auth (19) and permissions (16).
- PostgreSQL 16 + Prisma 6: 91 models, 29 enums, two migrations, zero schema
  drift. Full-text search via a trigger-maintained `tsvector` with GIN and
  trigram indexes.
- Idempotent seed: the permission catalogue, eleven roles, 58 block definitions,
  settings, company reference data, demonstration editorial content, careers
  data, impact and publications, placeholder photography, 103 published English
  pages, an eight-page Urdu spine and the navigation.

### Authentication, authorisation and audit

- Argon2id password hashing with a length-weighted policy; database-backed
  sessions so disabling an account takes effect immediately; two-tier lockout
  (per account and per address); per-route-class rate limiting.
- 76 permissions in 12 groups, 11 seeded roles, enforced in the API on every
  request. The CMS hides what a user cannot use as a courtesy only.
- Audit logging on every mutating route, with a field-level diff that redacts
  and masks personal data. Append-only: nothing in the CMS can edit or remove an
  entry.
- Account self-service: change password, own profile, active sessions with
  individual revocation, forgotten-password and reset flows.

### Content engine

- Pages with a 58-block composition system, driven by Zod schemas that are the
  single source of truth for the CMS editor, the public renderer, the seed and
  write validation.
- Draft and published genuinely separate: the public site serves an immutable
  snapshot, editing a published record flags unpublished changes rather than
  changing production, and restoring a version writes a new revision.
- Editorial workflow as a guarded state machine with per-transition permissions,
  notifications and workflow events.
- 22 content collections through one configured implementation, with slug
  uniqueness per locale, rich-text sanitisation on write, strict write schemas,
  and a delete that refuses published content and releases the address.
- Five submission queues through one configured implementation: filters, status,
  assignment, internal notes, attachment downloads and CSV export behind a
  separate higher-risk permission.
- Media library with three-way upload validation (MIME, extension and magic
  bytes must agree), alternative-text reporting, usage tracking and a delete that
  refuses an asset still in use. Files submitted by the public are structurally
  excluded from the library.
- Site structure: navigation with broken-link detection and cycle prevention,
  per-language footer, redirects with loop detection, forms, translation status,
  content health and integrations.

### Background worker

- Scheduled publishing through the same code path a person's publish takes, with
  jobs claimed by conditional update so multiple workers are safe.
- Retry with backoff, then a permanent failure that notifies whoever can publish.
- `unpublishAt` honoured; content-health scanning that reconciles rather than
  duplicates, and leaves dismissed issues dismissed.
- Verified end to end: a story scheduled 70 seconds out published at its time,
  with the version snapshot written and its author notified.

### Public site

- 103 published pages served from the CMS with no information architecture in the
  file system, statically generated with ISR.
- Detail routes for stories and news, press releases, leadership profiles,
  policies and jobs.
- Careers with job detail and applications submitted to the backend, including
  file upload.
- Public submission forms for suppliers, properties, partnerships and contact,
  each with consent capture, honeypot and timing checks, and retention dates.
- Search, sitemap and robots.

### SEO

Audited across eleven representative pages — every one carries a title,
description, canonical URL, `og:title`, `og:image`, `og:type`, `twitter:card`,
hreflang alternates, JSON-LD, an `html lang` and exactly one `h1`.

- Structured data: Organization, WebSite, Article and NewsArticle, Person,
  BreadcrumbList, FAQPage, JobPosting and Report. Builders return `null` rather
  than emitting incomplete markup.
- A sitemap built from a dedicated endpoint so it cannot silently truncate, with
  hreflang inline, noindex pages excluded and only open roles listed.
- A site-wide social image that reaches every route, not only CMS pages.
- Staging emits noindex site-wide via `NEXT_PUBLIC_SEO_NOINDEX`.

### Bilingual

- English and Urdu from the database up: locale on every content type,
  translation groups, per-locale paths, right-to-left rendering, Nastaliq type.
- An eight-page Urdu spine, marked `IN_PROGRESS` and noindex, so the language
  switch leads somewhere and the translation-status screen shows real work
  outstanding.
- A language switch that follows the page's own hreflang alternates.

---

## Partial

**Urdu content.** The spine exists; the other ~95 pages, and every collection
record, are English only. Translation is content work, and seeding invented Urdu
prose would be the fabrication the brief warns against, in a language fewer
reviewers can check.

**Preview.** The API issues short-lived signed preview links and the public site
honours them uncacheably. The CMS has the button; a side-by-side preview pane in
the editor does not exist.

**On-publish revalidation.** The public site uses time-based ISR, so a publish is
live within the revalidation window rather than instantly. `REVALIDATE_SECRET` is
defined but no publish hook calls the revalidation endpoint yet.

**Notifications.** In-app notifications work end to end. There is no mail
transport, so a password-reset link is logged rather than emailed — which is fine
in development and must be wired before launch.

**Redis.** `REDIS_URL` is accepted and the rate limiter is written against a store
interface, but only the in-memory store is implemented. Rate limits are therefore
per instance rather than shared across them.

**Bulk actions.** The pages list renders a bulk-action bar for publish and delete;
the handlers are not implemented.

---

## Not started

- **End-to-end tests.** `pnpm test:e2e` is wired to Playwright, and no specs
  exist. The integration suite covers the API thoroughly; nothing drives a real
  browser.
- **A visual-regression or accessibility test run.** Accessibility has been
  handled by construction and reviewed by hand — labels, focus order, contrast,
  logical properties, zoom — but nothing automated asserts it.
- **Reports, impact stories and employee stories detail routes** on the public
  site. The API serves them and the CMS manages them; the public routes do not
  exist, so nothing links to them.
- **Form builder editing.** The Forms screen shows what each form collects; it
  does not yet let anybody change it.
- **Media variants.** The schema has `MediaVariant` and the worker has a
  `MEDIA_VARIANTS` job kind that deliberately fails rather than pretending to do
  work. Responsive derivatives are generated by Next's image pipeline for now.
- **Webhooks.** The model and the CMS listing exist; nothing dispatches them.

---

## Known issues

**The seed does not propagate permission changes to existing roles.** This is
deliberate — an administrator who has customised a role should not have that
undone by a deploy — but it means adding a permission to the catalogue does not
reach an existing installation automatically. See
[Permissions](PERMISSIONS.md#adding-a-permission).

**`lang` and `dir` on `<html>` are set by script, not by the server.** The locale
lives below the root layout, so the root layout cannot know it without becoming
dynamic, which would stop every content page being prerendered. The attributes
are set on a wrapper element — which is what assistive technology and CSS
actually read — and mirrored onto the document element before first paint. The
trade-off is documented in
[the content model](CONTENT_MODEL.md#two-languages); revisiting it means
accepting dynamic rendering for all ~100 pages.

**Next's fetch cache can serve stale data to a build.** Building immediately
after a seed can prerender against cached API responses. `rm -rf .next/cache` and
rebuild if a build's output disagrees with the database. It affects development,
not a cold production deploy.

**Reports, timeline and awards use an `isPublished` boolean rather than the
workflow.** Pages, stories, news, press releases, people and policies run the
full editorial state machine. Reports are the arguable one: a corporate report
plausibly deserves review before publication, and promoting it would need a
migration, a seed change and a public-API change. Recorded here rather than
quietly left.

---

## The next exact implementation step

**Write the Playwright end-to-end specs, starting with the publishing round
trip.**

The single highest-value spec, because it crosses every seam the integration
tests cannot:

1. Sign in to the CMS as the seeded administrator and change the password.
2. Create a page, add two blocks, save.
3. Confirm the public site still 404s that path — the draft is not live.
4. Submit for review, approve, publish.
5. Confirm the public site serves it, with a title, a description and a canonical
   URL.
6. Edit the page and save. Confirm the public site still serves the **old** text
   and the CMS shows unpublished changes.
7. Publish again. Confirm the new text is live.

Put it in `apps/corporate-web/e2e/publishing.spec.ts`, run it against the dev
stack with `pnpm test:e2e`. Chromium is already available and Playwright is
configured to find it; do not run `playwright install`.

After that, in order: the supplier submission round trip (public form to CMS
queue to CSV export), and a permissions spec that signs in as an author and
asserts the Publish control is absent and the API refuses it.
