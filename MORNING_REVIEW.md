# Morning review — overnight work

A running log of what I shipped, what I had to fall back on, what's still
fuzzy, and what needs your eyes before pushing.

Scan the **Needs your eyes** section first — those are the items most
likely to need a tweak before the meeting.

---

## Completed

### 1. Site-content-driven nav labels
- Migration `051_nav_labels.sql` adds four rows to `site_content`
  (`nav.directory`, `nav.calendar`, `nav.callboard`, `nav.resources`) with
  the current defaults so Lexi can rename "What's Playing" / "Opportunities"
  etc. from `/admin/content` without a code change.
- `+layout.server.ts` loads the labels and passes them through to
  `Nav.svelte` via a typed `navLabels` prop. Defaults still kick in if a
  row is missing or its title is blank.

### 2. Calendar-sync GitHub Actions cron
- New workflow `.github/workflows/calendar-sync.yml`. Runs on the 1st of
  every month at 16:00 UTC (8/9 AM PT) and on manual `workflow_dispatch`.
- Uses the existing `SUPABASE_DB_URL` + `ANTHROPIC_API_KEY` secrets.
  Skips inactive sources, manual-entry rows, admin-locked productions,
  and soft-deleted rows. HTML hash cache means most months cost a few
  cents.

### 3. Lexi-voice notes for all 26 event sources
- Rewrote `scripts/seed-event-sources.mjs` so every `notes` field reads
  like an operator instruction, not a developer comment. Removed every
  reference to "Phase 5", `?format=json`, Cloudflare, "ad hoc",
  Playwright, etc.
- Each note now answers: where is this org, does it auto-pull, and (if
  not) where does Lexi look to add a show by hand. URL-rotation
  reminders flagged for the orgs that need them yearly.
- **Re-seed required to land these notes in the DB** (run
  `node scripts/seed-event-sources.mjs` once on staging). The seed is
  idempotent and only updates the rows it owns.

### 4. Top-nav Submit dropdown + harmonized per-page CTAs
- The Submit pill in the top nav is now a dropdown with three items:
  "Submit your profile", "Post a call", "Post a performance". Each row
  shows a one-line description so it's obvious which is which.
- Closes on outside click + Escape, same pattern as the hamburger menu.
- The three landing pages (Directory, Calendar, Callboard) now share a
  consistent masthead pattern: headline on the left, "Submit X →" CTA
  on the right with a count below it. Calendar's old big-button CTA
  was replaced with the lighter text-only style to match callboard;
  Directory got a "Submit your profile →" CTA it didn't have before.

## Needs your eyes
*(Anything I made a judgment call on or that benefits from your review.)*

- **Submit dropdown copy.** I wrote short descriptions on each row
  ("Get listed in the artist directory" / "Auditions, designer + crew
  calls, talent opportunities" / "Add an upcoming show to the calendar").
  Tweak in `Nav.svelte` (`submitOptions`) if any of those don't sound
  right.

## Fallbacks I had to use
*(Theatres I couldn't find a logo / email for, etc.)*

## Editorial drafts
*(AI-generated copy that needs a human pass before launch — descriptions,
notes, etc.)*

- **Re-seeded event_sources notes.** All 26 are in Lexi-voice now. Quick
  scan recommended in case any wording feels off — they live in
  `scripts/seed-event-sources.mjs` and surface in `/admin/calendar` ->
  per-source view.

## What didn't get done
*(Filled in if anything has to defer.)*

---

*Last updated: in progress.*
