# Content model

## Three shapes of content

**Pages** are composed. A page is a path, some metadata and an ordered list of
blocks, each block an instance of one of 58 definitions with its own schema.
Roughly a hundred pages make up the corporate site, and none of their
information architecture is in the file system — Corporate Communications adding
a page is a publish, not a deployment.

**Editorial collections** are documents: stories, news, press releases, people,
policies. They have an author, a reviewer, a publication moment and a history,
and they run the full editorial workflow.

**Reference collections** are curated lists: timeline milestones, awards,
reports, impact metrics, departments, locations, categories. Their whole
lifecycle is "is this shown, and where in the order", so they carry a publish
flag and a sort order rather than a workflow. They are audited and
permission-checked exactly like editorial content; the difference is the
lifecycle, not the rigour.

A job posting sits between the two. Its lifecycle is a hiring lifecycle — draft,
open, paused, closed, archived — rather than an editorial one, so it keeps its
own status. But setting that status to Open puts it on the careers site, so it
requires the publishing permission even though editing the posting does not.

## Draft and published are separate records

This is the property most of the model exists to protect.

A record's own columns are the **working copy**. `publishedVersionId` points at
an immutable **snapshot** in `content_versions`, and that snapshot is what the
public site serves. Editing a published page therefore cannot change production
until somebody deliberately publishes.

`hasUnpublishedChanges` is set when the working copy is edited while a published
snapshot exists, so the CMS can tell an editor their work is saved but not live.

Restoring an old version writes a **new** version whose data is a copy of the old
one. Nothing is ever destroyed, so "restore the version from before last
Tuesday's mistake" works even if somebody has already restored something else
since.

## The editorial workflow

```
  DRAFT ──submit──▶ IN_REVIEW ──approve──▶ APPROVED ──publish──▶ PUBLISHED
    ▲                   │                      │                     │
    │                   │ request changes      │ schedule            │ unpublish
    │                   ▼                      ▼                     ▼
    └────────── CHANGES_REQUESTED          SCHEDULED           UNPUBLISHED
                                                                     │
                                                                  archive
                                                                     ▼
                                                                 ARCHIVED
```

Not a `published` boolean. Each transition names the permission it requires
(`<prefix>.update` or `<prefix>.publish`), so an author can submit but not
approve, and a reviewer can request changes but not publish.

Two transitions are allowed that look redundant and are not:

- **PUBLISHED → PUBLISH.** Publishing edits to an already-live page is the single
  most common action in a CMS. Because the public site serves the published
  snapshot rather than the working copy, re-publishing is how an editor's changes
  reach production at all.
- **SCHEDULED → SCHEDULE.** Moving a pending publish to a different time is
  ordinary. Forcing a cancel first leaves a window in which the content is not
  scheduled at all, which is exactly when somebody gets distracted.

Requesting changes requires a note, because "changes requested" with no reason is
a message an author cannot act on. Scheduling requires a future time.

## Two languages

Every content type carries a `locale` and a `translationGroupId`. Records sharing
a translation group are translations of each other; that is what lets each one
declare the others as hreflang alternates, and what the translation-status screen
counts.

Paths are per-locale. The seeded Urdu spine uses the same paths as English, so a
shared link survives a language switch — but the model and the slug validation
both allow Urdu slugs, so localising them per page is an editorial decision
rather than a technical limit.

Urdu renders right-to-left. `lang` and `dir` are set on a wrapper element inside
the locale layout rather than on `<html>`, which is what lets the root layout
stay static and every content page be prerendered; a small inline script mirrors
them onto the document element before first paint. The wrapper is what assistive
technology and CSS actually read, so the page is correct with or without that
script.

## Blocks

58 definitions across nine categories: hero (4), editorial (10), media (5),
people (5), data (13), collections (10), calls to action (7), careers (3) and
utility (1).

Each defines a Zod schema, a category, an icon and which page types may use it.
A block's data is validated against that schema on write, so a malformed block
cannot be stored, and the renderer can trust what it is given.

Editors choose blocks, content and a tone (light, muted, dark, accent). They do
not choose colours, fonts, spacing or arbitrary layout values. That is the line
that keeps a hundred-page site looking like one site.

## Media

Assets live in one library with metadata that matters: alternative text,
caption, credit, copyright, usage notes and a focal point, so a portrait cropped
to a wide banner keeps the subject's face in frame.

Files submitted by the public — a CV, a supplier's certificate, a property
owner's floor plan — are stored as media assets so they share one storage
abstraction, but they are **not library material**. They are personal data
belonging to a submission, reachable only through the queue that owns them,
under that queue's own permission, and are never listed, edited or deleted in
the library. The filter has two halves: the private key prefix, which the upload
path controls, and relation checks, which stay true if a future upload path
forgets the prefix.

## Submissions

Five queues: job applications, supplier proposals, property offers, partnership
enquiries and general contact.

Each record is personal data belonging to somebody outside the company. Three
rules follow, and they are in the code rather than in a policy document:

1. The list shows the minimum needed to triage. Everything else is behind the
   record, where opening it is audited.
2. Internal notes are never anything but internal — not sent to the sender, not
   published, and labelled as such where they are written.
3. Export is a separate, higher-risk permission, because extracting a queue in
   bulk is a materially different act from reviewing one record, and is audited
   with the row count.

Every submission records the consent text the sender agreed to and when, and a
retention date.

## What is deliberately absent

No restaurant count, employee count, city count, revenue, market share,
certification, award, sourcing percentage or environmental figure is asserted
anywhere. The seed writes structural placeholders, visibly marked, showing where
approved data goes. Impact metrics are seeded with no values and
`isPublishable` false, and the CMS asks for a methodology before one can be
published — a number without a method is not a fact.
