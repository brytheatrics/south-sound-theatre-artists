# TODO

Master list of outstanding work. Sections, in roughly priority order:

1. **Launch-blocking** — must happen before the .org domain flips
2. **Unpushed commits** — local-only work waiting on a push
3. **Needs your eyes** — judgment calls / copy review from earlier sessions
4. **Maintenance** — non-urgent but real deadlines
5. **Post-launch v1.1** — Lexi-requested; tackle once launch is stable
6. **Parking lot** — discussed and parked; revisit when usage demands

---

## 1. Launch-blocking

Before flipping `southsoundtheatreartists.org` DNS at Cloudflare to Netlify:

- [ ] **DNS flip Cloudflare → Netlify.** Replace the four Squarespace A records with Netlify load-balancer IPs (or the ALIAS Netlify provides). Replace the `www` CNAME with the Netlify subdomain. **Both DNS-only (gray cloud)** — Netlify handles its own TLS. Add `southsoundtheatreartists.org` as a custom domain in Netlify; Let's Encrypt cert in ~10 min.
- [ ] **`PUBLIC_SITE_URL` env update** in Netlify to `https://southsoundtheatreartists.org`. Trigger a clear-cache deploy after — magic-link emails, callboard digest links, and marquee URLs all read this.
- [ ] **GitHub Actions secrets** for the cron workflows. In repo `Settings → Secrets and variables → Actions`:
  - `SUPABASE_DB_URL`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`
  - `RESEND_API_KEY`, `RESEND_FROM_EMAIL`, `ADMIN_EMAIL`
  - `PUBLIC_SITE_URL`
  - Optional: `BACKUP_REPO`, `BACKUP_REPO_TOKEN` (the backup cron no-ops cleanly without these)
- [x] ~~**`scripts/send-launch-invitations.mjs`** — built, dry-run verified.~~ When ready: run **after** `scripts/gate-incomplete-profiles.mjs` (default mode) so incomplete profiles arrive at the "your profile isn't visible yet" banner state. Test on `--slug=lexi-barnett` first. Re-run-safe (skips anyone with an unused token from the past 30 days).
- [ ] **`ADMIN_PASSWORD` rotation** in Netlify env to a stronger value. Tell Lexi via private channel.
- [ ] **Re-hide incomplete bulk-imported profiles** before invitations go out — re-run `scripts/gate-incomplete-profiles.mjs` (or the equivalent SQL). Currently 21 profiles are temporarily published so the directory looks populated during staging review.
- [ ] **Mail-merge the magic-link URLs** from `Submissions/_results.csv`. Swap `localhost:5173` for `https://southsoundtheatreartists.org` per row before sending.
- [ ] **Backup cron secrets** — set `BACKUP_REPO` (`owner/repo`) and `BACKUP_REPO_TOKEN` (fine-grained PAT with `contents:write`) once the destination repo exists.
- [ ] **`ADMIN_GUIDE.md`** — operator's reference for Lexi. Deferred to give her time on the staging deploy first; pull common-task notes from real use.
- [ ] **Remove filler info from Callboard.** Wipe the seeded / placeholder callboard posts before invitations go out so the public callboard reads as empty (or only contains real posts) on launch day. Same for any throwaway calendar entries or test profiles that slipped through.
- [ ] **Final smoke test on the .org URL** post-DNS-flip: magic-link resend, contact form delivery, admin login + 2FA, callboard submission, marquee render, all working against the live domain.

### Pre-launch verification

- [ ] **Email-flow smoke test.** Walk every transactional email type end-to-end on staging: magic-link edit, contact form, admin 2FA, admin daily digest, weekly community digest, subscription confirm + manage + unsubscribe, profile-approved welcome, rejection. Confirm each lands in Gmail / Outlook / Apple Mail without spam-flagging. The HTML pipeline (mig 067 + 068) shipped but hasn't had a clean "all flows in one pass" test.
- [ ] **HTML email rendering test.** Send the same template to Gmail web, Gmail mobile (iOS), Outlook web, Apple Mail (iOS). Confirm the logo + signature render cleanly, no broken layout, no "via gmail.com" suffix, no spam classification. ~30 min once SMTP smoke passes.
- [ ] **Backup-restore dry-run.** The weekly backup cron writes JSON to a private repo, but we don't *know* restore works until we try. Wipe a staging-only DB, rebuild from the most recent dump, confirm everything reads correctly. ~30 min. **Do this before the .org cutover** - last chance to find a backup-format bug while there's still a known-good source of truth.
- [x] ~~**Rate limiting on public submit endpoints.** Shipped (mig 077). Per-IP cooldown of 5 submits per hour per endpoint, applied to /submit, /calendar/submit, /callboard/submit, and the per-profile contact form. Logged in `submit_rate_limits`. Hit-limit returns 429 + "Too many submissions from your network in the past hour."~~

### Lexi-side onboarding (not code)

- [ ] **Ko-fi onboarding.** Connect Stripe / PayPal in her Ko-fi dashboard. Until then the embed shows a barebones "Powered by Ko-fi" panel with no working donation form. (Profile already created at `ko-fi.com/lexibarnettssta`.)
- [ ] **Service-account 2FA / password transfers** to her phone: Squarespace registrar, Netlify, Supabase, Cloudinary, Resend.

---

## 2. Unpushed commits (need a push to deploy)

Since the last push (`c786304` email-pause allowlist), commits have stacked locally but not on staging. Push when ready.

**Group A — v1.1 batch + polish + mig 088:** v1.1 features (multi-resume mig 078, production credits mig 079/082/086, multi-admin mig 080, blog mig 081, OG cards, drop `profiles.resume_data` mig 087), polish (cast-list paste parser, type-ahead in credits editor, "Currently appearing in" badge, calendar/[id] public detail page, credit-category collapse, nav blog link, /admin/organizations name+slug+area panel, org-wide ticketing URL fallback), bug fixes (/admin/admins 500, "Lexi" hardcoding, MultiResumeBuilder inbox copy, multi-fix), security fix (markdown XSS via javascript: scheme + attribute breakout), and mig 088 (drop `resources.category_id` compat shim). Migrations 078 through 088 all applied to dev DB.

**Group B — Calendar adapter expansion (overnight 2026-05-08):** New platform adapters refactor. The cron's `syncEventSource` now dispatches by `adapter` column to per-platform extractors:

- `squarespace-json` → BPA (was manual). 14 shows, 56 perfs.
- `ovationtix` → Centerstage (was manual). 6 shows, 71 perfs. Uses server-rendered `web.ovationtix.com/trs/cal/{accountId}` for the season list and Playwright for per-show schedule (with Fri/Sat 7:30pm + Sun 2pm fallback when Playwright times out).
- `ludus` → ManeStage (was ai-generic on main site) + TLT (was ai-generic on their season page). 2/20 + 4/37. Cloudflare-walled so Playwright is required.
- `eventbrite` → Dukesbay (was manual). 0 shows for now (Dukesbay has no upcoming Eventbrite events at the moment); will pick up automatically when they post one.
- `ai-generic` → Renton Civic (was manual). Partial — Claude only enumerates 1 of 5 shows due to Next.js streaming HTML. Rescue heuristic added (untested live, see "Needs your eyes" below).

Playwright is a dev-only dependency that lives in the GitHub Actions runner, never ships to Netlify. Workflow installs Chromium with cached browser binaries.

`_pending/` migration folder is empty. No new schema migrations in Group B.

---

## 3. Needs your eyes

Judgment calls and AI-generated copy from earlier sessions that benefit from a Lexi pass.

### Theatre directory copy
- [ ] **/theatres descriptions** for all 26 orgs. Generated facts-only blurbs from each org's site. Voice is Claude's, not Lexi's. Edit in `scripts/seed-theatre-metadata.mjs` then re-run `node scripts/seed-theatre-metadata.mjs --overwrite`.

### Calendar adapter follow-ups
- [ ] **Renton Civic rescue heuristic — untested live.** Hit the Anthropic monthly spend cap (resets 2026-06-01) before I could validate. The rescue logic in `extractAiGeneric` should pick up the 4 shows Claude misses on the Next.js streaming page; verify after 2026-06-01 with `node scripts/calendar-sync.mjs --org=rentoncivic --force`. If the rescue works it should land all 5 shows.
- [ ] **Centerstage default-schedule fallback.** The OvationTix per-show drill via Playwright frequently times out, so the adapter falls back to Fri/Sat 7:30pm + Sun 2pm. That's correct ~80% of the time for community theatre but wrong for shows with Wednesday matinees / Thursday previews. Spot-check Centerstage productions in `/admin/calendar` and override individual performances when needed.
- [ ] **Manual orgs to revisit.** astra, brave-stage are seeded but show `status='pending'` — they were added to the table but never given a source URL. Look up each and either set a real source_url + adapter, or leave manual.
- [ ] **Dukesbay Eventbrite check.** Currently 0 shows because they have no upcoming events on Eventbrite. When they post a new show, the next monthly cron should pick it up. If a show appears on dukesbay.org but doesn't surface in the calendar, force-run via `node scripts/calendar-sync.mjs --org=dukesbay --force`.

---

## 4. Maintenance (non-urgent, real deadlines)

- [x] ~~**GitHub Actions Node 20 → 24 migration.** Done. All 6 workflows bumped to `actions/checkout@v5`, `actions/setup-node@v5`, `pnpm/action-setup@v5`, `node-version: "24"`. Watch the next cron run for any incompatibility with @v5 (revert to @v4 if it surfaces).~~
- [ ] **Cloudinary headshot orphan cleanup.** Each profile-photo upload creates a new asset (auto-generated public_id). When a user replaces their headshot, the old asset stays around indefinitely. Currently negligible (Free tier is 25 GB, headshots ~200KB; would need 100k+ orphans to matter), but worth a periodic-audit script eventually. Build `scripts/cleanup-orphan-headshots.mjs` that walks Cloudinary's `headshots/` folder, compares to currently-referenced URLs across `profiles`, `pending_submissions`, and parsed-out URLs in `site_content.body_markdown`, and deletes anything not referenced. Run manually so the operator can review before destructive action.

---

## 5. Post-launch v1.1 (Lexi-requested)

Lexi reviewed the parking lot and confirmed wanting these. Tackle once launch is stable; rough priority order. Total scope ~25-35 hrs of focused work.

- **Production credits with cross-linking + self-serve tagging.** Each calendar item auto-gets a public `/productions/[id]` page. Verified orgs can edit cast/creative for their own productions (paste-a-cast-list parser with fuzzy name matching against existing artist profiles, plus manual add+tag). Artists can also self-claim credits if their org doesn't tag them. New tables: `production_credits` (production_id, profile_id nullable, display_name, position free-text, category enum: cast/creative/crew, source enum: org/artist/admin, order). Profile gets a "Currently appearing in: [Show]" badge during the run window. For v1.1 every credit lives immediately, no claim-verification gating - Lexi handles disputes ad-hoc from /admin. Subsumes the v1.3 "Currently appearing in" badge. ~10-15 hrs.

- **Linked resume rows + auto-population from production credits.** When an org/artist tags a credit, it auto-creates a corresponding row in the artist's resume builder so they don't double-enter. Each resume row gets a `source` field (`hand` or `production`) and an optional `production_credit_id`. Linked rows show a small chip in the edit UI ("Linked to Hamlet, TLT, June 2026"); artist can reorder, hide, or detach (which converts to `hand` and breaks the link). Dedup on auto-add: fuzzy-match title+org+year against existing hand rows; if match, promote the existing row to linked rather than create a duplicate. Edge cases: org untags artist later → linked row auto-converts to `hand` with a toast; production renamed → linked row auto-updates. ~4-6 hrs.

- **Multi-resume builder.** Artists can have multiple named resumes (e.g., "Director Resume," "Scenic Design Resume," "Actor Resume"). Each resume row carries a `resume_ids[]` so one credit can appear on multiple resumes (actor-director wants acting credits on both). New `resumes` table (id, profile_id, name typed by artist, order). Public profile shows a resume picker - tabs if 2-3 resumes, dropdown if more, default to the first. Each resume gets its own URL (`/artists/sarah-jones?resume=director`) for sharing. Auto-added production credits land in an **inbox** ("Tagged in 2 productions, assign →") rather than auto-routing - artist explicitly assigns to specific resumes. Migration: existing artists keep their current resume as a single default named whatever they typed. ~4-6 hrs.

- **Blog section for native writing.** `/blog` with the same markdown editor + toolbar as About, link in main header + footer. New `blog_posts` table (slug, title, body_markdown, cover_url optional, published, published_at). Public list + `/blog/[slug]` detail. "Lexi Barnett" byline for v1.1 (generalizes when multi-admin lands). Ship markdown-first; if Lexi finds it restrictive, add a small set of custom shortcodes (pull-quote, image-with-caption, callout, YouTube embed) plus blog-specific CSS (generous line-height, styled pull quotes, optional drop cap) before considering WYSIWYG. ~2-3 hrs CRUD + page; +1 hr if shortcodes/styling pass needed. Sound on Stage write-up about SSTA could anchor the launch post if Lexi lines that up.

- **Multi-admin with per-user accounts.** Swap env-var auth for an `admin_users` table (email, password_hash, role) with 2FA-via-email per user, plus `/admin/admins` invite + management page so Lexi can add admins herself without code changes. All admins are fully equal for v1.1 (no scoped roles); add granularity later if a use case surfaces. ~3-4 hrs.

- **Per-artist OG / social-share cards.** Auto-generate per-profile cards via Cloudinary transformation overlay (no new infra) - headshot + name + primary discipline + "South Sound Theatre Artists" wordmark, themed background, 1200x630. Replaces the generic site card when `/artists/[slug]` gets shared to Instagram / iMessage / Facebook. Mockup first, then build. ~1.5 hrs. Lower priority - "awesome but not blocking" per Lexi.

- **Add Sound on Stage to /resources** + optional SSTA write-up invitation. Pure content task for Lexi; no code. Could double as the inaugural blog post. (Lexi may be conflating blog and resources - Blake to clarify with her first.)

---

## 6. Parking lot ("Maybe later")

Discussed and parked; revisit if real usage surfaces them.

- **Profile QR code.** Cut for v1.1 in favor of the Share button (Web Share API). Revisit if artists ask for printable QR for headshot/business-card use. ~1 hr.
- **Better admin empty states.** Functional today, just utilitarian. Revisit if onboarding feels barren.
- **PDF redaction tooling.** A draw-rectangles-on-canvas → flatten-to-image-PDF workflow for artists who upload PDFs with contact info. The pre-upload warning modal covers the educational part and the structured resume builder sidesteps the use case. Revisit if PDFs with exposed contact info show up in real submissions. Approach: PDF.js renders pages to canvas, user draws white rectangles, pdf-lib assembles a new PDF from rasterised pages so the text-layer is gone.
- **Discipline-specific resume sections.** v1.1 ships a generic credits/training/skills builder. Revisit if specific disciplines (designers? technicians?) struggle with the generic shape.
- **Multi-category disciplines.** Sound Designer plausibly belongs in both Music & Sound and Design; left single-category for now. Revisit if multiple ambiguous-home disciplines surface.
- **Embedded analytics summary on /admin home.** Right now the View Analytics pill links out to GoatCounter. Could pull top numbers via API and render summary cards on /admin once we know which metrics matter.
- **Calendar-sync title-drift checker.** The LLM extraction occasionally normalizes proper nouns ("Mamma Mia!" → "Mama Mia"). Prompt fix should prevent recurrences but doesn't catch them when they do happen. Build only if title drift surfaces a second time. Approach: re-fetch source, Levenshtein-distance check against stored titles, flag distance > 2.
- **Sponsors / paid listings page.** A `/sponsors` (or "Services" / "Partners") page where vetted businesses useful to theatre artists pay for a listing. Distinct from `/resources` (curated free) and `/theatres` (auto-pulled producing). Recommendation: wait for the first vendor to *ask* before building. Schema sketch + open questions live in repo history (commit `bf7affc`).
- **Volunteer Opportunities.** A new section / post type for theatres to post non-production needs - "Looking for ushers Saturday 6/7," "House manager for closing weekend," "Help painting the set Tues evening." Distinct from the audition / designer / crew callboard slices because it's lower-commitment + recurring. Could ship as a new `post_type` slug + filter chip on `/callboard` (~30 min) or as its own page (~2 hrs). Lean toward the chip - the callboard already has the verification + auto-expire plumbing.
- **Unified "needs your attention" feed on /admin.** Today /admin shows pending counts for six surfaces (profile submissions, awaiting verification, callboard posts, verified org applications, flagged edits, calendar productions). A merged latest-N feed (oldest first, with a per-row link straight to the relevant admin page) would make the daily check-in faster than scanning each sub-tab. ~1 hr.
- **"View as visitor" preview for landing-page copy.** When Lexi edits `/admin/content` for the callboard lede, she has to open `/callboard` in another tab to verify it looks right. An admin-only `?preview=draft` query param that pulls draft content on the public page would match WYSIWYG expectations without building one. Not blocking - current workflow works.
- **Multi-field directory search.** `/directory` search is name-only today. Real theatre searches are skill-based ("lighting designer who works with drag performers"). Multi-field search across name + bio + disciplines via Postgres FTS or `ilike` across columns would be more useful. Wait for actual usage to confirm before building - launch-day expectation might just be "find me by name" and the search-bar copy can prime that.

---

## v1.3 / v2.x roadmap

These are deferred features with shape, not active work. Triggers are concrete signals from real users:

- **v1.3 Discovery layer.** "What's Playing" calendar already shipped. "Currently appearing in" badges + production detail pages promoted to v1.1 (above). Remaining piece: a public production archive page (searchable past + present productions across orgs) - low priority until enough archived productions exist for the archive to be useful.
- **v2.x Auto-populated regional calendar.** Audit complete (2026-05-02). 26 orgs, mostly AI-generic extraction (Claude Haiku 4.5, ~$0.10/run, monthly cron). Architecture settled; Phase 0 dry-run is the next step. See [HISTORY.md](HISTORY.md) for the full audit findings.
- **v2 driven by real usage.** Batch admin actions (if Lexi clears >10 items per session regularly), image cropping UI (if artists complain about auto-crop), embeddable profile widgets (if anyone asks), favorites / starred artists (localStorage, no accounts), WYSIWYG editor migration (if Lexi struggles with markdown), whatever else surfaces.

---

## Confirmed skips (do not build)

These came up in planning and were explicitly cut. Don't add without revisiting:

- Forum or chat (moderation load)
- Reviews or ratings of artists / theatres (community drama risk)
- Internal messaging (email already exists)
- vCard / "Add to contacts" download (privacy gets weird with hidden emails)
- Theatre venue mini-directory (overkill, callboard contacts cover it)
- Image cropping UI in v1 (Cloudinary auto-crop is fine)
- Embeddable profile widgets (no demand signal)
- Batch admin actions in v1 (architecture allows cheap retrofit)
- Traditional account system (magic-link + admin password is the entire identity model)
- One-click email-based admin approval links (more attack surface than benefit)
- WYSIWYG editor in v1 (markdown + toolbar covers 99%; migration path exists if Lexi struggles)
- PDF parsing / column mapper (folded into the redaction discussion)
- Auto-graduate-at-18 flow for minor profiles (no birthdate stored — intentional, keeps minor PII off the system; manual flip via the "I'm 18 now" button on the artist's edit page)

---

## v1.1 build notes (2026-05-07)

Decisions I made while building the v1.1 batch (multi-resume, production credits, multi-admin, blog, OG cards) that you'll want to review or test. Roughly in order from "most likely to surprise you" to "most likely fine."

### Decisions worth your eyes

- [ ] **Resume changes no longer flow through the trust gate.** Previously the resume builder edits queued in `flagged_edits` for untrusted profiles. Now they apply directly. Reasoning: low abuse risk (artists writing about themselves), and the production-credit auto-link is the constraint that matters. If drama erupts, admin can still remove via the new editor at /admin/profiles/[id]/edit. Existing flagged_edits with `resume_data` in `proposed_changes` are stale - approve/reject them by hand and ignore the resume_data field.
- [x] ~~**`profiles.resume_data` jsonb is no longer authoritative**~~ Column dropped in mig 087. Resumes / resume_entries are the only source of truth. (`pending_submissions.resume_data` still exists as the public submit form's jsonb storage - that's intentional.)
- [ ] **Auto-added production credits land in the artist's "inbox"** (resume_ids=[]), not on a specific resume. The artist explicitly assigns them via the chip toggles in MultiResumeBuilder. Per your call (option A from chat) - simpler than auto-routing by role category.
- [ ] **Linked resume rows can't be free-edited** until detached. The chip in the editor reads "🔗 Linked credit" and the input fields are disabled. Detaching converts source from `production` to `hand`, breaks the FK, and lets the artist edit normally. Trade-off: keeps the resume row + production credit in lockstep.
- [ ] **Production credit dedup.** When auto-creating a linked row from a credit, fuzzy-matches existing hand-entered rows on `show + company + year` (case-insensitive) and promotes that row to linked instead of duplicating. Could surface unexpected promotions if an artist has a hand-typed entry similar to a real production - low risk, but flag if you see it.
- [ ] **Production credits live immediately, no claim-verification gating.** Anyone with the right token (admin / org rep / artist via /edit/[token]) can add them. The `source` enum tracks who added (`admin`/`org`/`artist`) and `created_by_email` is logged for audit. If abuse surfaces, we add a "claim pending org confirmation" flow (which I noted we'd skip for v1.1).
- [x] ~~**`profiles.resume_data` jsonb only mirrors the FIRST resume.**~~ Moot - column dropped in mig 087.
- [ ] **`/calendar/[id]` is now public** and the calendar list links every entry there. The external "Tickets / details" URL still works but is surfaced from the detail page (and from a small "Tickets ↗" link on the calendar list rows). If anyone was bookmarking the external links via the calendar, that path still works.
- [ ] **Multi-admin: `ADMIN_PASSWORD` env still works as the bootstrap path.** First successful login from `ADMIN_EMAIL`+`ADMIN_PASSWORD` creates the owner row with the hashed env password (scrypt, no new dep). After that, env vars are only consulted on a genuinely empty `admin_users` table. Don't change `ADMIN_PASSWORD` casually after Lexi's first login - it's still the recovery fallback.
- [ ] **All existing admin sessions + trusted devices were wiped** by mig 080. You'll need to re-log in once. I haven't verified the bootstrap flow end-to-end (would have required burning a 2FA email), so be ready to fall back to `ADMIN_SKIP_2FA=true` in dev if anything blows up.
- [ ] **Login form has a new (optional) email field.** Blank = uses ADMIN_EMAIL env (bootstrap path). Multi-admin logins always supply email + password.
- [ ] **2FA codes route to the matched admin's email**, not ADMIN_EMAIL env, after multi-admin migration. Owner stays at ADMIN_EMAIL via bootstrap.
- [ ] **Org self-serve is admin-mediated.** No public "request edit access" form. Lexi clicks "Generate edit link" on /admin/organizations next to a verified org row, copies the URL out of the form-ok banner, sends to the org rep manually. 60-day TTL. Decision: avoids needing an email template + public form for v1.1.
- [ ] **OG cards skip minor profiles.** No headshot exposure via the social-share preview. Falls back to the generic site card.
- [ ] **Cast list paste parser** recognises `Name as Role`, `Name - Role`, `Name: Role`, `Role: Name` (only when LHS matches a known role keyword like "Director"), and `Name, Role`. Lines without a separator land as `{name: line, position: ""}` so the admin can fix in-line.

### Things to test (non-obvious bits)

- [ ] **Multi-resume editor at /edit/[token]:** add a resume, rename it inline, add credits, toggle chips to assign credits to multiple resumes, view inbox tab, delete a resume (entries should drop into inbox). Each action is a live API call; check console for any 4xx/5xx.
- [ ] **Public /artists/[slug] with multiple resumes:** picker chips appear at top of the resume block. Default = resume with most entries. URL `?resume=<id>` deep-links to a specific one.
- [ ] **Production credits on /admin/calendar/[id]/credits:** quick-add a single credit, paste-cast a multi-line list, click "Find profile" on an unlinked credit, link to a real artist, edit the position field (cascades to linked resume row's role).
- [ ] **`/calendar/[id]` public detail page:** confirm linked artists are hyperlinked to /artists/[slug] and unlinked free-text names render plain.
- [ ] **"Currently appearing in" badge on /artists/[slug]:** create a credit linking an artist to a production whose run dates include today (or open within 60 days). Visit the profile, confirm the badge.
- [ ] **Org self-serve flow:** /admin/organizations -> click Generate edit link on a verified org -> copy URL -> open in incognito -> /org-edit/[token] lists the org's productions -> click Manage credits -> /org-edit/[token]/credits/[id] is the same editor as admin sees.
- [ ] **Artist self-claim:** /edit/[token] has a "Claim a production credit" panel near the bottom. Search a production by title, pick it, fill role + category, submit. Credit appears on the production's /calendar/[id] page; resume row appears in the artist's inbox.
- [ ] **Multi-admin bootstrap:** sign in once at /admin/login with the env email + password. Admin_users gets a row, sessions table gets repopulated. Visit /admin/admins as the owner; invite a fake co-admin; copy the invite link; open in incognito; set a password at /admin/accept-invite/[token]; sign in as that admin (email + password).
- [ ] **Blog:** /admin/blog -> + New post -> draft -> edit, add cover image, publish -> /blog and /blog/[slug] render. Footer + Nav menu both link to /blog publicly.
- [ ] **OG cards:** share /artists/hester-elwell to iMessage / Messenger / Slack and confirm the per-artist card renders. The Cloudinary URL is in the page's `og:image` meta tag - pasting it into a browser should return a real image (HTTP 200, image/jpeg). I tested URL generation but not visual quality - may need stroke/font tweaks if names look bad against busy headshots. Fallback to the generic site card kicks in for non-Cloudinary headshots.

### Operational notes

- **No migrations parked.** Migs 078-081 ran cleanly against the dev DB.
- **All commits are local, not pushed.** Standing rule. Push when you're ready.
- **Test data was seeded + cleaned up** (Hester briefly had test resumes + production credits during verification; both wiped before the commits).
- **`pnpm check` is clean** at every commit point. Lexi-side test data stays in the dev DB only.
- **No new external dependencies.** Everything uses what was already in the repo (scrypt from `node:crypto` for password hashing).
