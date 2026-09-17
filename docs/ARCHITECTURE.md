# Architecture

Three applications, one database, one set of shared packages.

```
                    ┌──────────────────────┐
  visitors  ───────▶│  apps/corporate-web  │  Next.js · static + ISR · en/ur
                    └──────────┬───────────┘
                               │ HTTP, read-only, cached
                    ┌──────────▼───────────┐
  editors   ───────▶│      apps/api        │◀────── apps/cms  (Next.js · Carbon)
                    │  Express · Prisma    │        session cookie, same origin policy
                    └──────────┬───────────┘
                               │
                    ┌──────────▼───────────┐        ┌────────────────────┐
                    │     PostgreSQL       │◀───────│  apps/api worker   │
                    └──────────────────────┘        │  scheduled publish │
                                                    │  content health    │
                                                    └────────────────────┘
```

## Why the public site does not talk to the database

The corporate site holds no database credentials and no Prisma client. It reads
a small, cacheable, read-only API and nothing else.

That costs a network hop on a cache miss. It buys three things worth more than
the hop: the public site can be deployed to an edge runtime that has no business
holding a database password; a bug in a public template cannot write to
anything; and the shape of what is public is decided in one place — the public
API's projections — rather than in a hundred templates that each select their
own fields. When a field must never be public (an applicant's email, a contact
category's internal routing address), it is left out of a projection once.

## Why the CMS is a separate application

The CMS and the public site share almost nothing. Different audiences,
different visual languages, different performance characteristics, different
security posture: the public site is anonymous and cached, the CMS is
authenticated and never cached. Merging them would mean one set of middleware
trying to be both.

They are separate deployments on separate hosts, so a CMS incident does not take
the public site down with it, and a marketing traffic spike does not slow down
the people publishing.

## Request paths

**A visitor requests a page.** Next matches the catch-all route, asks the API
for the page at that path in that locale, and renders its blocks. The response
is statically generated at build time where possible and revalidated on an
interval; a page published after the build renders on demand and is then cached.
If the path has moved, the API returns the redirect it recorded at rename time
and the route issues a 301.

**An editor saves a page.** The CMS posts to the API. The API checks the session,
checks the permission, validates every block against its Zod schema, sanitises
rich text, and writes. If the page is published, the write does not touch what
the public site serves — that is the published snapshot — and the record is
flagged as having unpublished changes.

**An editor publishes.** The workflow service validates the transition against
the state machine and the actor's permissions, then in one transaction: writes
an immutable version holding the working copy, points the record at it, records
a workflow event, writes an audit entry and notifies whoever needs to know.
Search indexing happens outside that transaction, because a search-index failure
must not roll back a publish.

**Something is scheduled.** The transition enqueues a publishing job keyed on the
entity, so rescheduling moves the job rather than adding a second one. The worker
claims jobs with a conditional update — two workers racing produce one winner and
one no-op — and publishes through the same code path a person's publish takes.

## The shared packages, and what each is for

`packages/page-builder` is the one worth understanding. It defines 58 blocks,
each with a Zod schema. That schema drives the CMS's editor form, the public
renderer's props, the seed's validation and the API's write validation. A block
gains a field by gaining it there, once.

`packages/permissions` holds the permission catalogue, the roles and the
workflow state machine, with no dependency on the database or the framework — so
the rules can be unit tested as rules, and the same module answers "may this
person publish" in the API and "should this button exist" in the CMS.

`packages/seo` is framework-agnostic on purpose: metadata resolution, structured
data builders and the sitemap renderer are pure functions with tests, and the
Next-specific bridging lives in the app. The structured-data builders return
`null` rather than emitting incomplete markup — an invalid JobPosting can get an
entire careers site excluded from Google Jobs, so a missing field means no markup
rather than broken markup.

## Two generic implementations, and why

Two parts of the API are configured rather than written out:

**Submission queues.** Applications, suppliers, properties, partnerships and
contact are one implementation with five configurations. They are the same job —
triage, assign, progress, annotate — and differ only in the fields each form
collects. Written five times, one of them would eventually forget to soft-delete,
or to audit, or to check a permission.

**Content collections.** Twenty-two collections — stories, news, press releases,
people, policies, jobs, timeline, awards, reports, impact and the taxonomies
behind them — run through one implementation configured in
`apps/api/src/modules/collections/`. "An author cannot publish" is written once
and holds for every collection that declares a workflow.

The cost is a layer of indirection. The benefit is that a security property
proved for one collection is true of all of them.

## Where enforcement happens

In the API, on every request, without exception.

The CMS hides controls a user cannot use, because showing somebody a Publish
button that will refuse them is bad design. It is not a security control. Every
route re-derives the actor's permissions from the session on every request, so
an account disabled a minute ago stops working on its next navigation rather
than at the end of its cookie's life.

## Caching

The public API sets cache headers per endpoint; the public site sets a
revalidation window per route. Content that changes hourly (the newsroom, open
roles) is short; content that changes yearly (a policy archive) is long.
Anything carrying a preview token is uncacheable by construction, so an editor's
draft can never be served to a visitor from a shared cache.
