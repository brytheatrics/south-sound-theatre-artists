# Build Plan

Phased implementation plan for South Sound Theatre Artists. See `PRODUCT_SPEC.md` for full scope; this doc captures architecture decisions and the order to build them in.

---

## Status (as of 2026-04-29)

**v1: feature-complete.** All 22 build steps shipped end-to-end (steps 1-22 below). Trust system upgraded mid-stream so untrusted profiles' major edits queue in `flagged_edits` for admin review.

**v1.1: complete.** Structured resume builder, multi-PDF upload (with pre-upload contact-info warning modal), mentorship offering + seeking with directory-lens filter, analytics (GoatCounter, gated on `PUBLIC_GOATCOUNTER_CODE`), Share-profile button. **QR codes intentionally skipped** in favour of Web Share API. **PDF parsing/column-mapper not built** — folded into the redaction tooling discussion (see "Maybe later").

**v1.2: complete.** Public callboard list / detail / submit pages, admin moderation queue, verified-org application + approval flow, email-verify gate on submissions, auto-expire of stale posts, productions table populated as a side-effect of approving audition / production posts, opt-in weekly digest with one-click unsubscribe, resource library (admin-managed link list at `/resources`), homepage marquee that pulls from the callboard with admin-controlled cycle-all + per-post picker.

**Cron jobs: 5 of 5 shipped.** Supabase keepalive (`keepalive.yml`), daily admin digest (`admin-daily-digest.yml`), email volume alert at 70% / 90% (`email-volume-alert.yml`), weekly callboard digest (`callboard-weekly-digest.yml`), and weekly Supabase JSON backup (`backup.yml`). Stale profile cleanup (`stale-profile-cleanup.yml`) handles the 18-month "still active?" ping plus the 30-day soft-delete trash sweep. All require their respective GitHub Actions secrets to start running; the keepalive needs only `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY`, the email crons add `RESEND_API_KEY` / `RESEND_FROM_EMAIL` / `ADMIN_EMAIL` / `PUBLIC_SITE_URL`, and the backup needs a separate private repo plus a fine-grained PAT.

**Admin polish layer (2026-04-28 sessions):** sidebar reorder + visual grouping of tabs, attention badges on every queue tab driven by a single layout server load, homepage marquee admin tab with checkbox picker + cycle-all toggle, smoothed CSS transform for the marquee animation. Admin sidebar order now mirrors how Lexi works through the day (review queues -> directory -> homepage -> copy -> config).

**Launch-prep work (2026-04-29 session):**
- **Bulk import.** `scripts/bulk-import-profiles.mjs` — folder-based importer for the artists who emailed bios + headshots in before the site existed. Reads `imports/<Person Name>/` directories, picks up bio.txt + headshot + 0+ resumes (PDF or DOCX, with auto-conversion via Word COM on Windows) + meta.txt. Disciplines auto-inferred from bio prose with an alias table; meta override wins. Idempotent on re-run via email + slug dedup. 27 profiles + 1 resume PDF imported, all magic-link edit URLs parked in the run's `_results.csv` for mail-merge.
- **URL normalisation.** `lib/util/url.ts` prefixes `https://` on bare-domain URLs at save time (submit / edit / admin profile editor / bulk import) and again as a defensive shim at render time. Fixes the "Harry's website opens `/artists/harryturpin.com`" footgun for any future bare-domain entry.
- **Admin profile thumbnails.** 44px round headshot next to each row on `/admin/profiles`, falling back to the initials placeholder for profiles missing a photo. Quicker scan when working through the queue.
- **Discipline rename + cascade.** `/admin/disciplines` Save-name action renames a discipline AND propagates the change across `profiles.disciplines`, `pending_submissions.disciplines`, `mentorship_offering`, `mentorship_seeking`. Two cases handled: a clean rename (new name doesn't yet exist) or a merge (new name exists, old row retired, all profile arrays remapped + deduped). Closes the "deleted Actor (Stage), added Actor, Chris Serface stuck with both" trap that surfaced today.
- **Admin Edit shortcut on profile pages.** Logged-in admins see a thin dark bar above any `/artists/<slug>` with a status pill (Published / Hidden draft) and an "Edit profile ->" link to `/admin/profiles/<id>/edit`. Sweeping through profiles end-to-end no longer requires bouncing back to the admin list. Admins can also load hidden drafts via the public URL for preview.
- **Word doc resume support.** ResumesEditor accepts `.docx` and `.doc` alongside PDF (file picker, MIME validation, label generation). Same `/artists/<slug>` render. Bulk import auto-converts `.docx` → `.pdf` via PowerShell + Word COM on Windows.
- **Ko-fi widget.** `/support-us` now embeds Ko-fi's official donation iframe below the editable markdown content. Username pulled from `PUBLIC_KOFI_USERNAME` so future renames are an env-var change. Widget hides entirely when the env var is empty.

**Email pipeline LIVE (2026-04-29):**
- Domain `southsoundtheatreartists.org` (`.org`, not `.com` - registrar is Squarespace, DNS delegated to Cloudflare).
- Resend domain verified - SPF, DKIM, DMARC records added via Resend's Cloudflare integration.
- Cloudflare Email Routing forwards `lexi@southsoundtheatreartists.org` and `hello@southsoundtheatreartists.org` to `southsoundtheatreartists@gmail.com`.
- Gmail Send-As configured for both addresses, sending through Resend SMTP (so outbound passes SPF / DKIM cleanly - no "via gmail.com" suffix).
- `RESEND_FROM_EMAIL` flipped from `onboarding@resend.dev` to `South Sound Theatre Artists <hello@southsoundtheatreartists.org>` (display name format so mail clients show the org name as sender, not just "hello").
- `ADMIN_EMAIL` flipped to `lexi@southsoundtheatreartists.org`.
- Contact form delivery confirmed end-to-end: status='sent' from Resend (was 403 sandbox-rejected before).

**Netlify deploy LIVE (2026-04-29):**
- Staging URL: `https://southsoundtheatreartists.netlify.app`
- All env vars imported from `.env` minus `SUPABASE_DB_URL` (build-script only, not needed in Netlify).
- Build contributor issue resolved by unlinking + re-linking the Git connection in Netlify's site settings (free-tier contributor enforcement quirk).
- Repo flipped from private to public to sidestep the contributor limit permanently for future contributors.
- `static/robots.txt` sitemap URL pointed at the .org production domain.
- `_2026-04-28_._com` placeholders in seed migrations (009, 010, 014) and scripts swapped to `.org`.

**Polish layer (2026-04-29 evening session):** mostly squeezing out launch-blocking footguns and improving the artist's first contact with their bulk-imported profile.
- **`/admin/submit-form` reference-data hub.** Single page where Lexi can add / rename / reorder / remove the picker options the artist submit form pulls from: areas, unions, and a new `ethnicities` table (mig 038, promoted from a hardcoded `ETHNICITY_OPTIONS` array). Renames cascade across `profiles.geographic_area`, `profiles.unions[]`, `profiles.ethnicities[]`, and the same columns on `pending_submissions`. "Other" rows are reserved sentinels and can't be renamed/removed. Disciplines stay on their own page (categories layer makes the UI different) but get a header link from this hub.
- **Auto-save sort number on blur.** Sort field on `/admin/submit-form` and `/admin/disciplines` saves on blur if changed. The Sort button still works for explicit saves. Empty / unchanged values are no-ops.
- **Mentorship dots on directory headshots.** 14px moss + rust dots in the top-right of each headshot signal mentorship availability ("Looking to learn" / "Open to mentoring in"). Custom-styled tooltip on hover lists the exact disciplines (italic serif label + body list, paper aesthetic). Hidden when the artist has neither array populated.
- **Discipline display order.** Artists can reorder their selected disciplines via up/down arrows in a `DisciplineOrder` panel below the picker (top two have a "SHOWS ON CARDS" badge since `disciplines.slice(0, 2)` drives card teasers). Source of truth is now an ordered array; `DisciplinePicker` got a backwards-compat `selectedOrder` prop. Ships on `/submit`, `/edit/[token]`, and both admin profile forms.
- **Complete-to-publish gate.** Bulk-imported profiles missing required info ship unpublished. `/edit/[token]` shows a paper-rust banner listing exactly what's missing; saving with everything filled in auto-publishes (refetches the row and only flips `published=true` if validation actually applied — handles untrusted users where major-field edits go to `flagged_edits` rather than the row). Same banner is mirrored on `/admin/profiles/[id]/edit` so admin can audit. Migration 039 refreshed the `admin_invitation` template copy to match (removed the misleading "It's live now at..." line).
- **Required headshot/photo + relabel.** Field is now "Headshot/photo" (with "any clear photo works" hint) on every form so people don't think they need a professional studio session. Required on `/submit` and `/edit/[token]`; admin saves stay loose. Joins the missingFields gate.
- **Awaiting email verification panel.** New section on `/admin` lists `pending_email` submissions (submitted but never clicked the verification link) so they're not silently lost. "Resend verification" button mints a fresh 24h token and re-fires `email_verification` through `sendEmail` so it logs to `email_log`. No "verify manually" button - flipping someone's verification flag without confirmation crosses an integrity line.
- **Sort tiebreaker.** Newest-members ordering now uses `member_since DESC, created_at DESC`. `member_since` is a date column (day-resolution), so launch-day approvals would otherwise float arbitrarily within the bulk-import batch. `created_at` (timestamptz) breaks the tie deterministically.
- **Profile edit save banner placement.** "Saved." / error banners now also render in the `.actions` row right next to the save button, not just up in the page header. The form is long enough that a ~2000px-down click looked like a no-op even when the save succeeded.
- **Resume privacy reminder.** `ResumesEditor` now shows a persistent rust banner above the resume list when an artist already has uploaded resumes. Same advice as the upload-time `ConfirmModal` (resume PDFs are public, redact phone + email) but visible to people whose files were imported pre-existing or who skipped the modal.
- **Body weight bump.** `--theme-paper` body weight raised from default 400 to explicit 500 and `-webkit-font-smoothing: antialiased` removed - real-world feedback was that the type read "delicate" on phones. 500 hits a real Inter Tight weight (no faux-bold) and lets the OS pick its default smoothing.
- **Duplicate "Other" chip fix.** `/admin/profiles/[id]/edit` was rendering two "Other" area chips (one from the seeded areas table row, one from a hardcoded fallback). Removed the hardcoded fallback - the loop alone is sufficient.
- **Pre-launch script: `scripts/gate-incomplete-profiles.mjs`.** Default mode unpublishes profiles missing required info (used right before sending invitations); `--unhide` republishes them all (used during dev for visual review). Idempotent; also backfills Chris Serface's `headshot_consent` flag (admin auto-set on save means this doesn't recur). Currently `--unhide` was just run so everyone's visible during staging review.

**Outstanding before public launch:**
- **Ko-fi widget content.** The widget panel is rendering on localhost but missing on the deployed staging site. Likely an adapter-netlify env-var quirk where the function bundle was built before `PUBLIC_KOFI_USERNAME` was set. Will resolve on the next push (which forces a clean rebuild) - intentionally not pushed for now to save build minutes.
- **DNS cutover.** A records currently still point at Squarespace (existing site). When Lexi approves the staging deploy for launch, Cloudflare A records flip to Netlify's load-balancer IPs and `PUBLIC_SITE_URL` updates to `https://southsoundtheatreartists.org`. Trigger a clear-cache deploy after.
- **GitHub Actions secrets for crons.** All 6 workflows committed but no-op until secrets are set in repo Settings. List in TEST_CHECKLIST.
- **Launch invitations.** Build `scripts/send-launch-invitations.mjs` to bulk-send the `admin_invitation` email template to every imported artist. Behavior:
  - Recipients: every published profile **except** Lexi and Blake (their profiles are seeded but they don't need an email).
  - Skips placeholder emails (`@unknown.ssta.local`) with a warning.
  - Generates a fresh edit token per artist (30-day TTL feels right for launch; long enough to land in a vacation inbox, short enough that token-leak risk stays small) and inserts to `magic_link_tokens`.
  - Uses `sendEmail` so every send hits `email_log`.
  - `--dry-run` prints what it would send without sending.
  - `--slug=foo` filter for sending to a single profile.
  - Test plan: `--slug=lexi-barnett` and `--slug=blake-r-york` first, confirm both arrive correctly, then run the full batch.
  - Lexi has set a cutoff date for "email me to be added" submissions; people who emailed her before that date are in the import batch, after that they go through the normal `/submit` flow.
  - Run **after** `scripts/gate-incomplete-profiles.mjs` (default mode) so incomplete profiles arrive at the "your profile isn't visible yet" banner state.
- **`ADMIN_PASSWORD` rotation.** The dev placeholder is in Netlify env right now; rotate to a stronger password before public launch and tell Lexi via private channel.
- **Backup repo + PAT.** Backup cron no-ops cleanly until `BACKUP_REPO` + `BACKUP_REPO_TOKEN` are set.
- **`ADMIN_GUIDE.md`.** Deferred until closer to launch so Lexi can drive notes from real use of the staging deploy.
- **Lexi's Ko-fi onboarding.** Sign up at ko-fi.com is done (`ko-fi.com/lexibarnettssta`) but Stripe / PayPal connection + donation tier setup may not be. Until those are in, the embed iframe will show a barebones "Powered by Ko-fi" with no donation form.
- **Re-hide incomplete bulk-imported profiles.** A one-off script (commit 01a9a5c) unpublished 21 profiles missing required info so the complete-to-publish gate on `/edit/[token]` could surface them properly. Blake re-published them temporarily so the directory looks populated during dev / staging review. **Before sending invitation emails**, re-run `scripts/gate-incomplete-profiles.mjs` (or the equivalent SQL) so those 21 profiles are unpublished again - artists will see the "your profile isn't visible to the public yet" banner when they click their edit link, fill in the missing info, and auto-publish on save.

**Maintenance (not launch-blocking):**
- **GitHub Actions Node 20 → 24 migration.** All 6 workflows currently pin `actions/checkout@v4`, `actions/setup-node@v4`, and `pnpm/action-setup@v4`, which run on Node 20. GitHub forces Node 24 by default on **2026-06-02** and removes Node 20 entirely on **2026-09-16**. Bump action versions to whatever `@v5` (or later) tags become stable for all three before September. One-line change per action per workflow; no code changes needed.
- **Cloudinary headshot orphan cleanup.** Each profile-photo upload creates a new asset (auto-generated public_id). When a user replaces their headshot, the old Cloudinary asset stays around indefinitely — no auto-cleanup. Currently negligible (Free tier is 25GB, headshots ~200KB each, would need 100k+ orphans to be a real problem) but worth a periodic-audit script eventually. Build `scripts/cleanup-orphan-headshots.mjs` that walks Cloudinary's `headshots/` folder, compares to currently-referenced URLs across `profiles`, `pending_submissions`, and parsed-out URLs in `site_content.body_markdown`, and deletes anything not referenced. Run manually so the operator can review before destructive action. Don't auto-delete-on-replace — would break the About page's references to existing profile headshots.

---

## Tech Stack (settled)

| Layer | Choice |
|---|---|
| Frontend | SvelteKit + `adapter-netlify` |
| Hosting | Netlify Free |
| Database | Supabase Free + GitHub Actions keepalive cron + UptimeRobot |
| Image / PDF storage | Cloudinary Free |
| Transactional email | Resend Free (with SPF / DKIM / DMARC configured) |
| Admin email forwarding | Cloudflare Email Routing |
| Donations | Ko-fi embed |
| Backups | Weekly GitHub Actions JSON dump → private GitHub repo |
| Monitoring | UptimeRobot Free on public URL + Resend volume alerts |

Hard constraint: **zero ongoing cost**. Supabase Free pause risk is mitigated by the keepalive cron, not by upgrading to Pro.

---

## Auth Model

No traditional accounts. Three access tiers:

- **Browse** (directory, profiles, callboard, all public pages): zero auth.
- **Submit** (new profile, callboard post, report, contact form): zero auth + one-time email verification before the submission appears in Lexi's queue. Filters bots automatically.
- **Edit own profile / change notification preferences**: magic link to artist's email. Tokens are **single-use, 24-hour expiry, invalidated on use**.
- **Admin (Lexi)**: password (Netlify env var) + magic-link 2FA (6-digit code to admin email) + 30-day session cookie + server-side session token (revocable).

Rate limiting: 5 password attempts per IP per 15 minutes on the admin login endpoint, then lockout.

---

## Data Model (key tables)

| Table | Purpose |
|---|---|
| `profiles` | Live artist profiles. v1.1 added `last_name` (generated, indexed), `trusted` (bool), `city` (text), `resumes` (jsonb array of `{label, url}`), `resume_data` (jsonb of credits/training/skills), `mentorship_offering` + `mentorship_seeking` (text arrays) |
| `pending_submissions` | New profiles awaiting email verify + admin approval. Mirrors v1.1 columns above |
| `flagged_edits` | **Active.** Untrusted artists' major edits (full_name, bio, headshot_url, disciplines, resumes, resume_data) queue here as one row per submission with `proposed_changes jsonb`. Admin reviews at `/admin/flagged-edits` |
| `magic_link_tokens` | Single-use edit tokens with expiry. Also stores admin 2FA codes (purpose=`admin_2fa`) |
| `email_log` | Every Resend send, hashed recipient + type + sent_at |
| `email_blocklist` | Admin-curated abusive sender emails |
| `reports` | User-submitted reports on profiles / posts |
| `featured_profiles` | Spotlight rotation selection |
| `site_content` | Editable copy keyed by slug (homepage, about, etc.) |
| `email_templates` | Editable email body templates with variable placeholders |
| `announcement_banner` | Optional site-wide banner with date range |
| `disciplines` | Editable list of discipline tags. ~140 entries across 13 categories |
| `discipline_categories` | Categories that group disciplines. Admin-managed at `/admin/disciplines` |
| `areas` | Region chips (`Tacoma / Pierce County`, `South Pierce`, `Olympia / Thurston County`, `South King County`, `Gig Harbor / Kitsap`, `Other`) with `description` for hover tooltips. Realigned to the v2.x audit taxonomy in mig 045. |
| `unions` | Reference list with descriptions |
| `admin_sessions` | Admin login sessions (token_hash, expires_at, last_used_at) |
| `admin_login_attempts` | Rate-limit tracking (5 fails / 15 min / IP) |
| `productions` | Shows extracted from approved callboard posts (v1.2). Populated as a side-effect of approving audition / production posts in either admin or verified-org auto-publish path |
| `callboard_posts` | Audition notices, designer / crew calls, production announcements, general opportunities (v1.2). Email-verify token + status workflow same as pending_submissions |
| `verified_orgs` | Approved theatre organizations (v1.2). Posts from a verified org skip the admin queue and go live straight from the email-verify step |
| `callboard_subscriptions` | Opt-in weekly digest. `subscriber_email` unique, `disciplines` text[], `post_types` text[], `last_digest_at`, `unsubscribed_at`, per-row `unsubscribe_token` for one-click links (v1.2) |
| `marquee_settings` | Single-row config for the homepage scrolling ticker. `enabled`, `include_all_callboard`, `include_callboard_post_ids`. Admin-edited at `/admin/marquee` (v1.2) |
| `resources` + `resource_categories` | Curated link library at `/resources`. Soft-deleted with `deleted_at`; admin manages from `/admin/resources` (v1.2) |

All tables include `created_at`, `updated_at`. Soft-deleted rows have `deleted_at` set; a daily cron hard-deletes rows where `deleted_at` is older than 30 days.

---

## Phased Roadmap

### v1 - Directory only
The minimum viable site: artists submit, get approved, edit, get contacted. Launch and let people use it.

**Features:**
- Public artist submission form with email verification before queue
- Admin pending queue (one-at-a-time, daily digest email at 8am if non-empty)
- Admin profile management (search, edit, unpublish, soft-delete with 30-day recovery)
- Magic-link edit flow with resend
- Public directory with filters (discipline, availability, experience level, union, area, age range, languages)
- Profile pages with contact form (Resend-routed, real email never exposed)
- Email blocklist in admin panel
- Report button on profiles → admin queue
- Featured profile rotation on homepage (date-bucketed seed, not pure random)
- Editable homepage / about / support us / contact / footer copy via admin (markdown + toolbar)
- Editable email templates via admin (markdown)
- Announcement banner (optional, with date range)
- Editable disciplines list
- Email-deliverability bundle: SPF, DKIM, DMARC, verified test sends to Gmail / Outlook / Yahoo
- Sitemap.xml + per-page robots meta (public pages indexed; admin / edit / queue noindex)
- Graceful Supabase outage page (catch DB connection failure, render "back soon" template)
- "Member since" date on profiles
- Privacy and Terms pages (draft text, lawyer review before launch)
- Profile delete flow (artist-initiated from edit page)
- Headshot rights consent checkbox on upload
- About / Contact / Support Us pages
- Cloudflare Email Routing setup doc
- ADMIN_GUIDE.md + inline admin-panel help
- Smart empty states throughout admin

### v1.1 - Resume features + Mentorship (shipped)

- ✅ **Structured resume builder.** `resume_data` jsonb on profiles. Three sections (credits / training / skills), each a list of typed entries with Up / Down / Remove controls. Generic field set across disciplines. Server-side parser (`lib/server/resume.ts`) trims, validates, drops empty rows. Renders inline on the public profile.
- ✅ **PDF resume upload (multiple per profile).** `resumes` jsonb array of `{label, url}`. Cloudinary raw uploads. Pre-upload `ConfirmModal` warns artists about contact-info on public-directory PDFs.
- ❌ **PDF parsing / column mapper.** Cut. Folded into the redaction tooling discussion (see "Maybe later") - the structured builder sidesteps the use case.
- ✅ **Mentorship opt-in.** `mentorship_offering` + `mentorship_seeking` text-array columns. Surfaced in profile sidebar, filterable on the directory via "Open to mentoring" + "Looking to learn" chips. The Discipline picker doubles as a lens: when a mentorship chip is on, the picker narrows by the matching mentorship array instead of the artist's own disciplines.
- ❌ **Profile QR code.** Skipped. Replaced with a Share button (`navigator.share` on mobile, clipboard fallback on desktop).
- ✅ **Analytics: GoatCounter.** Drop-in script, gated on `PUBLIC_GOATCOUNTER_CODE`. Public routes only - skips `/admin/*` and `/edit/*`. "View analytics" pill in the public nav opens the GoatCounter dashboard in a new tab when an admin session is active.

### v1.2 - Callboard + Notification opt-ins + Productions data (shipped)
Adds the second product surface and the data foundation for v1.3.

- ✅ Callboard public page (filterable by post type, list + cards views)
- ✅ Public callboard submission form (with email verification for unverified posters)
- ✅ Admin callboard management (approve / reject / soft-delete with trash)
- ✅ Verified theatre organization application + approval flow (`/callboard/apply-verified`, `/admin/orgs`)
- ✅ Verified-org callboard posts go live immediately without per-post approval
- ✅ Auto-unpublish posts after audition / closing date (lazy on page load)
- ✅ Opt-in weekly digest with per-row unsubscribe token (`callboard_subscriptions` + edit-page toggle + Sunday-evening cron)
- ✅ `productions` table populated from approved audition / production posts at both approve paths (admin queue + verified-org auto-publish)
- ✅ Resource library (`/resources`, `/admin/resources`, categories + soft-delete + sort_order)

**Side additions during v1.2:**
- Homepage marquee fed by callboard (`/admin/marquee` with cycle-all toggle + checkbox picker)
- Admin sidebar reorder + visual grouping + attention badges
- Padding / alignment polish across the new callboard pages

**Patterns to mirror from v1:**
- Submit flow: same email-verification gate as `pending_submissions` (see `src/routes/submit/`)
- Trust gate: re-use `profiles.trusted` for verified orgs (no per-post approval if trusted)
- Soft-delete + 30-day trash: same as profile management
- All emails go through `lib/server/email.ts` wrapper (logs to `email_log`, blocklist check)
- ConfirmModal for any destructive action - never `window.confirm()`
- Mobile-first table → card collapse for any admin list (see `/admin/profiles`)
- URL-state filters with `data-sveltekit-noscroll` + `data-sveltekit-replacestate` (see `/directory`)
- Pagination uses `?page=N` with the same Prev/Next + page-list + ellipsis pattern

### v1.3 - Discovery layer
Three features sharing the productions data, ship together.

- "What's Playing" calendar (production announcements as a month/list view)
- "Currently appearing in" badges on artist profiles
- Public production archive page (searchable past + present productions)

### v2 - Driven by real usage
Add nothing speculatively. Triggers are concrete signals from real users:
- Batch admin actions if Lexi clears >10 items per session regularly
- Image cropping UI if artists complain about auto-crop results
- Embeddable profile widgets if anyone asks
- Favorites / starred artists (localStorage, no accounts)
- WYSIWYG editor migration if Lexi struggles with markdown
- Whatever else surfaces

### v2.x - Auto-populated regional calendar (post-launch ambition)
**Goal:** the site shows what's playing across South Sound theatre even when companies don't manually post to the callboard. Lexi and Blake both want this — neither has time to keep a calendar updated by hand, and the previous regional theatre-listings site (which both remembered fondly) shut down years ago.

**Approach** in order of preference, **never raw HTML scraping as a default**:
1. **JSON-LD `Event` schema** in the org's site source (`<script type="application/ld+json">` blocks). Survives redesigns because sites can't break it without hurting Google rankings.
2. **iCal / Google Calendar feeds** — many orgs publish public feeds. Cleanest data, ask orgs first.
3. **Ticketing platform APIs / feeds** — Tessitura, AudienceView, OvationTix, Eventbrite, etc.
4. **AI extraction from a stable season-list URL** — fetch the page, send cleaned HTML to Claude Haiku, parse JSON. One generic adapter for any org with a single text-based season page. Cheap, robust to redesigns, doesn't need per-org code.
5. **Custom HTML scrapers** — last resort. Only justified for orgs with quirky structures that AI extraction can't handle reliably.
6. **Admin review queue** — every scraped event lands here as a draft; Lexi approves before it goes live. Catches drift, hallucination, and date-format errors.

**Audit complete (2026-05-02).** Visited every South Sound producing org. Headline findings:
- **No org exposes JSON-LD Event schema in a usable way.** Tacoma Arts Live had it but is closing and no longer producing.
- **One org exposes a clean structured feed**: Bainbridge Performing Arts via Squarespace's `/events?format=json` endpoint.
- **Six orgs share Arts People / OvationTix ticketing** (Centerstage, Auburn Community Players, Jewel Box, Bremerton, OLT, OFT) — one platform adapter covers them all, parameterized by org code.
- **Eleven orgs render a clean season list as plain HTML text** at a stable URL — ideal for AI extraction.
- **One org exposes Eventbrite per-show JSON-LD** (Dukesbay).
- **One org has a likely Next.js JSON endpoint** worth probing (Renton Civic).
- **Three orgs need extra work**: New Muses (no season index — manual entry only), OLT (titles on index, dates only on per-show subpages — two-step crawl), OFT (bot-blocks WebFetch — needs UA spoof or headless browser).
- **Four orgs are wall**: Toy Boat (login-walled, very low cadence), NW Center Theatre (placeholder Wix), Screaming Butterflies (month-only date precision, can't satisfy a calendar), String & Shadow (touring company, dates scattered across partner-venue calendars).

**Architecture decisions** (settled 2026-05-02):
- **Vendor:** Anthropic API (Claude Haiku 4.5). $5 of free signup credits cover the projected first ~5 years; thereafter ~$1-2/year. Hard monthly spend cap set in Anthropic console as belt-and-suspenders.
- **Cadence:** monthly cron is plenty for orgs that publish full seasons annually. Per-source `cadence_days` override on `event_sources` for orgs with mid-season activity. Optional weekly bursts during Aug-Sep season-announcement windows.
- **Cost-saving cache:** SHA-256 hash of cleaned HTML stored on each `event_sources` row. Skip the AI call entirely when the page hasn't changed since the last successful run. Drops cost ~75% in steady state.
- **Manual refresh button** in admin per source. 1-hour cooldown between actual API calls (defeats accidental click-spam even if the cache is bypassed). Reports back whether content changed and how many shows were found.
- **Review queue** non-negotiable: scraped events go to `productions` with `status='pending_review'` and only show on the public calendar after Lexi approves. Catches AI hallucination and date-format errors. After 2-3 months of consistent quality per org, individual orgs could be opted into auto-publish (mirrors the existing `profiles.trusted` pattern).
- **Stale-source detection:** track `last_successful_at` and `last_show_count` on each source. After 2 weeks of empty results, email Lexi with a "this URL probably needs updating" alert that suggests the next likely slug (e.g. `/season-87.html` → `/season-88.html`, `/blog/tag/2025-2026` → `/blog/tag/2026-2027`).

**Schema direction:** multi-tag, not exclusive categories. Each org carries an array of tags so it can belong to multiple buckets simultaneously (e.g. Tacoma Opera = "producing" + "opera"; OFT = "producing" + "youth"). Calendar UI toggles flip individual tags. Default-on tags: `producing`, `venue`, `youth`. Default-off: `opera`, `symphony`, `college`, `high-school`. (One catch flagged early: venues book non-theatrical events too — weddings / conferences. Need a per-event-type filter at scrape time OR Lexi-curated review to keep the calendar relevant.)

**Org list (26 orgs, post-audit):**

| Region | Org | Adapter | Source |
|---|---|---|---|
| Tacoma | Tacoma Little Theatre | ai-generic | `/blog/tag/2025-2026` (annual slug) |
| Tacoma | Lakewood Playhouse | ai-generic | `/season-87.html` (annual season number) |
| Tacoma | Tacoma Musical Playhouse | ai-generic | `/season-and-show-tickets` |
| Tacoma | Dukesbay Productions | eventbrite | Eventbrite organizer |
| Tacoma | New Muses | manual | no season index |
| Tacoma | Toy Boat | manual | login-walled, low cadence |
| Tacoma | Screaming Butterflies | manual | month-precision only |
| Tacoma | Mustard Seed | ai-generic | `mustardseedtheater.csstix.com` |
| South Pierce | ManeStage | ai-generic | `/current-season` |
| South Pierce | NW Center Theatre | manual | placeholder site, revisit later |
| Olympia | Harlequin | ai-generic | `/season-{year}/` (annual slug) |
| Olympia | Olympia Little Theatre | ai-generic-crawl | `/shows/` index → per-show subpages |
| Olympia | Olympia Family Theater | ai-generic w/ UA | `/announcing-our-{yy}-{yy}-season/` (bot-block) |
| Olympia | Theater Artists Olympia | ai-generic | `/calendar` |
| Olympia | String & Shadow | manual | touring, dates not on own site |
| Olympia | Animal Fire | ai-generic | homepage (single annual show) |
| Olympia | Evergreen | ai-generic | `/season66` (season number) |
| South King | Centerstage | ovationtix | account 36978 |
| South King | Renton Civic | nextjs-probe | `/_next/data/{buildId}/shows/{slug}.json` if exposed, else ai-generic |
| South King | Burien Actors Theatre | ai-generic | `/this-season/` |
| South King | Theatre Battery | ai-generic | homepage (single show) |
| South King | Emerald | ai-generic | `/current-production` |
| South King | Auburn Community Players | arts-people | org code on city page |
| Gig Harbor | Jewel Box | arts-people | org code |
| Gig Harbor | Bainbridge Performing Arts | squarespace-json | `/events?format=json` |
| Gig Harbor | Bremerton Community Theatre | arts-people | org code `brmct` |

**Removed from original audit list:** Theater Northwest (Tacoma Arts Live closing, no longer producing), Broadway Olympia (defunct), Peninsula Community Theatre (no WA org by that name), Auburn Players Community Theatre (Auburn NY, wrong state).

**Implementation phases:**
- **Phase 0 — Extraction dry-run** (no DB changes). Standalone Node script hits the 11 ai-generic orgs once, prints JSON output to stdout. Validates that Haiku produces clean structured data on real-world theatre HTML. ~$0.10 to run. *De-risks the whole feature before any UI is built.*
- **Phase 1 — Schema + monthly cron.** New `event_sources` table (`org_id`, `url`, `adapter`, `cadence_days`, `last_hash`, `last_successful_at`, `last_show_count`, `last_status`, `cooldown_until`). Generic AI adapter, HTML hash caching, monthly GitHub Actions cron. New shows write to `productions` with `status='pending_review'`. No UI yet — verify pipeline writes rows correctly.
- **Phase 2 — Admin review queue.** `/admin/calendar-sync` lists pending productions, approve/reject buttons, mirrors existing review-queue patterns.
- **Phase 3 — Public calendar view.** Calendar grid + list view, mobile-first, filter by org tags.
- **Phase 4 — Source management UI + manual refresh.** `/admin/event-sources` — add/edit/remove sources, manual refresh button with 1-hour cooldown, stale-detection email when sources go quiet.
- **Phase 5 — Platform adapters.** Arts People (covers 6 orgs), OvationTix (Centerstage), Eventbrite (Dukesbay), Squarespace `?format=json` (BPA). Each is short.
- **Phase 6 — Seed all 26 orgs.** SQL insert with the URLs from this audit.

**Deferred tiers** (separate audits later, each is its own universe):
- **Venues / presenters** — Pantages, Rialto, Theatre on the Square (all operated by Tacoma Arts Live), Washington Center for the Performing Arts (Olympia), Federal Way Performing Arts Center, Auburn Performing Arts Center, etc. Different scrape target: org website may or may not aggregate all the venue programming.
- **Symphony / classical** — Tacoma Symphony, Symphony Tacoma, Northwest Sinfonietta, Federal Way Symphony, etc. Different audience overlap with theatre; opt-in tag.
- **Opera** — Tacoma Opera. If more opera orgs surface, they'd join their own tier.
- **Youth / educational theatre** — CSTOCK, OFT youth side, WWCA, Olympia Junior Programs, Capital Playhouse-style (defunct or active small companies). Many of these are also in v1 list as "producing" — multi-tag handles the overlap.
- **Colleges** — PLU, UPS, Evergreen, Saint Martin's, TCC, Pierce College, SPSCC, Centralia. Different season pacing (academic year), often less structured event data.
- **High schools** — 40+ in the South Sound. Data quality wall (PDFs in Google Drive, no structured anywhere). Biggest org-by-org effort, smallest payoff per scraper. Pull list once from WSTF chapter directory if/when we go after them.

**Status:** **audit complete (2026-05-02), architecture settled, ready to start Phase 0 dry-run.** v1.3 "What's Playing" calendar (production announcements artists manually submit) remains the simpler precursor — that one ships from manually-submitted data and can launch first.

---

## v1 Build Order

Ordered to surface integration risks early and reach a usable demo as fast as possible.

1. **Repo + scaffolding**: SvelteKit init, Netlify config, Supabase project, env vars, `.env.example`
2. **Supabase schema**: tables for v1 (profiles, pending_submissions, magic_link_tokens, email_log, email_blocklist, reports, featured_profiles, site_content, email_templates, announcement_banner, disciplines)
3. **Cloudinary integration**: signed upload URLs, headshot upload component with progress indicator
4. **Public artist submission form**: all fields per spec, headshot upload, rights consent, honeypot anti-spam
5. **Email verification step**: send confirmation link → click verifies email → row appears in queue
6. **Resend wrapper + email_log**: every send goes through one helper that logs first
7. **Admin auth**: password endpoint with rate limit + magic-link 2FA + session cookie
8. **Admin pending queue**: list + detail view + approve / reject (with rejection reason → email)
9. **Magic-link edit flow**: token generation, "resend my link" form, edit page with all fields, single-use token invalidation
10. **Public directory page**: list + filters + search by name
11. **Profile pages**: public view + contact form (Resend-routed, blocklist check, fake-success on blocked)
12. **Admin profile management**: search, edit any field, unpublish (soft-delete), "trash" view for 30-day recovery
13. **Reports flow**: report button on profile → admin queue
14. **Email blocklist UI**: list view, add (paste email + note), remove
15. **Editable site content**: site_content table + markdown editor + live preview pane in admin
16. **Editable email templates**: same pattern + variable placeholder sidebar
17. **Editable disciplines**: add / remove / reorder list editor
18. **Featured profiles + spotlight rotation**: admin selection + date-seeded rotation on homepage
19. **Announcement banner**: edit form + active-window logic on public pages
20. **Static pages**: About, Contact, Support Us, Privacy, Terms (draft text)
21. **Sitemap.xml + robots meta**: public pages indexed, admin noindex
22. **Graceful outage page**: DB failure detection + fallback template
23. **Daily admin digest cron**: GitHub Action runs 8am daily, emails Lexi if queue non-empty
24. **Email volume alert**: GitHub Action runs daily, alerts at 70% (2100/3000) of monthly Resend cap
25. **Supabase keepalive cron**: GitHub Action runs every 3 days, hits `/api/healthcheck`
26. **Weekly backup cron**: GitHub Action runs weekly, dumps tables → private repo as JSON
27. **Stale profile cleanup cron**: 18 months no edit → "still in the area?" email; 30 days no response → archive
28. **ADMIN_GUIDE.md + inline help**: per-section help text in admin panel + standalone reference doc
29. **Cloudflare Email Routing setup doc**: instructions for Lexi when transferring service accounts

Most of these are 1-3 days of focused work. v1 total estimate: 6-10 weeks part-time.

---

## Architecture Commitments

These make later phases cheap to add. Bake them into v1 even when the immediate need is small:

1. **APIs accept arrays from day one.** `POST /api/admin/approve { ids: [...] }` even when called with one ID. Batch actions become a UI-only change later.
2. **Queue items keyed by stable IDs**, with action handlers taking ID parameters (not closures over rendered rows). Multi-select state can be layered on top later.
3. **All copy is in the database, not hardcoded.** `site_content`, `email_templates`, `disciplines`, `announcement_banner`. Lexi never needs a code change to update text.
4. **Markdown rendering is centralized** through one shared component so output is consistent everywhere.
5. **All emails go through one wrapper** (`sendEmail`) that logs to `email_log` and checks blocklist before calling Resend.
6. **Soft-delete is the default** for admin actions; hard delete is a separate cron job after 30 days.
7. **Magic-link tokens are single-use and invalidated on use**, not just on expiry.
8. **Profile slugs are user-controlled on collision** via a popup at submission, not auto-suffixed.

---

## Admin Panel Structure

**v1 sections:**

- Pending Queue (submissions, flagged edits, reports - one daily digest email if non-empty)
- All Profiles (search / filter / edit / unpublish / soft-delete with trash recovery)
- Featured Profiles (homepage spotlight rotation)
- Site Content (homepage / about / support us / contact / footer - markdown editor + preview)
- Announcement Banner (optional site-wide, with date range)
- Email Templates (magic link / resend / rejection / contact-routed / verified org / weekly digest header)
- Disciplines (add / remove / reorder)
- Email Blocklist
- Settings (admin contact email, daily digest preference)

**v1.2 adds:** Callboard Management, Verified Organizations, Homepage marquee, Resource library.

**Admin sidebar groupings (post-v1.2 reorder):**

1. Review queue (Pending / Edit review / Reports / Callboard / Organizations) - badged with attention counts
2. Directory (All profiles)
3. Homepage curation (Announcement / Featured / Homepage marquee)
4. Site copy (Site content / Resources / Email templates)
5. Config (Disciplines / Blocklist)

A `group: true` flag on the first item of each section draws a thin
hairline rule above it so the chunks read as scannable blocks
without spending a row on category labels.

**Editor UX:** markdown + toolbar (Bold / Italic / Link / List / Heading / Image-upload). Live preview pane alongside. Image button uploads to Cloudinary and inserts the markdown image syntax automatically. Email templates show a variable-placeholder sidebar.

---

## Launch Checklist

Before flipping the public DNS over:

- [ ] All v1 features functional end-to-end
- [ ] SPF, DKIM, DMARC configured on the domain (verify with `mxtoolbox.com` or similar)
- [ ] Test magic-link, contact-form, and admin-2FA emails delivered to Gmail / Outlook / Yahoo without landing in spam
- [ ] Cloudflare Email Routing forwarding `lexi@domain` to her Gmail
- [ ] Gmail "Send As" configured so her replies come from the custom address
- [ ] Privacy + Terms pages reviewed and replaced with lawyer-approved copy (or template service like TermsFeed / Termly)
- [ ] All env vars set in Netlify production: Supabase URL + key, Cloudinary cloud + key, Resend key, admin password, session secret
- [ ] Supabase keepalive cron deployed and verified (manually trigger once, confirm log entry)
- [ ] Weekly backup cron deployed and verified
- [ ] Daily admin digest cron deployed and verified
- [ ] UptimeRobot monitor on public URL with email alerts to Blake
- [ ] Resend volume alert cron tested at simulated 70% threshold
- [ ] Sitemap.xml accessible at `/sitemap.xml`
- [ ] robots.txt accessible at `/robots.txt`
- [ ] Public profile pages render correct OG meta tags (test with Facebook / Twitter card validators)
- [ ] Admin panel mobile layout tested on phone
- [ ] First-time admin empty states render correctly
- [ ] One real test submission walked through entire flow (submit → verify email → approve → edit via magic link → contact form → message arrives)
- [ ] Domain registrar 2FA transferred to Lexi's phone
- [ ] Service account passwords transferred to Lexi (Netlify, Supabase, Cloudinary, Resend)
- [ ] ADMIN_GUIDE.md complete and shared with Lexi

---

## Confirmed Skips (do not build)

These came up in planning and were explicitly cut. Do not add without revisiting:

- Forum or chat (moderation load)
- Reviews or ratings of artists / theatres (community drama risk)
- Internal messaging (email already exists)
- vCard / "Add to contacts" download (privacy gets weird with hidden emails)
- Theatre venue mini-directory (overkill, callboard contacts cover it)
- Image cropping UI in v1 (Cloudinary auto-crop is fine; add later if needed)
- Embeddable profile widgets (no demand signal)
- Batch admin actions in v1 (architecture allows cheap retrofit if needed)
- Traditional account system (magic-link + admin password is the entire identity model)
- One-click email-based admin approval links (more attack surface than benefit)
- WYSIWYG editor in v1 (markdown + toolbar covers 99% of needs; migration path exists if Lexi struggles)

## Maybe later (revisit if it comes up in real use)

Discussed and parked. None are committed; if usage patterns or user requests surface them, they're cheap to revisit.

- **Profile QR code.** Cut for v1.1 in favour of the Share button (Web Share API). Revisit if artists ask for printable QR for headshot/business-card use. ~1 hr to add a client-side generator.
- **Better admin empty states.** "Nothing in the queue", "No reports yet" copy across admin sections. Functional today, just utilitarian. Revisit if Lexi's onboarding (or future admins') feels barren.
- **PDF redaction tooling.** A draw-rectangles-on-canvas → flatten-to-image-PDF workflow for artists who upload PDFs with contact info. The pre-upload warning modal already covers the educational part. The structured resume builder sidesteps the use case for artists who use it. Revisit if PDFs with exposed contact info show up in real submissions. Mockup notes are in chat history (`PDF rasterize redaction mockup` task). Approach: PDF.js renders pages to canvas, user draws white rectangles, pdf-lib assembles a new PDF from the rasterised pages so text-layer is gone.
- **Discipline-specific resume sections.** v1.1 ships a generic credits/training/skills builder. The product spec mentioned per-discipline section variations - revisit if specific disciplines (designers? technicians?) struggle with the generic shape.
- **Multi-category disciplines.** Sound Designer plausibly belongs in both Music & Sound and Design; we left it single-category and lean on the picker's search. Revisit if multiple ambiguous-home disciplines surface.
- **Embedded analytics summary on /admin home.** Right now the View Analytics pill links out to GoatCounter. Could pull top numbers via API and render summary cards on /admin once we know which metrics matter.

---

## Deploy Targets

- **Netlify preview / staging URL**: https://southsoundtheatreartists.netlify.app (auto-deploys from `main`)
- **Custom domain** (post-launch): TBD - Lexi owns it, DNS access pending

## Open Items Pending Real-World Information

- Domain name (Lexi owns it; needs access for DNS configuration ~2 weeks before launch)
- Final legal copy for Privacy and Terms (lawyer or template service review)
- Lexi's preferred admin contact email format (`lexi@domain` or other)
- Service account transfer plan timing (after v1 feature-complete, before public launch)
