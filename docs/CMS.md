# The CMS

An operational tool, not an analytics dashboard. The question it answers on
opening is _what needs me today_, not _how did we do last quarter_.

Visually it follows IBM Carbon's principles rather than its pixels: high
density, square corners, a productive type scale, an 8px spacing grid and a
fixed dark global header. Restraint is the point — someone who lives in this
interface for eight hours should not be shouted at by it.

## Signing in

Sessions are database-backed rather than JWTs, so disabling an account takes
effect immediately rather than when a token expires. Every failure produces the
same message whether the account exists or not, and the interface repeats that
wording exactly — an "unknown address" message would hand an attacker a list of
who works here.

Lockout is two-tiered: per account, against password guessing, and per address,
against credential stuffing.

An invited account is issued a temporary password shown **once**, to the person
doing the inviting, with instructions to pass it on out of band. It is never
stored in readable form and never emailed from the CMS. That account can reach
exactly one screen until it has chosen a new password.

## The screens

### Overview

**Dashboard** — inboxes, the review queue, what publishes today, recent activity
and content health, each section scoped to what the viewer may actually see.

**My work**, **Review queue**, **Scheduled**, **Recently updated** — separate
screens rather than four tabs, because each is a different person's morning: an
author opens My work, a reviewer opens Review, Communications opens Scheduled.
Scheduled leads with failed publishes, which are the only thing on it that needs
somebody today.

### Content

**Pages** — the page list with filters in the URL, so a filtered view is a
shareable link. "The Urdu pages still in review" is something one editor can
send another.

**The page editor** — a block list on the left, an inspector on the right, a
preview, the version history and an SEO panel that shows what a search result
and a shared link will look like and warns while you type rather than after you
publish.

**Stories, News, Press releases, People, Leadership, Timeline, Awards, Impact,
Reports, Policies** — and, under Careers, **Jobs, Employee stories, Departments,
Locations** — are all the same two screens, a list and an editor, built from the
collection's own field description. What differs between a story and a policy is
data, not code.

The editor saves explicitly. Autosave suits a page composition, where the working
copy is separate from what is published; here a save is a deliberate act by
somebody who has finished a thought, and an editor who walks away mid-sentence
should not have that sentence recorded as their intent. Publishing is blocked
while there are unsaved edits, because a transition publishes what is stored
rather than what is on screen.

### Rich text

A structured HTML editor with a toolbar and a preview, not a WYSIWYG canvas. The
markup stays visible on purpose: a WYSIWYG that hides its output is how pasted
Word markup and stray inline styles get into a corporate site and stay there for
years. The server sanitises against an allow-list regardless, so what is saved is
always a subset of what was typed.

### Careers and Partners

Five submission queues — applications, suppliers, properties, partnerships,
contact — sharing one implementation, so the privacy handling cannot drift
between them.

Each record separates three things that answer different questions: what the
sender provided (exactly as they entered it), where the queue has got to, and
what we think. Conflating them is how an internal comment ends up read as the
applicant's own words. Attachments are served through the API, never cached, and
every download is audited.

### Media

A grid, because an image is identified by looking at it. Selecting one opens an
inspector where the metadata is edited in place.

Missing alternative text is a count and a filter at the top of the screen rather
than something to notice. A site's accessibility is the sum of these small
omissions, and they are only ever fixed if somebody can find them. Brand assets
and documents are separate routes: nobody looking for the logo wants to scroll
past four hundred restaurant photographs.

### Structure

**Navigation** — a tree, with items reported as broken when they point at a
deleted or unpublished page. That is the most common way a corporate site
acquires a 404 and it is invisible until a visitor finds it.

**Footer** — per language, because the legal links a Pakistani reader needs and
the ones an English-language reader needs are not always the same list.

**Redirects** — most are automatic: renaming a published page leaves one behind,
which is what stops a rename quietly breaking every link anyone has shared.
Those are marked, because deleting one is deleting the only thing keeping an old
URL alive. The hit count is the useful column. New redirects are refused if they
point at themselves or would close a loop.

### Forms, Localization, System

**Forms** shows what each form collects. Its submissions list carries a
reference, a form and a time and nothing else — a custom form can collect
anything, so the only safe assumption is that it collected personal data.

**Translation status** leads with published English pages that have no Urdu
counterpart. Those are live and half the audience cannot read them, which is a
different problem from a draft nobody has translated yet.

**Content health** is what the platform can tell is wrong without anybody
looking: pages with no description or no content, images in use with no
alternative text, content past its review date. Dismissing an issue requires a
reason — "we know, and here is why" is worth recording, or the next person
re-investigates it.

**Users** shows roles on every row, because "who can publish" is the question the
screen exists to answer, and making somebody open each account to find out is how
the wrong person keeps a permission for a year.

**Roles** is a matrix rather than eleven separate pages, because the real question
is comparative: what can an Author do that an Editor cannot.

**Audit log** is read-only, with the field-level diff behind a disclosure and
personal data shown as having changed rather than as what it changed to.

**Settings** is grouped as the settings are rather than by which table they live
in. **Integrations** lists which settings are configured, never their values — a
settings page is a common place for a secret to end up in a screenshot.

## The command palette

Cmd/Ctrl+K from anywhere: search content and create things. In a system with this
many screens, typing two letters and pressing Enter beats three clicks through a
sidebar every time, for somebody who lives here. `/` is deliberately not bound —
it would hijack typing inside the editor.

## What the sidebar shows

Every navigation item declares the permission that reveals it. A Procurement
Manager signing in sees Partners and nothing else — not a sidebar full of
sections that will refuse them. The API enforces the same permissions
independently.
