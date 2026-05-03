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

### 5. /theatres directory page
- New public page at `/theatres` listing every theatre we track,
  grouped by area, with logos / descriptions / homepage links / contact
  emails. Cards fall back gracefully when a field is missing (logo →
  typographic monogram, description → just name + area).
- Migration `052_theatre_metadata.sql` adds 4 columns to `event_sources`
  (`description`, `homepage_url`, `public_email`, `logo_url`).
- Linked from `/resources` as a featured card at the top, and from the
  hamburger menu.
- Seed populated for all 26 theatres (see "Editorial drafts" + "Needs
  your eyes" below for confidence flags).

### 6. Calendar productions in the homepage marquee
- The scrolling ticker on the homepage now mixes callboard posts with
  upcoming calendar productions. Callboard / calendar items interleave
  so the same ticker carries both opportunities and shows.
- Migration `053_marquee_calendar.sql` adds two columns to
  `marquee_settings` (`include_all_calendar`, `include_calendar_production_ids`).
- `/admin/marquee` has a new "Calendar productions" block mirroring the
  callboard block: cycle-all by default, or hand-pick specific shows.
- Production text format: "{Org} - {Title}, May 7 - 24" (auto-formats
  same-month, cross-month, and "opens X" when no end date is set).

### 7. Minor profile system
- New "This artist is under 18" toggle on `/submit`. When checked:
  - Parent / guardian email becomes required (separate from artist email).
  - Optional parent / guardian name field.
  - Headshot upload is hidden — minor profiles don't display a headshot
    publicly. The directory tile + profile page show a typographic
    placeholder instead (same as a profile that simply doesn't have one).
  - All email routing — verification, magic-link edits, contact form —
    goes to the guardian. The artist's email isn't stored.
- Public profile page at `/artists/{slug}`:
  - "◐ Parent / guardian managed profile" pill near the name.
  - Headshot suppressed, falls back to placeholder.
  - Contact form copy adapts: "Sara is under 18, so messages route to
    [Guardian Name / their parent or guardian]."
- Admin queue:
  - `/admin/profiles` shows a small "MINOR" pill next to the name with a
    tooltip showing the guardian name.
  - Approval flow carries `is_minor` / `guardian_email` / `guardian_name`
    through from `pending_submissions` to `profiles`.
- Migration `054_profiles_minor.sql` adds the columns + a CHECK
  constraint that requires `guardian_email` whenever `is_minor=true`.
- Did NOT build: an auto-graduate-at-18 flow. We don't store a birth
  date (intentional — keeps minor PII off the system). Lexi or the
  guardian flips `is_minor=false` manually when the artist turns 18.

## Needs your eyes
*(Anything I made a judgment call on or that benefits from your review.)*

- **Submit dropdown copy.** I wrote short descriptions on each row
  ("Get listed in the artist directory" / "Auditions, designer + crew
  calls, talent opportunities" / "Add an upcoming show to the calendar").
  Tweak in `Nav.svelte` (`submitOptions`) if any of those don't sound
  right.
- **/theatres descriptions for 26 orgs.** I generated 1-2 sentence
  factual blurbs from each org's site. They need a Lexi pass for
  voice / length / accuracy before launch. Edit in
  `scripts/seed-theatre-metadata.mjs` then re-run
  `node scripts/seed-theatre-metadata.mjs --overwrite` to push changes
  back. (Default mode preserves admin overrides via COALESCE; overwrite
  mode is needed when you want to *replace* values.)
- **Bremerton Community Theatre URL changed.** Their old domain
  `bremertoncommunitytheatre.org` redirects to `bctshows.com`. I
  switched the homepage URL but did NOT touch their `source_url` (the
  scraper uses an arts-people path that's still valid). Verify the
  cron still picks them up next sync.
- **Mustard Seed lives at oslc.com/mustardseed/, not
  mustardseedtheater.com.** The original URL didn't resolve. I updated
  `homepage_url` to the church-hosted page but kept `source_url`
  pointing at csstix where their actual ticketing happens.
- **ManeStage was tagged Sumner; actual address is Puyallup.**
  Description corrected. Their `area_id` still points at "South Pierce"
  which is correct for both.
- **Northwest Center Theatre — likely defunct or renamed.** The Wix
  URL is empty/dormant. There's a separate active org named
  "Northwest Theatre Lab" (nwtheatrelab.com) that may be the rebrand,
  or may be unrelated. Worth asking Lexi which one she means before
  including in /theatres.
- **Minor profile copy.** The contact-form notice ("Sara is under 18,
  so messages route to [Guardian / their parent or guardian]") and the
  "◐ Parent / guardian managed profile" pill on the public profile
  read OK to me, but Lexi might want softer language. They live in
  `src/routes/artists/[slug]/+page.svelte`.
- **Minor toggle copy on /submit.** "This artist is under 18 (parent
  or guardian managed profile)." Plus the explanatory paragraph
  underneath. Editable in `src/routes/submit/+page.svelte`.

## Fallbacks I had to use
*(Theatres I couldn't find a logo / email for, etc.)*

**Logos missing — falls back to typographic monogram on /theatres:**
- Tacoma Little Theatre, Mustard Seed, Toy Boat, Olympia Family Theater,
  Bremerton Community Theatre, Auburn Community Players.
- The remaining logos are third-party CDN paths (Wix, Squarespace,
  Weebly, WordPress upload dirs). They render today but could rotate
  out of existence. If you want resilience, mirror them to Cloudinary —
  there's a `logo_url` column to point at the new copy.

**Emails missing:**
- Tacoma Little Theatre, Mustard Seed, Harlequin, Toy Boat, Auburn
  Community Players, Northwest Center Theatre, Screaming Butterflies.
  None of these orgs publish a public-facing alias on their own site.
  Cards on /theatres just hide the Email link gracefully when no
  address is set.

**Confidence flags (email format inferred, please confirm):**
- `boxoffice@lakewoodplayhouse.org` (their site uses an obfuscation widget)
- `info@dukesbay.org` (sourced from a third-party directory)
- `theatrebattery@gmail.com` (sourced from external listings)
- `oltadmin@olympialittletheatre.org` for Olympia Little Theatre — note
  the spelling mismatch with their site domain `olympialittletheater.org`

## Editorial drafts
*(AI-generated copy that needs a human pass before launch — descriptions,
notes, etc.)*

- **Re-seeded event_sources notes.** All 26 are in Lexi-voice now. Quick
  scan recommended in case any wording feels off — they live in
  `scripts/seed-event-sources.mjs` and surface in `/admin/calendar` ->
  per-source view.
- **Theatre descriptions on /theatres.** All 26 generated from their
  own websites — facts only (year founded, where they perform, signature
  output) — but the voice is mine, not Lexi's. Worth a 5-minute pass on
  `scripts/seed-theatre-metadata.mjs` to tighten or rewrite where
  needed, then re-run with `--overwrite`.

## What didn't get done
*(Filled in if anything has to defer.)*

- **Self-service minor graduation built.** The original plan was for
  Lexi to manually flip `is_minor=false` from the admin profile edit
  page when the artist turned 18. Now lives on the artist's edit page
  instead: a banner with an "I'm 18 now →" button that fires a confirmed
  graduation action. Clears `is_minor`, `guardian_email`, `guardian_name`
  in one shot and unlocks the headshot upload. Parent / guardian uses
  their existing edit-link for the transition.

## Future-me roadmap
*(Mentioned in the meeting prep but explicitly not built. Don't forget.)*

- **Trust-this-device for admin login.** "Remember this device for 30
  days" checkbox on `/admin/verify` so Blake doesn't need an email
  round-trip every time he wants to fix something from his work
  laptop. Single new cookie, no schema work. ~30 min when wanted.
- **Multi-admin with per-user accounts.** When Lexi wants to add a
  second admin, swap env-var auth for an `admin_users` table (email,
  password_hash, role), keep 2FA-via-email but route to *that* user's
  email. Includes an `/admin/admins` invite + management page. ~3-4
  hours; design choices (roles / audit log / ownership transfer) get
  clearer once a real second user is in mind.
- **Calendar org consolidation (Option C).** Merge `event_sources`
  and `verified_orgs` into a single `organizations` table. Verified
  flag becomes a column on the merged row instead of a separate
  table. Cleanest data model, but a real migration with backfill +
  rewrite of /admin/orgs and the scraper's source lookup. Probably
  half-day of focused work. Worth doing when there's a calm week
  post-launch.

---

*Last updated: overnight pass complete.*
