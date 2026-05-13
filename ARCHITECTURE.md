# Architecture

Schema, auth model, conventions. Stable reference - if a section keeps drifting, it belongs in [TODO.md](TODO.md) instead.

---

## Tech stack

| Layer | Choice |
|---|---|
| Frontend | SvelteKit (Svelte 5 runes) + `adapter-netlify` |
| Hosting | Netlify Free |
| Database | Supabase Free + GitHub Actions keepalive cron + UptimeRobot |
| Image / PDF storage | Cloudinary Free |
| Transactional email | Resend Free (SPF / DKIM / DMARC verified) |
| Admin email forwarding | Cloudflare Email Routing |
| Donations | Ko-fi embed |
| Backups | Weekly GitHub Actions JSON dump → private repo |
| Monitoring | UptimeRobot Free + Resend volume alerts |

Hard constraint: **zero ongoing cost.** Supabase Free pause risk is mitigated by the keepalive cron, not by upgrading.

Free-tier ceilings: Resend 3000/mo, Supabase 500MB DB + 7-day pause, Cloudinary 25GB storage / 25GB bandwidth, Netlify 125k function invocations/mo + 300 build minutes/mo.

---

## Auth model

No traditional accounts. Five access tiers:

- **Browse** (directory, profiles, callboard, calendar, /theatres, /blog, /productions, all public pages): zero auth.
- **Submit** (new profile, callboard post, calendar entry, report, contact form): zero auth + one-time email verification before the submission appears in Lexi's queue. Filters bots automatically.
- **Edit own profile / claim production credits / change notification preferences**: magic link to artist's email at `/edit/[token]`. Tokens are **single-use, 24-hour expiry, invalidated on use** (the live API endpoints reuse the token without burning it; only the main form submit burns it).
- **Org rep manage credits on their org's productions**: admin-issued magic link from `/admin/organizations` to the org's `contact_email`, lands at `/org-edit/[token]`. 60-day TTL, never burned (live API). Mig 080 + 083.
- **Admin** (Lexi + invited co-admins): email + password + 6-digit 2FA → 30-day session cookie. Multi-admin since mig 080: each admin has a row in `admin_users` with their own scrypt-hashed password and 2FA-to-their-own-email; sessions and trusted devices carry an `admin_user_id` FK. The `ADMIN_PASSWORD` / `ADMIN_EMAIL` env vars still work as the bootstrap path on a freshly-empty `admin_users` table. Owner can invite/remove other admins from `/admin/admins`. 5 attempts per IP per 15 minutes on the password endpoint, then lockout. "Trust this device for 30 days" cookie skips the 2FA round-trip (mig 066).

---

## Schema (key tables)

| Table | Purpose |
|---|---|
| `profiles` | Live artist profiles. v1.1 added `last_name` (generated, indexed), `trusted` (bool), `city` (text), `resumes` (jsonb of `{label, url}`), `mentorship_offering` + `mentorship_seeking` (text arrays). v1.2 minor flow added `is_minor`, `guardian_email`, `guardian_name` (mig 054). The legacy `resume_data` jsonb column was dropped in mig 087 once the multi-resume relational tables (mig 078) became authoritative. v1.4 added `phone` (mig 104) - **never rendered publicly**: editable on `/edit/[token]` and `/admin/profiles/[id]/edit`, displayed in admin via `formatPhoneDisplay()` + `tel:` link, but NEVER selected by any public-facing query (verified in audit). Pre-seeded for casting tool use; revisit trust-gate when casting tool ships (account-takeover-via-phone-rewrite becomes an impersonation vector then). |
| `resumes` | Per-profile named resumes (mig 078). One artist can have N resumes ("Director Resume", "Actor Resume", "Scenic Designer Resume"). Public profile picker at `/artists/[slug]?resume=<id>`. |
| `resume_entries` | One row per credit / training / skill entry (mig 078). `kind` enum + `data` jsonb keeps the table simple while still letting each kind carry its own field shape. `resume_ids` uuid array → which resumes the entry appears on (empty = "inbox", surfaced for triage). `source` enum: `hand` (artist-typed) / `production` (auto-created from a production_credit) / `admin`. Production-sourced rows are FK'd to `production_credits.id`. |
| `pending_submissions` | New profiles awaiting email verify + admin approval. Still uses jsonb `resume_data` as the public submit form's storage; on approval, the data expands into `resumes` + `resume_entries` via `expandLegacyResumeData()`. |
| `flagged_edits` | Untrusted artists' major edits queue here as one row per submission with `proposed_changes jsonb`. Admin reviews at `/admin/flagged-edits`. |
| `magic_link_tokens` | Single-use edit tokens (24h) and admin 2FA codes (10 min). Stale-cleanup cron also issues 30-day edit tokens when pinging long-quiet profiles. |
| `email_log` | Every Resend send: hashed recipient + type + sent_at. Drives the volume alert. |
| `email_blocklist` | Admin-curated abusive sender emails. |
| `reports` | User-submitted reports on profiles / posts. |
| `featured_profiles` | Spotlight rotation selection. |
| `site_content` | Editable copy keyed by slug (homepage, about, etc.). |
| `email_templates` | Editable email body templates with variable placeholders. |
| `email_signature` | Single source-of-truth signature row injected into every audience='community' template (mig 067). |
| `announcement_banner` | Optional site-wide banner with date range. |
| `disciplines` + `discipline_categories` | Editable list (~140 entries, 13 categories). Many-to-one. |
| `areas` | Region chips (`Tacoma / Pierce County`, `South Pierce`, `Olympia / Thurston County`, `South King County`, `Gig Harbor / Kitsap`, `Other`) with `description` for hover tooltips. Realigned to v2.x audit taxonomy in mig 045. |
| `unions` + `ethnicities` | Reference lists with descriptions. Renamed-cascade to profile arrays. |
| `admin_sessions` + `admin_login_attempts` + `admin_trusted_devices` | Login + rate-limit + remember-this-device. |
| `productions` | Shows extracted from approved callboard posts (v1.2) + manual submissions via `/calendar/submit` + the auto-sync. v1.3 added `cover_url` (mig 082) for poster images shown hero-style on `/calendar/[id]`. |
| `production_credits` | Cast / production-team tagging on productions (mig 079). `category` enum: `cast` / `production` (originally cast/creative/crew, simplified in migs 084 + 085). `source` enum: `org` / `artist` / `admin` tracks who tagged the credit. `created_by_email` for moderation. When tagged on a real profile, auto-creates a linked `resume_entries` row in the artist's inbox; deleting the credit converts the linked row to source='hand' so the artist keeps the credit they earned. |
| `admin_users` | Multi-admin (mig 080). One row per admin with email, scrypt password hash, role (`owner` or `admin`), invited_by FK, password_set_at, last_login_at. Owner is bootstrapped on first login from ADMIN_EMAIL+ADMIN_PASSWORD env vars; subsequent admins added via `/admin/admins` invite flow. `admin_sessions` and `admin_trusted_devices` both gained `admin_user_id` FK. |
| `blog_posts` | Native blog posts (mig 081) at `/blog` and `/blog/[slug]`. `body_markdown` rendered via the existing markdown pipeline. Optional `cover_url`, scheduled-publish via `published_at` (public query gates on `published_at <= now()`). Author defaults to the logged-in admin's display name. Editor at `/admin/blog`. |
| `callboard_posts` | Audition notices, production-team calls, production announcements, youth programming, teaching artist gigs, general opportunities. Email-verify token + status workflow same as `pending_submissions`. v1.4 added `publish_at` (mig 103) for scheduled-publish - public list, single-post page, marquee, /digest, cron, and live preview all gate on `publish_at <= now()` so future-scheduled posts stay hidden until their date. v1.4 also added the 90-day cap on `expires_at` relative to `publish_at`, dropped the legacy `deadline_text` field from both public + admin forms (Key dates section covers it), and made `contact_info` + `compensation_type` + `expires_at` + `publish_at` all required at submit time. |
| `callboard_post_types` | Admin-editable label/glyph table for the post_type dropdown. v1.4 consolidation: `designer` + `crew` were merged into `production_team` (mig 106 - active=true); new types `youth_programming` + `teaching_artist` (mig 105). Old slugs are deactivated rather than deleted so any old email_log row remains readable. The submit form filters on `active=true`. |
| `organizations` | **Single source of truth for theatre orgs (mig 065).** Folds the old `event_sources` + `verified_orgs` into one. `verified=true` orgs skip per-post review on callboard + calendar submits. `productions.organization_id` and `callboard_posts.organization_id` both FK here. v1.3 added `ticketing_url` (mig 086) for org-wide ticketing pages — show page button falls back: per-show `detail_url` → org `ticketing_url` → org `homepage_url`. v1.4 added `categories` text[] (mig 105) replacing the old single-value `category` enum: an org can carry multiple discipline / programming badges (Theatre + Educational Theatre etc.), drives `/theatres` chip filter + per-card badge render. Vocabulary in `src/lib/server/orgCategories.ts` — adding a slug + label there auto-surfaces it on `/theatres`, `/admin/organizations`, and `/callboard/apply-verified`. **Verified-badge gating on callboard posts: now correctly gates on `verified=true` via `loadVerifiedOrgIds()`, not on `organization_id` being non-null** (was a bug — admin-authored posts linked to unverified orgs falsely earned the badge before the f57875f fix). Manual orgs (`adapter='manual'`) appear on `/theatres` like any other; the cron filters them out via `adapter <> 'manual'`. Editable from `/admin/organizations` (name / slug / area / description / homepage / ticketing / logo / categories). |
| `callboard_subscriptions` | Opt-in weekly digest. `subscriber_email` unique, `disciplines` text[], `post_types` text[], `last_digest_at`, `unsubscribed_at`, per-row `unsubscribe_token` (v1.2). Double-opt-in via `confirmed_at` + `confirmation_token` (mig 069). |
| `marquee_settings` | Single-row config for homepage scrolling ticker. Cycles callboard posts + calendar productions. Admin-edited at `/admin/marquee` (v1.2 + mig 053). |
| `resources` + `resource_categories` | Curated link library at `/resources`. Soft-deleted with `deleted_at`. Multi-category tagging via `category_ids` (mig 062 + 063). |
| `profile_edit_log` | Audit trail of every profile save (mig 108). One row per save with `edited_by_kind` (`'artist'` / `'admin'` / `'org'`), optional `edited_by_email`, and a jsonb `changes` shaped as `{ field: { old, new } }` storing only the fields that actually changed. Powers `/admin/recent-edits`. Diff helper at `src/lib/server/profile-edit-log.ts`. History starts at mig 108 boundary — no backfill. |
| `contact_categories` + `contact_submissions` | Public site-wide contact form (mig 109). Five seeded categories (general / help / bug / feature / theatre listing) each with `primary_email` + `cc_emails` text[] routing, editable from `/admin/contact-categories`. Submissions land with status (new / in_progress / resolved / spam), append-only `notes` jsonb (each note: author, body, created_at), and trigger an email to the routed admins via the `contact_submission` template (reply_to set to the submitter's address). Admin queue at `/admin/contact`. |

All tables include `created_at`, `updated_at`. Soft-deleted rows have `deleted_at` set; the daily cron hard-deletes rows older than 30 days.

`profiles_set_updated_at` is a `BEFORE UPDATE` trigger on `profiles` that auto-bumps `updated_at = now()`. The `/directory?sort=updated` page reads this column, so it leaks bulk admin operations (publish flips, line-ending normalize) into the public "recently updated" sort. For ops that aren't user content edits, wrap the update in a transaction with `set local session_replication_role = 'replica'` to skip the trigger. Memory file `~/.claude/projects/.../memory/project_bulk_update_trigger_bypass.md` for the details.

---

## Domain + email infrastructure (live as of 2026-04-29)

- **Domain registrar**: Squarespace (annual renewal). DNS delegated to Cloudflare via custom nameservers.
- **Cloudflare DNS**: authoritative for `southsoundtheatreartists.org`. Free plan, Email Routing enabled.
- **Resend domain**: verified against the Cloudflare-managed DNS. Records added via Resend's Cloudflare integration.
- **Email Routing**: `lexi@` and `hello@` → `southsoundtheatreartists@gmail.com`.
- **Gmail Send-As**: both addresses configured to send via Resend SMTP (`smtp.resend.com:587`, username `resend`, password is the Resend API key). Outbound passes SPF/DKIM cleanly.
- **`RESEND_FROM_EMAIL`**: must use `Display Name <email>` format or mail clients show the local-part (e.g. "Hello") as sender. Current value: `South Sound Theatre Artists <hello@southsoundtheatreartists.org>`.

---

## Cron jobs

All under `.github/workflows/`. Shared infrastructure in `scripts/_lib/cron.mjs` (pg client + `sendCronEmail` wrapper that mirrors `lib/server/email.ts`). Each script is a standalone `node scripts/<name>.mjs` for local smoke-tests.

| Workflow | Schedule | Sends? |
|---|---|---|
| `keepalive.yml` | every 3 days at 12:00 UTC | no |
| `admin-daily-digest.yml` | 15:00 UTC daily | only when queue is non-empty |
| `email-volume-alert.yml` | 16:00 UTC daily | once at 70%, again at 90% |
| `stale-profile-cleanup.yml` | 17:00 UTC Mondays | one ping per stale profile |
| `callboard-weekly-digest.yml` | 06:59 UTC Mondays (11:59 PM PT Sun PDT / 10:59 PM PST) | per-subscriber, skips empty weeks |
| `calendar-sync.yml` | 16:00 UTC monthly (1st) | no (writes pending productions) |
| `backup.yml` | 18:00 UTC Sundays | no email; pushes JSON to a private repo |

---

## Conventions

**Svelte 5 runes only.** `$state()`, `$derived()`, `$effect()`, `$props()`. No stores.

**No em dashes.** Use `-` instead in code, copy, and chat.

**No `window.confirm()`, `alert()`, or `prompt()`.** Use the themed `ConfirmModal` in `$lib/components/ConfirmModal.svelte`.

**Mobile-first.** Theatre people are on their phones constantly. Default to mobile layouts and progressively enhance.

**No copy hardcoded in components.** Any user-visible string (other than UI labels like "Submit") pulls from `site_content` or its own table so Lexi can edit without touching code.

**APIs accept arrays from day one.** Even single-item operations like approve/reject use `{ ids: [...] }` so batch actions can be added later without an API change.

**All emails go through one wrapper** that logs to `email_log` (with hashed recipient + type + sent_at) before calling Resend. Enables the 70% volume alert.

**In-app vs cron email parity.** Two wrappers exist: `src/lib/server/email.ts` `sendEmail()` for SvelteKit-runtime sends, and `scripts/_lib/cron.mjs` `sendCronEmail()` for GitHub Actions cron sends + one-off CLI scripts. Both must produce identical-looking emails. The cron path's markdown→HTML pipeline lives in `scripts/_lib/email-html.mjs`, mirroring `src/lib/util/markdown.ts` + `src/lib/server/email.ts` `wrapHtmlEmail()`. Resend gets both `text` and `html` from both paths.

**Cache-Control headers on public SSR pages.** `setHeaders({ "cache-control": ... })` in `+page.server.ts` load functions of all public pages, using one of three named profiles from `src/lib/server/cache-headers.ts`:

- `CACHE_SHORT` (60s edge / 120s SWR) — high-churn lists like `/directory`, `/callboard`, `/calendar`
- `CACHE_MEDIUM` (5 min / 5 min) — `/`, `/artists/[slug]`, `/theatres`, `/blog`, `/blog/[slug]`, `/calendar/[id]`
- `CACHE_LONG` (30 min / 1 hr) — `/about`, `/privacy`, `/terms`, `/support-us`, `/contact`

All profiles use stale-while-revalidate so the next request after expiry gets the stale cached response immediately while a fresh one regenerates in the background. Admin-visible pages (the ones that include extra fields when `locals.admin` is set) skip caching for admin sessions — admins always get fresh, public visitors get cache. Admin and edit-token routes never set cache headers.

**Date columns and pg-node.** `pg` returns `date` columns as JS Date objects by default. Cron scripts that template-concat dates (`${row.run_start}T12:00:00Z`) need them as strings. `scripts/_lib/cron.mjs` calls `pg.types.setTypeParser(1082, val => val)` to override. Don't undo this without auditing every cron script.

**Bulk admin writes that shouldn't bump `updated_at`.** Wrap in a transaction with `set local session_replication_role = 'replica'` to skip the `profiles_set_updated_at` trigger. Otherwise the public `/directory?sort=updated` view gets polluted with admin operations.

**Soft-delete by default for admin actions.** Rejections and removals go to a 30-day trash before being permanently deleted.

**Markdown + toolbar for admin content editing.** Site copy and email templates are markdown stored in DB tables. Admin sees a toolbar (Bold / Italic / Link / List / Image) above a textarea with live preview alongside. Image button uploads to Cloudinary and inserts markdown syntax.

**ConfirmModal pattern**: button is `type="button"` + `onclick` that captures the surrounding form (or relevant data) into `pendingForm`/`pendingX` state; the modal's `onConfirm` then `requestSubmit()`s the form. Cancel must genuinely cancel — the old `onsubmit={(e) => !confirm(...) && e.preventDefault()}` pattern had a real bug where Svelte's `use:enhance` listener swallowed the `preventDefault`.

**Trust system (Phase A + B).** `profiles.trusted` boolean. Magic-link edits split:
- **Trusted**: all edits apply directly.
- **Untrusted**: minor fields (pronouns, area, age, languages, unions, ethnicities, social links, mentorship arrays, city) apply directly; major fields (`full_name`, `bio`, `headshot_url`, `disciplines`, `resumes`, `resume_data`) bundle into a `flagged_edits` row with `proposed_changes jsonb` for admin review at `/admin/flagged-edits`.
- New approvals default to `trusted=false`. Existing profiles seeded `true` via mig backfill.

**Svelte 5 form-submit timing gotcha.** When a chip/checkbox toggles a `$state` set and immediately calls `formEl.requestSubmit()`, Svelte hasn't re-rendered the hidden inputs yet. The form serialises with the OLD state. Fix: `setTimeout(submitNow, 0)` to defer submit by one tick. Hit on the discipline filter, the sort toggle, and would on any future state→hidden-input→submit dance.

**Mobile admin: table → card layout.** `/admin/profiles` collapses its 7-column table to stacked cards under 720px using `data-label` attrs + CSS. Mirror this for any new admin list. Goal: zero horizontal scroll at 375px.

**URL-state filters with `data-sveltekit-noscroll` + `data-sveltekit-replacestate`.** Toggles preserve scroll and don't pollute browser history. See `/directory` form.

---

## Architecture commitments

These make later phases cheap to add. Bake into v1 even when the immediate need is small:

1. **APIs accept arrays from day one.** `POST /api/admin/approve { ids: [...] }` even when called with one ID.
2. **Queue items keyed by stable IDs**, with action handlers taking ID parameters (not closures over rendered rows).
3. **All copy is in the database, not hardcoded.** `site_content`, `email_templates`, `disciplines`, `announcement_banner`, etc. Lexi never needs a code change to update text.
4. **Markdown rendering is centralized** through one shared component so output is consistent everywhere.
5. **All emails go through one wrapper** (`sendEmail`) that logs to `email_log` and checks blocklist before calling Resend.
6. **Soft-delete is the default** for admin actions; hard delete is a separate cron job after 30 days.
7. **Magic-link tokens are single-use and invalidated on use**, not just on expiry.
8. **Profile slugs are user-controlled on collision** via a popup at submission, not auto-suffixed.

---

## Admin panel structure

Sidebar order mirrors how Lexi works through the day (review queues → directory → homepage → copy → config). Hairline rules between groups using `--rule`.

1. **Review queue** (Pending / Edit review / Reports / Callboard / Organizations / Contact) — badged with attention counts, capped at "99+".
2. **Directory** (All profiles / Invitations / Recent edits).
3. **Homepage curation** (Announcement / Featured / Marquee).
4. **Site copy** (Site content / Resources / Email templates).
5. **Config** (Disciplines / Submit-form options / Callboard types / Contact routing / Blocklist).
6. **Admins** (multi-admin management).

Post-launch additions (v1.5):

- **`/admin/invitations`** — engagement dashboard for the launch cohort. Per-profile signals: clicked edit link (from `magic_link_tokens.used_at`) and profile views (from GoatCounter API, filtered per-profile from invited_at forward). Sort prioritizes engaged-but-incomplete. GoatCounter API response cached in-memory 5 min via `src/lib/server/goatcounter.ts`.
- **`/admin/recent-edits`** — chronological audit log of every profile save, backed by `profile_edit_log`. Renders inline old → new diffs per changed field. Diff helper in `src/lib/server/profile-edit-log.ts`. Writes wired into `/edit/[token]` (`kind='artist'`) and `/admin/profiles/[id]/edit` (`kind='admin'`, with `editorEmail` from `locals.admin`).
- **`/admin/contact`** + **`/admin/contact/[id]`** — public contact-form submissions queue, filterable by status, with append-only admin notes per submission.
- **`/admin/contact-categories`** — edit per-category routing (primary email + CC list) for the public `/contact` form without code changes.

Editor UX: markdown + toolbar (Bold / Italic / Link / List / Heading / Image-upload), live preview pane alongside. Image button uploads to Cloudinary and inserts the markdown syntax automatically. Email templates show a variable-placeholder sidebar.

---

## Data locations

- **Profiles, callboard, productions, content, blocklist, email log, reports**: Supabase
- **Headshots, PDF resumes, theatre logos**: Cloudinary
- **Backups**: weekly GitHub Actions JSON dump to a separate private GitHub repo

---

## Staging vs production

- **Production**: `https://southsoundtheatreartists.org` — live. Hosted on Netlify under Blake's paid `brytheatrics` team (moved from Lexi's free `ssta-admin` team mid-launch when free-tier credits ran out; see HISTORY v1.5). `PUBLIC_SITE_URL=https://southsoundtheatreartists.org` in Netlify env.
- **Repo**: `github.com/brytheatrics/south-sound-theatre-artists` (transferred from `ssta-admin` during the hosting migration). The Netlify project pulls from this. GitHub Actions cron workflows + secrets travel with the repo.
- **No separate staging environment** today — Lexi reviews on the live site. If a separate staging surface is needed later, Netlify deploy previews on PR branches are the path.
- **Long-term**: post-trip migration to Cloudflare Pages is on the TODO list to reduce hosting cost; the Netlify free tier's new credits-based model burns out fast on SSR-heavy SvelteKit.

---

## URL normalisation

`lib/util/url.ts` exports `normalizeUrl(s)` that prefixes `https://` on bare-domain URLs. Used at:
- **Save time**: submit / edit / admin-profile-edit save actions sanitize `website_url`, `facebook_url`, `linkedin_url`, `youtube_url` before writing.
- **Render time**: artist profile page applies the same shim so old rows with bare domains still link out correctly.
- **Bulk import**: same logic inlined in the .mjs script.

Without this, a value like `harryturpin.com` gets used as a relative URL and clicking it goes to `/artists/harryturpin.com`.
