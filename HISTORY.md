# History

What's shipped, version by version. For active work see [TODO.md](TODO.md); for stable references see [ARCHITECTURE.md](ARCHITECTURE.md).

---

## v1 — Directory only (shipped)

The minimum viable site: artists submit, get approved, edit, get contacted.

- Public artist submission form with email verification before queue
- Admin pending queue with daily digest at 8am if non-empty
- Admin profile management (search, edit, unpublish, soft-delete with 30-day recovery)
- Magic-link edit flow with resend; tokens single-use, 24h expiry, invalidated on use
- Public directory with filters (discipline, availability, experience level, union, area, age range, languages)
- Profile pages with contact form (Resend-routed, real email never exposed)
- Email blocklist in admin panel
- Report button on profiles → admin queue
- Featured profile rotation on homepage (date-bucketed seed, not pure random)
- Editable homepage / about / support us / contact / footer copy via admin (markdown + toolbar)
- Editable email templates via admin (markdown)
- Announcement banner (optional, with date range)
- Editable disciplines list
- Email-deliverability bundle: SPF, DKIM, DMARC, verified test sends
- Sitemap.xml + per-page robots meta (public pages indexed; admin / edit / queue noindex)
- Graceful Supabase outage page (catch DB connection failure, render "back soon" template)
- "Member since" date on profiles
- Privacy + Terms pages (editable from `/admin/content`)
- Profile delete flow (artist-initiated from edit page)
- Headshot rights consent checkbox on upload
- About / Contact / Support Us pages
- Trust system (Phase A + B): see ARCHITECTURE.md
- Themed `ConfirmModal` replaces all `window.confirm()` calls

### v1 cron jobs (5 of 5 shipped)

Supabase keepalive, daily admin digest, email volume alert at 70% / 90%, weekly callboard digest, weekly Supabase JSON backup, stale profile cleanup (18-month "still active?" ping plus 30-day soft-delete trash sweep). All as GitHub Actions.

---

## v1.1 — Resume features + Mentorship (shipped)

- ✅ **Structured resume builder.** `resume_data` jsonb on profiles. Three sections (credits / training / skills), each a typed list with Up / Down / Remove. Generic across disciplines. Renders inline on the public profile.
- ✅ **PDF resume upload (multiple per profile).** `resumes` jsonb array of `{label, url}`. Cloudinary raw uploads. Pre-upload `ConfirmModal` warns about contact-info on public-directory PDFs.
- ❌ **PDF parsing / column mapper.** Cut. Folded into the redaction tooling discussion (see TODO.md parking lot) — the structured builder sidesteps the use case.
- ✅ **Mentorship opt-in.** `mentorship_offering` + `mentorship_seeking` text-array columns. Surfaced in profile sidebar and as filter chips on the directory; the discipline picker doubles as a lens.
- ❌ **Profile QR code.** Skipped. Replaced with a Share button (`navigator.share` on mobile, clipboard fallback on desktop).
- ✅ **Analytics: GoatCounter.** Drop-in script gated on `PUBLIC_GOATCOUNTER_CODE`. Public routes only.

### v1.1 polish (mostly shipped via mig 017–044)

- Areas refactor: regions with anchor cities + descriptions for hover tooltips
- Disciplines bulk-add (~140 across 13 categories) + category management UI
- Sort + filter polish: Newest / Recently updated / Last name A-Z; strict age filter with exclusion note; "Has headshot" chip
- Directory pagination at PAGE_SIZE=24
- Material Symbols person icon for missing-headshot placeholder
- Sidebar disciplines / unions / ethnicities / languages render as chips
- City field (display refinement; directory area filter still keys on `geographic_area`)
- Mobile admin polish; profile-mgmt table → card collapse under 720px

---

## v1.2 — Callboard + Notification opt-ins + Productions data (shipped)

- ✅ Callboard public page (filterable by post type, list + card views)
- ✅ Public callboard submission form (with email verification for unverified posters)
- ✅ Admin callboard moderation (approve / reject / soft-delete with trash)
- ✅ Verified theatre organization application + approval flow
- ✅ Verified-org callboard posts go live immediately without per-post approval
- ✅ Auto-unpublish posts after audition / closing date (lazy on page load)
- ✅ Opt-in weekly digest with per-row unsubscribe token + edit-page toggle + Sunday-evening cron
- ✅ `productions` table populated from approved audition / production posts at both approve paths
- ✅ Resource library (`/resources`, `/admin/resources`, categories + soft-delete + sort_order)
- ✅ Homepage marquee fed by callboard + calendar productions
- ✅ Admin sidebar reorder + visual grouping + attention badges

---

## Launch-prep work (2026-04-29 sessions)

- **Bulk import.** `scripts/bulk-import-profiles.mjs` — folder-based importer for the artists who emailed bios + headshots in before the site existed. 27 profiles + 1 resume PDF imported, magic-link edit URLs parked in `_results.csv`. See [scripts/BULK_IMPORT_README.md](scripts/BULK_IMPORT_README.md).
- **URL normalisation** at save and render time (`lib/util/url.ts`).
- **Admin profile thumbnails.** 44px round headshot next to each row on `/admin/profiles`.
- **Discipline rename + cascade** at `/admin/disciplines` (handles both clean rename and merge cases).
- **Admin Edit shortcut** on profile pages — logged-in admins see a thin bar with status pill + edit link.
- **Word doc resume support.** ResumesEditor accepts `.docx` and `.doc`; bulk import auto-converts via PowerShell + Word COM on Windows.
- **Ko-fi widget** on `/support-us`.
- **Email pipeline LIVE.** Domain `southsoundtheatreartists.org` registered at Squarespace, DNS at Cloudflare. Resend domain-verified. Email Routing forwarding `lexi@` + `hello@` to Gmail. Send-As via Resend SMTP.
- **Netlify staging deploy LIVE** at `https://southsoundtheatreartists.netlify.app`.

### Polish layer (2026-04-29 evening)

- `/admin/submit-form` reference-data hub (areas / unions / ethnicities) with cascade-rename.
- Auto-save sort number on blur.
- Mentorship dots on directory headshots (moss + rust, custom tooltip).
- Discipline display order with "SHOWS ON CARDS" badge on the top two.
- Complete-to-publish gate for bulk-imported profiles.
- Required headshot/photo + relabel from "Headshot."
- Awaiting email verification panel on `/admin`.
- Sort tiebreaker (`member_since DESC, created_at DESC`).
- Profile edit save banner placement (next to button, not just header).
- Resume privacy reminder banner above resume list.
- Body weight bump (Inter Tight 500).

---

## Post-launch-prep sessions (2026-04-30 → 2026-05-06)

Mostly listed as commits in [TODO.md](TODO.md) "Unpushed commits." Highlights:

- Theme: drop Auto mode (32037b5)
- Resources: multi-category tagging (36c0d95 + 5dab51c + 200b172, parked cleanup mig 070)
- Mentorship: dedicated `/mentorship` discovery page (22b832f) + accordion filter (a0ae07f)
- Homepage: playbill redesign + three-door nav + spotlight rework (362287e)
- Calendar org consolidation (mig 065) → single `organizations` table
- Trust-this-device admin login (mig 066)
- Marquee: calendar items deep-link with `?highlight=` and pulse
- Email: HTML pipeline with signature substitution (migs 067 + 068)
- Weekly community digest: double-opt-in + calendar slice (mig 069)
- Weekly digest: per-dimension filters + manage page (migs 071 + 072)
- Email: audience-based pause via `EMAIL_PAUSE_COMMUNITY` (mig 073)
- Calendar grid pills: bump font sizes + add caps tracking
- Brand sweep: V3 logo (Lexi's masks + wordmark) shipped, then color palette reverted to moss / terracotta / dark-blue (kept the V3 logos)
- Favicon tinted moss
- "Other" area is a self-sufficient pick (mig 074); empty area no longer defaults to "Other" on edit forms
- 3 more bulk-imported profiles (Hester Elwell, JoJo Flores, Thomas Morisada) — currently hidden drafts

---

## v1.3 — Multi-resume + Production credits + Multi-admin + Blog + OG cards (shipped 2026-05-07)

Big batch from a single working session. ~25-35 hrs of focused work distilled to one day. Migs 078–087.

### Multi-resume (mig 078)
- Replaces single `profiles.resume_data` jsonb with relational `resumes` + `resume_entries` tables.
- Artists can keep multiple named resumes (Actor / Director / Scenic Designer / etc.); each entry's `resume_ids` array decides which resumes it appears on. Same credit can land on two resumes via the chip toggles.
- Public picker on `/artists/[slug]?resume=<id>`; defaults to the resume with the most entries.
- New `MultiResumeBuilder` component on `/edit/[token]` and `/admin/profiles/[id]/edit` — live-mutation API at `/api/edit/[token]/resumes` and `/api/admin/profiles/[id]/...` (token-validation never burns the token, only the main form submit does).
- Resume changes no longer flow through the trust gate (low abuse risk; production-credit auto-link is the real constraint).
- `resume_data` column kept as a synced shim through the session, then dropped entirely (mig 087) along with `syncLegacyResumeData()` once all reads / writes were redirected.

### Production credits (mig 079)
- Each calendar item gets a public `/calendar/[id]` page with cast + production team in card grid layout (face-detected headshot + name + role).
- New `production_credits` table with `category` enum (originally cast/creative/crew, simplified to cast/production in migs 084 + 085) and `source` enum tracking who tagged it (`admin` / `org` / `artist`).
- Admin editor at `/admin/calendar/[id]/credits`: quick-add row, paste-cast-list parser (handles "Name as Role", "Name - Role", "Director-Name", "Name, Role", multi-name lines like "Interns - Nova and Savannah", multi-role positions like "Tech Director/Scenic Designer/Visuals"), fuzzy "Find profile" with token-AND substring matching, inline category + position edit.
- Auto-link by exact (and fuzzy 2-token) name when admin/org/submitter types a name without clicking the autocomplete: "Blake York" → links to "Blake R. York" if exactly one published profile matches.
- Tagging an artist auto-creates a linked `resume_entries` row in the artist's inbox; admin/org untag converts it to source='hand' so the artist keeps the earned credit.
- "Currently appearing in" badge on profile pages for cast credits + "Currently working on" for production-team credits.
- Calendar list links each entry to `/calendar/[id]`; external "Tickets ↗" still surfaces from the detail page.

### Org self-serve credit tagging
- Admin generates a magic-link from `/admin/organizations` (60-day TTL, purpose=`org_edit`), copies the URL out of the form-ok banner and shares with the org rep out of band. No public request form — keeps the v1.1 surface small.
- Org rep lands on `/org-edit/[token]`, sees their org's productions, manages credits per-production via the same `ProductionCreditsEditor` component admin uses (different `apiBase`).

### Artist self-claim credits
- "Claim a production credit" form on `/edit/[token]`: search productions by title, pick one, fill role + category. New credit gets `source='artist'`; the linked resume row lands in the artist's inbox.

### Cast list capture on `/calendar/submit` (mig 082)
- Optional poster image upload (Cloudinary `posters` folder, public `/api/cloudinary/sign-poster` endpoint) + "Cast & production" section with type-ahead artist autocomplete + paste-cast support. Credits insert at submission time, stay invisible until status='approved'.

### Multi-admin (mig 080)
- `admin_users` table replaces single env-var auth. First login from ADMIN_EMAIL+ADMIN_PASSWORD bootstraps the owner row (scrypt password hash, no new dep — uses `node:crypto`).
- 2FA codes route to the admin's own email after multi-admin migration (not the ADMIN_EMAIL env).
- `/admin/admins` (owner-only) — invite via 7-day magic link → invitee sets password at `/admin/accept-invite/[token]`. `admin_sessions` and `admin_trusted_devices` carry `admin_user_id` FK.
- mig 083 extended `magic_link_tokens.purpose` check constraint to allow `org_edit` and `admin_invite`.

### Blog (mig 081)
- `/blog` public list + `/blog/[slug]` detail. Markdown editor + toolbar matching `/admin/content`, optional cover image (Cloudinary), author byline.
- Scheduled publishing: optional datetime-local field, public query gates on `published_at <= now()`, no cron needed. "⏰ Scheduled" pill in admin list.
- Footer + nav header link to `/blog`.

### Per-artist OG / social-share cards
- `buildOgCardUrl()` in `src/lib/server/cloudinary.ts` produces a Cloudinary delivery URL (face-detected headshot fill + name in Playfair Display + discipline in Work Sans + SSTA wordmark logo overlay). Falls back to the generic site card for non-Cloudinary headshots and minor profiles.
- One-off `scripts/upload_og_logo.mjs` uploaded `static/logo-long.svg` to Cloudinary at `brand/og-logo` for the layer.

### Admin panel improvements
- `/admin/organizations`: name, slug, area, description, homepage, ticketing URL, logo all editable from one panel. Slug-collision check excludes the row being edited.
- `/admin/calendar/[id]/edit`: cover image URL field with preview. Theatre name on `/calendar/[id]` now opens the org homepage in a new tab when set.
- `/admin/profiles/[id]/edit`: drops the disciplines + area required-field checks (admin can save partial rows; the public profile query still gates on `published=true`).
- `/admin/blog`: list + new + edit + soft-delete + restore. "Lexi" hardcoded defaults removed from blog author byline + admin profile bio placeholder.

### Schema migrations applied
- 078 `multi_resume` — resumes + resume_entries
- 079 `production_credits` — credits + FK back to resume_entries
- 080 `admin_users` — multi-admin tables + session FKs
- 081 `blog_posts`
- 082 `production_cover_url`
- 083 `magic_link_purposes` — extends purpose check constraint
- 084 + 085 `production_category_value` + `_backfill` — cast/production simplification
- 086 `org_ticketing_url`
- 087 `drop_resume_data_jsonb` — removes the legacy column
- 088 `resources_cleanup` — drops the `resources.category_id` compat shim from migs 062 + 063

---

## v1.4 — Calendar adapter expansion (shipped 2026-05-08)

Refactored `scripts/_lib/calendar-sync.mjs` so per-org extraction
dispatches by the `adapter` column on `organizations`. Each adapter
is a self-contained module under `scripts/_lib/adapters/` that takes
a source row + opts and returns `{ shows, hash, cost }`; the
orchestrator handles cache short-circuit, performance expansion, and
the productions/performances upsert identically across adapters.

### New platform adapters

- **squarespace-json**: fetches `/events?format=json`, paginates,
  per-item Claude detail prompt against the body HTML. Cheaper +
  more reliable than scraping Squarespace HTML.
- **ovationtix**: plain-fetch `web.ovationtix.com/trs/cal/{accountId}`
  for the season list (server-rendered), then headless-Chromium
  render of `ci.ovationtix.com/{accountId}/production/{id}` for
  per-show schedule. Falls back to Fri/Sat 7:30pm + Sun 2pm when
  Playwright times out (community-theatre default).
- **ludus**: headless-Chromium render of `{org}.ludus.com` to clear
  the Cloudflare JS challenge, then Claude extraction.
- **eventbrite**: headless-Chromium render of
  `eventbrite.com/o/{organizerId}` then Claude extraction. Per-show
  detail-crawl on the rendered show page.

### Adapter migrations (applied directly to dev DB)

| Org | Was | Now | Result |
|---|---|---|---|
| Bainbridge Performing Arts | manual | squarespace-json | 14 shows, 56 perfs |
| Centerstage Theatre | manual | ovationtix | 6 shows, 71 perfs |
| Renton Civic Theatre | manual | ai-generic | 1 of 5 shows (rescue heuristic untested due to Anthropic cap) |
| Dukesbay Productions | manual | eventbrite | 0 shows (no current Eventbrite events) |
| Tacoma Little Theatre | ai-generic (main site) | ludus | 4 shows, 37 perfs |
| ManeStage Theatre Company | ai-generic (main site) | ludus | 2 shows, 20 perfs |

### Infra

Playwright is a dev-only dependency that lives in the GitHub Actions
runner; never ships to Netlify. Workflow installs Chromium with deps
and caches the browser binary across runs. `fetchHtmlRendered` helper
loads playwright lazily so adapters that don't need it have zero
import cost. `closeBrowser()` in the cron entry script ensures
Chromium exits cleanly.

Added a conservative "rescue" pass to ai-generic: when Claude returns
< 3 shows but the season page has >= 3 anchors matching `/shows/`,
`/show/`, `/productions/`, or `/production/` paths, the unclaimed
anchors are added as stub shows and pushed through detail-crawl.
Motivating case: Next.js streaming HTML on rentoncivictheatre.org
where the duplicated content confuses Claude's enumeration. NOT
verified live (Anthropic monthly spend cap hit before validation;
resets 2026-06-01).

### Final cron coverage

19 of 26 orgs now auto-pull (15 ai-generic + 1 squarespace-json + 1
ovationtix + 2 ludus + 1 eventbrite). 8 manual (placeholder sites,
touring, login-walled, or insufficient public schedule info). Cron
runs monthly on the 1st via GitHub Actions.

---

## v1.4 launch-prep batch (May 9-10 2026, unpushed at writing)

Final pre-launch session covering hygiene, schema additions, bug
fixes, and content infrastructure. ~65 commits stacked on the
worktree branch; HISTORY entry is here so the next session can pick
up cold without re-deriving what shipped.

### Schema (migs 100-106)

- **mig 100**: `profiles.invited_at`, `auto_hidden_incomplete`,
  `completion_warning_sent_at` for the launch-grace pipeline.
  Bulk-imported profiles get a 30-day window to complete required
  fields; cron warns at T+27 and auto-hides at T+30. Save handlers
  on `/edit/[token]` + `/admin/profiles/[id]/edit` auto-republish
  when the artist fills in the missing fields.
- **mig 101**: `launch_completion_warning` email template seeded.
- **mig 102**: digest subject prefixed with `{{digest_date}}` so
  Gmail stops threading consecutive digests into one collapsed
  conversation (which was triggering aggressive "trim quoted
  content" on the footer).
- **mig 103**: `callboard_posts.publish_at` for scheduled-publish.
  Public list, single-post page, marquee, /digest, cron, and live
  preview all gate on `publish_at <= now()`. Submit form's
  expires_at is now capped at publish_at + 90 days.
- **mig 104**: `profiles.phone` + `pending_submissions.phone`.
  Optional, **never rendered publicly** (audited every public
  query). Display-time formatter `formatPhoneDisplay()` canonicalises
  the admin's tap-to-call link. Future casting tool will route
  callbacks here; trust gate may need to escalate when that ships.
- **mig 105**: `organizations.categories text[]` replacing the old
  single-value `category` enum. Drives /theatres chip filter +
  per-card badge render. Vocabulary lives in
  `src/lib/server/orgCategories.ts` (Theatre, Educational Theatre,
  Opera, Ballet, Symphony, Youth, Venue, Other) - adding a slug +
  label there auto-surfaces on /theatres, /admin/organizations, and
  /callboard/apply-verified. Mig also seeded two new callboard post
  types: `youth_programming` and `teaching_artist`.
- **mig 106**: `designer` + `crew` callboard post types consolidated
  into `production_team` (active=true at sort_order 20). Old slugs
  set active=false rather than deleted so email_log stays readable.

### Bug fixes

- **Verified-badge gating** (`f57875f`): the "Verified producing
  company" check on callboard posts was rendering whenever
  `organization_id` was non-null, regardless of `orgs.verified`.
  Triggered by admin-authored posts linking to producing-but-
  unverified theatres. Fixed across /callboard list, /callboard/[id],
  /admin/callboard list. New `loadVerifiedOrgIds()` helper in
  `lib/server/verifiedOrgs.ts`.
- **About page name alignment** (`89de0b7`): when bio paragraph was
  shorter than the floated headshot, the next member's name h3
  rendered at the wrong Y. Fixed via `min-height: 260px` on bio
  paragraphs.
- **stale-cleanup `todayIso` duplicate const** (`cd49728`): would
  have crashed Stage B on first run.
- **test-email column-name mismatches** (`455e23d`, `086a9c9`):
  used `email_verification_token` (no `_hash` suffix) and a
  non-existent `submitter_name` column.
- **Backup script gap** (`2e1ee04`): table list was missing 10
  critical tables - resumes, resume_entries (every artist's resume
  builder content), performances (697 rows), production_credits,
  blog_posts, admin_users (auth bootstrap), event_categories,
  ethnicities, callboard_post_types, admin_trusted_devices.
  Restoring from a pre-fix snapshot would have left admin locked
  out and every artist's resume erased. Now dumps 31 tables / 1513
  rows.
- **XSS in markdown link rendering** (earlier in the May-9 work
  tagged d0543be): `[link](javascript:...)` would render clickable;
  `"` in the URL could break out of href. Fixed via `safeUrl()`.

### Anti-spam + auth hardening

- Rate limit (5/hour/IP) extended to four previously-unprotected
  public POST endpoints: `/edit-link`, `/callboard/subscribe`,
  `/callboard/apply-verified`, `/report` (`36ec29d`).
- Callboard submit `contact_info` made required (was optional;
  posts without contact info had no actionable next step).

### Cron schedule

- `callboard-weekly-digest` moved from 01:00 UTC Mon (5/6pm PT
  Sunday) to **06:59 UTC Mon (11:59 PM PT Sunday PDT / 10:59 PM
  PST)**. Old timing fired while Sunday-evening shows were still
  running, filtering them as already-closed. New timing lands the
  digest after every Sunday performance has ended and still puts it
  in inboxes for Monday morning.

### Content + UX

- **Phone field**: optional, private. Form wiring + helper utils +
  bulk-import column + admin display formatter. 21 phones
  back-filled from earlier email submissions via one-shot script.
- **Multi-badge orgs on /theatres**: chip filter row at top, badges
  on each org card. TLT / TMP / Lakewood pre-tagged as both Theatre
  and Educational Theatre.
- **/callboard/apply-verified gains area + categories pickers**.
  New applicants now land cleanly on /theatres without admin having
  to fill those in by hand.
- **Admin callboard form parity** with the public submit form:
  required publish_at + expires_at with the 90-day cap, dropped
  Volunteer comp option, hide details when type=None, drop
  `deadline_text`.
- **/digest page mirrors the email's sub-sections**: New this
  week / Still open / Closing this week (callboard) and Opening
  this week / Opening next week / Currently running / Closing
  this week (calendar). "Still open" plugs the dead-zone where a
  4-week-out audition would otherwise vanish from the digest after
  week 1.
- **Callboard post button label** adapts to post type ("Tickets &
  info" for production posts, "More info" otherwise).
- **Callboard production_team consolidation**: designer + crew
  merged. New post types youth_programming + teaching_artist
  cover camp / class / educational hiring without conflating
  artist-facing gigs at educational venues.
- **Date ranges in digest don't break across lines**: NBSP +
  non-breaking hyphen used to glue `(May 1‑May 17)` chunks.
- **Date-prefixed digest subject** stops Gmail thread-collapsing
  (and the resulting "trim quoted content" on the footer).
- **Calendar search + typeahead** + page-padding and width caps on
  the search input.
- **Resume builder polish**: per-kind collapse, always-visible
  Inbox tab, refresh-on-claim, smart claim feedback, bigger bio
  textarea, etc.
- **About page**: clickable team headshots + names link to public
  profiles. Leischen Moore + LaNita Hudson Walters added as
  Advisory Committee. Lexi's title rephrased to "Founder."
- **Removed pre-launch /admin/email-test panel** + its DB fixtures
  (Test Profile, Test Org, Test Callboard Post, Test Production,
  test subscription, magic-link tokens).
- **/support-us reverted from Ko-Fi widget** to "donations soon +
  best support is profile + tell friends" pending Lexi finishing
  her Ko-Fi Stripe/PayPal connect.
- **TODO.md reorganized** around ownership questions (Launch-day
  sequence / You need to do / Claude can do / Parking lot / Skips
  / v1.1 review checklist).

### Known gaps queued for follow-up

- `/calendar` doesn't yet filter by org category (Educational
  Theatre etc.) - production list query doesn't join orgs.categories.
  Filed in TODO §3 "Pre-launch hygiene."
- Self-serve callboard post edit (TODO parking lot, post-launch
  definite build).
- Verified-org CSV bulk import (parking lot, demand-driven).
- /help page (parking lot, demand-driven).
- Profile CSV export with phone-PII guard (parking lot, when an
  export feature gets built).

---

## v2.x audit (2026-05-02) — ready for Phase 0 dry-run

**Goal:** the site shows what's playing across South Sound theatre even when companies don't manually post to the callboard.

### Approach (in order of preference, never raw HTML scraping as a default)
1. JSON-LD `Event` schema in the org's site source.
2. iCal / Google Calendar feeds.
3. Ticketing platform APIs / feeds (Tessitura, AudienceView, OvationTix, Eventbrite).
4. AI extraction from a stable season-list URL (Claude Haiku 4.5).
5. Custom HTML scrapers — last resort.
6. Admin review queue — every scraped event lands as a draft; Lexi approves before it goes live.

### Audit findings (26 orgs)
- **No org exposes JSON-LD Event schema usably.**
- **One org exposes a clean structured feed**: Bainbridge Performing Arts via Squarespace's `/events?format=json`.
- **Six orgs share Arts People / OvationTix ticketing** — one platform adapter covers them all.
- **Eleven orgs render a clean season list as plain HTML text** at a stable URL — ideal for AI extraction.
- **One org exposes Eventbrite per-show JSON-LD** (Dukesbay).
- **One org has a likely Next.js JSON endpoint** (Renton Civic).
- **Three orgs need extra work**: New Muses (no season index), OLT (titles on index, dates on per-show subpages — two-step crawl), OFT (bot-blocks WebFetch — needs UA spoof or headless).
- **Four orgs are walls**: Toy Boat, NW Center Theatre, Screaming Butterflies, String & Shadow.

### Architecture decisions (settled 2026-05-02)
- **Vendor:** Anthropic API (Claude Haiku 4.5). $5 of free signup credits cover ~5 years; thereafter ~$1-2/year. Hard monthly spend cap set as belt-and-suspenders.
- **Cadence:** monthly cron is plenty. Per-source `cadence_days` override.
- **Cost-saving cache:** SHA-256 hash of cleaned HTML; skip the AI call when content hasn't changed.
- **Manual refresh button** in admin per source. 1-hour cooldown.
- **Review queue non-negotiable.** After 2-3 months of consistent quality per org, individual orgs could be opted into auto-publish (mirrors `profiles.trusted`).
- **Stale-source detection:** `last_successful_at` + `last_show_count`; email Lexi after 2 weeks empty with a "this URL probably needs updating" alert that suggests the next likely slug.

### Schema direction
Multi-tag, not exclusive categories. Each org carries an array of tags so it can belong to multiple buckets simultaneously. Default-on tags: `producing`, `venue`, `youth`. Default-off: `opera`, `symphony`, `college`, `high-school`.

### Org list (26 orgs, post-audit)

| Region | Org | Adapter | Source |
|---|---|---|---|
| Tacoma | Tacoma Little Theatre | ai-generic | `/blog/tag/2025-2026` |
| Tacoma | Lakewood Playhouse | ai-generic | `/season-87.html` |
| Tacoma | Tacoma Musical Playhouse | ai-generic | `/season-and-show-tickets` |
| Tacoma | Dukesbay Productions | eventbrite | Eventbrite organizer |
| Tacoma | New Muses | manual | no season index |
| Tacoma | Toy Boat | manual | login-walled |
| Tacoma | Screaming Butterflies | manual | month-precision only |
| Tacoma | Mustard Seed | ai-generic | `mustardseedtheater.csstix.com` |
| South Pierce | ManeStage | ai-generic | `/current-season` |
| South Pierce | NW Center Theatre | manual | placeholder site |
| Olympia | Harlequin | ai-generic | `/season-{year}/` |
| Olympia | Olympia Little Theatre | ai-generic-crawl | `/shows/` index → subpages |
| Olympia | Olympia Family Theater | ai-generic w/ UA | `/announcing-our-{yy}-{yy}-season/` |
| Olympia | Theater Artists Olympia | ai-generic | `/calendar` |
| Olympia | String & Shadow | manual | touring |
| Olympia | Animal Fire | ai-generic | homepage |
| Olympia | Evergreen | ai-generic | `/season66` |
| South King | Centerstage | ovationtix | account 36978 |
| South King | Renton Civic | nextjs-probe | `_next/data/{buildId}/...json` |
| South King | Burien Actors Theatre | ai-generic | `/this-season/` |
| South King | Theatre Battery | ai-generic | homepage |
| South King | Emerald | ai-generic | `/current-production` |
| South King | Auburn Community Players | arts-people | org code on city page |
| Gig Harbor | Jewel Box | arts-people | org code |
| Gig Harbor | Bainbridge Performing Arts | squarespace-json | `/events?format=json` |
| Gig Harbor | Bremerton Community Theatre | arts-people | org code `brmct` |

### Implementation phases
- **Phase 0** — Extraction dry-run (no DB changes). Standalone Node script hits the 11 ai-generic orgs once, prints JSON to stdout. Validates Haiku output on real-world theatre HTML. ~$0.10 to run.
- **Phase 1** — Schema + monthly cron. New `event_sources` table, generic AI adapter, HTML hash caching. Writes to `productions` with `status='pending_review'`.
- **Phase 2** — Admin review queue at `/admin/calendar-sync`.
- **Phase 3** — Public calendar view (grid + list).
- **Phase 4** — Source management UI + manual refresh button + stale-detection email.
- **Phase 5** — Platform adapters (Arts People, Eventbrite, Squarespace JSON).
- **Phase 6** — Headless browser support (Playwright). Unlocks OvationTix + Ludus subdomain ticketing. ~50MB dependency, ~30s/source.
- **Phase 7** — Seed all 26 orgs (already done).

### Deferred tiers (separate audits later)
- Venues / presenters (Pantages, Rialto, Theatre on the Square — all Tacoma Arts Live; Washington Center; Federal Way PAC; Auburn PAC)
- Symphony / classical (Tacoma Symphony, Symphony Tacoma, Northwest Sinfonietta, Federal Way Symphony)
- Opera (Tacoma Opera)
- Youth / educational (CSTOCK, OFT youth, WWCA, Olympia Junior Programs)
- Colleges (PLU, UPS, Evergreen, Saint Martin's, TCC, Pierce, SPSCC, Centralia)
- High schools (40+, biggest org-by-org effort, smallest payoff)

---

## Build order (historical, v1)

For reference. Now mostly historical since v1/v1.1/v1.2 all shipped:

1. Repo + scaffolding (SvelteKit init, Netlify config, Supabase project, env vars)
2. Supabase schema for v1
3. Cloudinary integration (signed upload URLs, headshot upload component)
4. Public artist submission form
5. Email verification step
6. Resend wrapper + email_log
7. Admin auth (password endpoint with rate limit + 2FA + session cookie)
8. Admin pending queue
9. Magic-link edit flow
10. Public directory page
11. Profile pages
12. Admin profile management
13. Reports flow
14. Email blocklist UI
15. Editable site content
16. Editable email templates
17. Editable disciplines
18. Featured profiles + spotlight rotation
19. Announcement banner
20. Static pages (About, Contact, Support Us, Privacy, Terms)
21. Sitemap.xml + robots meta
22. Graceful outage page
23. Daily admin digest cron
24. Email volume alert
25. Supabase keepalive cron
26. Weekly backup cron
27. Stale profile cleanup cron
28. ADMIN_GUIDE.md + inline help (DEFERRED to launch-prep)
29. Cloudflare Email Routing setup (LIVE 2026-04-29)

---

## Manual-test history

The original `TEST_CHECKLIST.md` (now removed) carried run-throughs for every step above. Salient bugs caught and fixed during those runs:

- Discipline-toggle race (form serialised stale state because Svelte hadn't re-rendered hidden inputs). Fixed with `setTimeout(submitNow, 0)`.
- Sort-toggle race: same bug, same fix.
- Strict age filter dropping profiles with no range (intentional; added a below-grid note explaining how many were excluded).
- Themed `ConfirmModal` replaces the three native `confirm()` dialogs in admin pages. The old `onsubmit-confirm` pattern had a bug: Cancel still submitted because Svelte's `use:enhance` listener ran before the inline `preventDefault()`.
- Reply-To missing on contact emails: hitting Reply went to the relay address. `sendEmail` now accepts `replyTo`.
- Last-name sort: generated `last_name` column (lowercased, indexed) for theatre-convention "Smith, John" ordering.
- Filter changes scroll-to-top: `data-sveltekit-noscroll` + `data-sveltekit-replacestate`.
- Lost-note bug on `/admin/reports`: resolve/dismiss no longer nullifies an existing note.
- Duplicate "Other" chip on `/admin/profiles/[id]/edit`: removed the hardcoded fallback.
