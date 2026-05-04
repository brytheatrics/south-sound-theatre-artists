# Claude Code Instructions for South Sound Theatre Artists

## Project Overview

A free community web platform for South Sound (Tacoma/Olympia/Gig Harbor) theatre artists. Two main surfaces: a searchable artist directory and a callboard for audition notices and production announcements. Maintained by a single non-technical admin (Lexi).

### Key docs (read on demand, not auto-loaded)
- **`PRODUCT_SPEC.md`** - full scope: artists, callboard, admin panel, filters, resume system, email infrastructure. **Implementation status block at top** tells you what's currently shipped.
- **`BUILD_PLAN.md`** - phased implementation plan, current status header, "Maybe later" parking lot, schema additions list. **Read the status block first** before assuming a feature is unbuilt.
- **`TEST_CHECKLIST.md`** - manual test results for v1 + v1.1, known shortcuts, things still to verify.

### Current state (2026-04-29)
- v1 (directory + admin), v1.1 (resumes / mentorship / analytics), and v1.2 (callboard / resources / weekly digest / homepage marquee) are all shipped.
- All five cron workflows live under `.github/workflows/` (keepalive, daily admin digest, email volume alert, weekly callboard digest, weekly backup, stale profile cleanup). They no-op or require secrets to run; see TEST_CHECKLIST for the secret list.
- **Domain + email pipeline live.** `southsoundtheatreartists.org` is registered at Squarespace, DNS managed by Cloudflare. Resend domain-verified. Cloudflare Email Routing forwards `lexi@` + `hello@` to `southsoundtheatreartists@gmail.com`. Gmail Send-As sends outbound via Resend SMTP. Real emails deliver end-to-end (no more sandbox 403s).
- **Staging deploy live** at `https://southsoundtheatreartists.netlify.app`. Domain DNS will flip from Squarespace -> Netlify when Lexi approves. Repo is now public (sidesteps Netlify free-tier contributor limit).
- **27 imported profiles** in the DB via `scripts/bulk-import-profiles.mjs`. Magic-link edit URLs sit in `Submissions/_results.csv` waiting for mail-merge-out at launch.
- See `BUILD_PLAN.md` "Status" header for the full breakdown.

## Local Development

```bash
pnpm dev                # dev server at http://localhost:5173
pnpm check              # typecheck - must be 0 errors before committing
pnpm db:migrate         # apply pending SQL files in supabase/migrations/
pnpm db:migrate --status  # show applied vs pending without changes
```

Migrations run against `SUPABASE_DB_URL` from `.env`. Each file runs in its own transaction; reruns are idempotent (filenames tracked in a `_migrations` table). Use `on conflict do nothing` for seed inserts so re-running is safe.

## Tech Stack

- **SvelteKit** + `adapter-netlify`
- **Supabase Free** - auth (custom magic links + admin password+2FA), profiles, callboard, content
- **Cloudinary Free** - headshot + PDF storage
- **Resend Free** - transactional email (magic links, contact routing, weekly digests)
- **Cloudflare Email Routing** - admin custom-domain email forwarding to Gmail
- **Ko-fi embed** - donations
- **GitHub Actions** - keepalive cron, daily admin digest, weekly backups
- **UptimeRobot Free** - public URL monitoring

## Key Conventions

**Svelte 5 runes only.** `$state()`, `$derived()`, `$effect()`, `$props()`. No stores.

**No em dashes.** Use `-` instead - in code, copy, and chat. (User dislikes em dashes.)

**No traditional accounts.** Browse and submit are public. Editing is via single-use magic link to email. Admin uses password + magic-link 2FA + 30-day session cookie. There are no usernames, no passwords for artists, no account recovery flows.

**No `window.confirm()`, `alert()`, or `prompt()`.** Use themed modals matching the site's styling.

**Mobile-first.** Theatre people are on their phones constantly. Default to mobile layouts and progressively enhance.

**Markdown + toolbar for admin content editing.** Site copy and email templates are markdown stored in DB tables. Admin sees a toolbar (Bold / Italic / Link / List / Image) above a textarea with live preview alongside. Image button uploads to Cloudinary and inserts markdown syntax.

**No copy hardcoded in components.** Any user-visible string (other than UI labels like "Submit") pulls from `site_content` or its own table so Lexi can edit it without touching code.

**APIs accept arrays from day one.** Even single-item operations like approve/reject use `{ ids: [...] }` so batch actions can be added later without an API change.

**All emails go through one wrapper** that logs to `email_log` (with hashed recipient + type + sent_at) before calling Resend. Enables the 70% volume alert to Lexi.

**Soft-delete by default for admin actions.** Rejections and removals go to a 30-day trash before being permanently deleted.

**Themed `ConfirmModal` for every destructive action.** Lives in `$lib/components/ConfirmModal.svelte`. Pattern: button is `type="button"` + `onclick` that captures the surrounding form (or relevant data) into `pendingForm`/`pendingX` state; the modal's `onConfirm` then `requestSubmit()`s the form. Never `window.confirm()`. Cancel must genuinely cancel - the old `onsubmit={(e) => !confirm(...) && e.preventDefault()}` pattern had a real bug where Svelte's `use:enhance` listener swallowed the preventDefault.

**Trust system (Phase A + B).** `profiles.trusted` boolean. Magic-link edits split based on it:
- Trusted: all edits apply directly.
- Untrusted: minor fields (pronouns, area, age, languages, unions, ethnicities, social links, mentorship arrays, city) apply directly; major fields (`full_name`, `bio`, `headshot_url`, `disciplines`, `resumes`, `resume_data`) bundle into a `flagged_edits` row with `proposed_changes jsonb` for admin review at `/admin/flagged-edits`.
- New approvals default to `trusted=false`. Existing profiles seeded `true` via migration backfill.
- Trust pill on `/admin/profiles` flips it.

**Svelte 5 form-submit timing gotcha.** When a chip/checkbox toggles a `$state` set and immediately calls `formEl.requestSubmit()`, Svelte hasn't re-rendered the hidden inputs yet. The form serialises with the OLD state. Fix: `setTimeout(submitNow, 0)` to defer submit by one tick. We hit this on the discipline filter, the sort toggle, and would on any future state→hidden-input→submit dance.

**Mobile admin: table → card layout.** `/admin/profiles` collapses its 7-column table to stacked cards under 720px using `data-label` attrs + CSS. Mirror this for any new admin list. Goal: zero horizontal scroll at 375px.

**URL-state filters with `data-sveltekit-noscroll` + `data-sveltekit-replacestate`.** Toggles preserve scroll and don't pollute browser history. See `/directory` form.

## Auth Model

- **Browse**: zero auth, fully public
- **Submit profile / callboard post / report / contact form**: zero auth + email verification before queue
- **Edit own profile**: magic link to email, single-use, 24-hour expiry, invalidated on use
- **Admin (Lexi)**: password (env var) + magic-link 2FA code (6-digit) + 30-day session cookie. Password endpoint rate-limited to 5 attempts per IP per 15 minutes.

## Schema cheat sheet

Profiles, additions over the v1 baseline:
- `trusted` (bool) - drives the flagged_edits gate
- `last_name` (text, generated from `full_name`, lowercased, indexed) - used by the "Last name A-Z" sort
- `city` (text, optional) - granular display value; `geographic_area` still drives the directory filter
- `resumes` (jsonb array of `{label, url}`) - multiple PDF resumes per artist, capped at 20
- `resume_data` (jsonb, `{credits, training, skills}` arrays of typed objects) - structured resume builder
- `mentorship_offering`, `mentorship_seeking` (text arrays) - both indexed (GIN) for the directory's mentorship lens
- `stale_pinged_at` (timestamptz, nullable) - drives the 18-month "still active?" cron pipeline (mig 031)

v1.2 adds (callboard surface):
- `callboard_posts`, `productions` (mig 025; the original `verified_orgs` table was folded into `organizations` by mig 065)
- `organizations` - **single source of truth for theatre orgs** (mig 065). Holds calendar-sync sources (auto-pull config + bookkeeping) plus verified-org callboard/calendar auto-publish (`contact_email` + `verified` flag). `productions.organization_id` and `callboard_posts.organization_id` both FK here.
- `marquee_settings` - single row (id check enforces id=1) controlling the homepage ticker (mig 029)
- `callboard_subscriptions` - opt-in weekly digest, with per-row `unsubscribe_token` for one-click links (migs 032 + 033)
- `resources` + `resource_categories` - admin-managed link library (mig 034)

`flagged_edits` lives in `001_init.sql` (one row per submission, `proposed_changes jsonb`). Rejected status uses `rejection_reason` text.

`magic_link_tokens` doubles for both edit-profile (24h) and admin 2FA (10 min). Stale-cleanup cron also issues edit tokens with a 30-day TTL when pinging long-quiet profiles.

Reference tables (admin-editable):
- `disciplines` + `discipline_categories` - many-to-one
- `areas` (with `description` for hover tooltips)
- `unions` (with descriptions)
- `resource_categories` - sortable groups for the resource library

Soft-delete pattern: `deleted_at` column. The stale-cleanup cron handles the 30-day hard-purge sweep across `profiles`, `callboard_posts`, and `organizations` (verification-application rows only - calendar-source rows are kept around indefinitely as the cron uses `deleted_at` as a "don't re-pull" sentinel).

## Cron jobs

All under `.github/workflows/`. Shared infrastructure in `scripts/_lib/cron.mjs` (pg client + sendCronEmail wrapper that mirrors `lib/server/email.ts` behavior). Each script is a standalone `node scripts/<name>.mjs` so it can be run locally for smoke-tests.

| Workflow | Schedule | Sends? |
|---|---|---|
| `keepalive.yml` | every 3 days at 12:00 UTC | no |
| `admin-daily-digest.yml` | 15:00 UTC daily | only when queue is non-empty |
| `email-volume-alert.yml` | 16:00 UTC daily | once at 70%, again at 90% |
| `stale-profile-cleanup.yml` | 17:00 UTC Mondays | one ping per stale profile |
| `callboard-weekly-digest.yml` | 01:00 UTC Mondays (Sun PT) | per-subscriber, skips empty weeks |
| `backup.yml` | 18:00 UTC Sundays | no email; pushes JSON to a separate private repo |

## Bulk import (one-shot operational tool)

`scripts/bulk-import-profiles.mjs` was built for the launch batch of artists who emailed bios + headshots in before the site existed. Folder convention + flags documented in `scripts/BULK_IMPORT_README.md`. Key behaviors worth knowing for future related work:

- Reads `imports/<Person Name>/` directories (or any path via `--imports-dir <path>`). Folder name -> full_name.
- Per-folder files: `bio.txt` (optional), `meta.txt` (optional, key:value), one image, 0+ `.pdf` and/or `.docx` resumes (DOCX auto-converted via PowerShell + Word COM on Windows).
- Auto-infers disciplines from bio prose via an alias table; meta override wins. False positives are tolerated since artists fix their own profiles via magic-link later.
- Dedup: skips re-import on email match, refuses slug auto-suffix without an email to dedupe on.
- Defaults to `trusted = false` (safer for unknown submitters); `--trust-all` for vetted batches.
- Outputs `<imports-dir>/_results.csv` with one row per folder + magic-link edit URL for mail-merge.
- No emails go out during import. Welcome / magic-link delivery is a separate manual step at launch.

## URL normalisation

`lib/util/url.ts` exports `normalizeUrl(s)` that prefixes `https://` on bare-domain URLs. Used at:
- **Save time**: submit / edit / admin-profile-edit save actions sanitize `website_url`, `facebook_url`, `linkedin_url`, `youtube_url` before writing.
- **Render time**: artist profile page applies the same shim so old rows with bare domains still link out correctly without a backfill.
- **Bulk import**: same logic inlined in the .mjs script.

Without this, a value like `harryturpin.com` gets used as a relative URL and clicking it goes to `/artists/harryturpin.com` instead of the actual site.

## Domain + email infrastructure (live as of 2026-04-29)

- **Domain registrar**: Squarespace (where annual renewal happens). DNS delegated to Cloudflare via custom nameservers.
- **Cloudflare DNS**: authoritative for `southsoundtheatreartists.org`. Free plan, Email Routing enabled.
- **Resend domain**: verified against the Cloudflare-managed DNS. Records added via Resend's Cloudflare integration.
- **Email Routing**: `lexi@` and `hello@` -> `southsoundtheatreartists@gmail.com`. Catch-all available too.
- **Gmail Send-As**: both addresses configured to send via Resend SMTP (`smtp.resend.com:587`, username `resend`, password is the Resend API key). Outbound passes SPF/DKIM cleanly.
- **`RESEND_FROM_EMAIL`**: must use `Display Name <email>` format or mail clients show the local-part (e.g. "Hello") as sender. Current value: `South Sound Theatre Artists <hello@southsoundtheatreartists.org>`.

## Staging vs production

- **Staging**: `https://southsoundtheatreartists.netlify.app` - what Lexi reviews. Auto-deploys on push to `main`.
- **Production (post-launch)**: same Netlify site, but `southsoundtheatreartists.org` DNS points at it. Update `PUBLIC_SITE_URL` env in Netlify to the .org URL when DNS flips.
- **Repo is public** on GitHub (sidesteps Netlify's free-tier private-repo contributor limit).

## Data Locations

- **Profiles, callboard, productions, content, blocklist, email log, reports**: Supabase
- **Headshots, PDF resumes**: Cloudinary
- **Backups**: weekly GitHub Actions JSON dump to a private GitHub repo

## Git Workflow

**Standing permission granted to commit local changes without asking.** Commit at natural breakpoints (feature complete, typecheck passing, before task switch) with clear messages matching the existing repo style. Prefer new commits over amending. Mention what was committed in the response summary so Blake can review in `git log`.

**Never push without explicit permission.** Pushing triggers a Netlify build + deploy on the free tier (300 build minutes / month). We don't want to burn through that budget on incremental pushes. Always ask "want me to push these commits?" and wait for approval before `git push`. This is a hard rule - do not override it even if Blake has approved a push earlier in the same session. Each push needs its own approval.

**Never deploy manually (Netlify CLI, deploy hooks, etc.) without explicit permission.** Same rationale - any deploy consumes build minutes.

## Cost Constraints

- **Zero ongoing cost** is a hard constraint per the spec. Any feature requiring paid services must be justified or rejected.
- Watch the free-tier ceilings: Resend 3000/mo, Supabase 500MB DB + 7-day pause, Cloudinary 25GB storage / 25GB bandwidth, Netlify 125k function invocations/mo.
- Supabase keepalive cron in GitHub Actions every 3 days is mandatory.

## Admin Handoff Plan

The repo is being built by Blake but operated by Lexi (non-technical). Plan for two handoffs:
- **To Lexi**: inline help in admin panel + `ADMIN_GUIDE.md` covering common tasks
- **To future devs**: README + ARCHITECTURE doc + this CLAUDE.md + `.env.example`

Service accounts (Netlify, Supabase, Cloudinary, Resend, domain registrar) start under Blake's email, get transferred or password-changed to Lexi at launch with 2FA moved to her phone.
