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
- 37 Playwright end-to-end tests (`pnpm test:e2e` in `apps/corporate-web`) that
  drive a real browser against a running stack: the publishing round trip,
  permission boundaries, the submission queues, responsive layout at five
  widths, the publication and story detail pages, and the accessibility
  properties that are cheap to regress — heading order, skip link, image
  alternatives, zoom, and right-to-left rendering.
- PostgreSQL 16 + Prisma 6: 91 models, 29 enums, two migrations, zero schema
  drift. Full-text search via a trigger-maintained `tsvector` with GIN and
  trigram indexes.
- Idempotent seed: the permission catalogue, eleven roles, 60 block definitions,
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

- Pages with a 60-block composition system, driven by Zod schemas that are the
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
- On-publish cache invalidation: publishing, unpublishing, renaming or deleting
  anything asks the public site to revalidate the tags and paths it affects,
  authenticated with a shared secret and compared in constant time. A rename
  invalidates the old address as well as the new one. The call is fire-and-
  forget with a short timeout: a public site that is down must not be able to
  fail a publish, and time-based ISR remains the backstop.

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

### Public detail routes

- Publications at `/company/resources/publications/[slug]`, impact stories at
  `/company/impact/stories/[slug]` and employee stories at
  `/company/people/stories/[slug]`. Each carries its own metadata, hreflang
  alternates, breadcrumbs and JSON-LD (`Report` for a publication, `Article` for
  a story), and appears in the sitemap.
- Two blocks added so the records are reachable rather than merely addressable:
  `ImpactStoryGrid` and `EmployeeStoryGrid`. The impact section previously
  listed newsroom stories under the heading "Impact stories", and the employee
  stories index listed newsroom pieces about colleagues rather than the
  employee-story records themselves.

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

- **Visual-regression testing.** The end-to-end suite asserts structure and
  behaviour, not pixels. Nothing would catch a layout that is wrong but
  well-formed.
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

**Implement the two bulk actions the pages list already offers.**

The pages list renders a selection checkbox per row and a bulk-action bar with
Publish and Delete. Neither is wired, so the interface promises something it
does not do — the worst kind of gap, because nothing about the screen says so.

1. Add `POST /api/cms/pages/bulk` in `apps/api/src/modules/cms-pages.routes.ts`,
   taking `{ action: 'PUBLISH' | 'DELETE', ids: string[] }` with a hard cap on
   `ids` (50 is plenty, and an unbounded bulk endpoint is a denial-of-service
   waiting to be found).
2. Run each id through the **existing** single-record path rather than a
   `updateMany`: the workflow guard, the version snapshot, the audit entry and
   the notification all have to happen per page, and a bulk write that skips
   them is how a system quietly loses its history.
3. Return a per-id result — `{ id, ok, reason? }` — rather than failing the
   whole request on the first refusal. A selection of twelve pages where the
   user may publish eleven should publish eleven and say why the twelfth did
   not.
4. Revalidate once at the end, with every affected path, instead of once per
   page.
5. Wire the bar in `apps/cms/src/components/content/PagesTable.tsx` to the new
   endpoint, and show the per-id failures rather than a single toast.
6. Add an integration test covering the mixed-permission case, which is the one
   that matters and the one a `updateMany` implementation gets wrong.

After that, the honest remaining list is: the form builder's editing screen,
webhook dispatch, a mail transport, media variants, and Redis-backed rate
limiting — none of which block anything else.
