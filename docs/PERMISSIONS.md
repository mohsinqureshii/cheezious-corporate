# Permissions

76 permissions in 12 groups, 11 seeded roles.

The catalogue lives in `packages/permissions/src/permissions.ts` and the roles in
`roles.ts`. Neither depends on the database or on a framework, so the rules can
be tested as rules and the same module answers "may this person publish?" in the
API and "should this button exist?" in the CMS.

## Where enforcement happens

**In the API, on every request.** `requirePermission(...)` guards the route,
services re-check where a route is generic, and the workflow service derives the
permission a transition needs from the transition itself.

The CMS hides controls a user cannot use. That is a courtesy — showing somebody a
Publish button that will refuse them is bad design, not a security control.
Anyone who forges past the interface meets a 403.

Permissions are re-derived from the session on every request, so disabling an
account takes effect on that person's next navigation rather than at the end of
their cookie's life.

## The roles

| Role                       | Scope                                                                                                       |
| -------------------------- | ----------------------------------------------------------------------------------------------------------- |
| `SUPER_ADMIN`              | Everything. System role: its permissions cannot be edited, so the platform cannot be locked out of itself.  |
| `ADMIN`                    | Everything except granting super administrator.                                                             |
| `CORPORATE_COMMUNICATIONS` | Publishes across pages, editorial, people, policies and impact. Manages navigation, redirects and settings. |
| `EDITOR`                   | Creates and edits content, submits it for review. Cannot publish.                                           |
| `AUTHOR`                   | Creates and edits their own drafts, submits for review. Cannot publish or delete.                           |
| `HR_MANAGER`               | Careers: jobs, applications, employee stories, people records.                                              |
| `PR_MANAGER`               | The newsroom: news, press releases, stories, media coverage, brand assets.                                  |
| `PROCUREMENT_MANAGER`      | Supplier submissions, and nothing else.                                                                     |
| `EXPANSION_MANAGER`        | Property submissions, and nothing else.                                                                     |
| `REVIEWER`                 | Reads everything in scope and moves work through review. Cannot publish.                                    |
| `VIEWER`                   | Read-only.                                                                                                  |

Procurement and Expansion are the two worth noticing. They are scoped to
business reality rather than to a tidy hierarchy: a Procurement Manager can read
and work supplier submissions and cannot see job applications, because a supplier
proposal and somebody's CV are different kinds of personal data belonging to
different teams.

## Naming, and one rule that is load-bearing

Permissions are `<resource>.<verb>`: `pages.publish`, `applications.export`,
`media.manageBrandAssets`.

The editorial workflow derives the permission a transition needs as
`<prefix>.update` or `<prefix>.publish`. **A content type that runs the workflow
must have both keys, whatever else it has.** Without them, every transition is
refused for everybody, super administrator included — which is exactly how
policies shipped briefly unable to be published by anyone. There is an
integration test that walks every workflow content type through submit, approve
and publish, so a type that cannot be moved cannot ship again.

## High-risk permissions

`HIGH_RISK_PERMISSIONS` marks the ones that are not the same kind of decision as
editing a page: publishing, deleting, granting roles, exporting personal data.
The CMS's role matrix marks them, and the audit log records every use.

`PERSONAL_DATA_PERMISSIONS` marks those that read data belonging to somebody
outside the company. The audit log records that a field changed, never what it
changed to, for anything in that set.

## Adding a permission

1. Add the key and its description to `PERMISSIONS`, and put it in a group in
   `PERMISSION_GROUPS` so it appears in the role matrix.
2. Add it to the roles that should hold it in `ROLE_DEFINITIONS`.
3. Run the seed, which upserts the catalogue and re-syncs `SUPER_ADMIN`.

Step 3 does **not** reach existing non-system roles: the seed deliberately leaves
them alone, because an administrator who has customised a role should not have
that undone by a deploy. Propagate it deliberately — either by editing the role
in the CMS's role matrix, or by re-syncing the seeded roles explicitly in a
migration script for that release. On a fresh database, none of this applies.

## Auditing

Every mutating route writes an audit entry: who, what, when, from where, and a
field-level diff of what changed.

The diff redacts. Fields in the redaction list are omitted entirely; fields in
the personal-data list record that they changed without recording the values.
Long text and large arrays are summarised rather than inlined, so an entry for
"renamed a page" does not carry the page's entire body.

Audit writes never fail the operation being audited — a full disk should not stop
an editor publishing — but they are logged loudly when they fail.

Nothing in the CMS can edit or remove an audit entry. That is the only property
that makes keeping one worthwhile.
