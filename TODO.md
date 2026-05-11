# TODO

> ⚠️ **PUSH BEFORE THURSDAY 2026-05-14.** Blake is out of town May 14 - ~May 25. Two digest-Sundays fall during travel (May 17 + May 24). Without a push, the scheduled crons send broken empty plain-text digests. Currently queued local-only commits on `main`:
> - `dc6d670` Cron emails: render markdown + brand wrapper
> - `188a8dd` Fix: weekly digest empty - keep pg date columns as YYYY-MM-DD strings
> - Plus the SKIP_SLUGS edit to `scripts/send-launch-invitations.mjs` (uncommitted) — Blake removed himself so he gets included in the bulk send

Master list of outstanding work. Reorganized 2026-05-09 / -10 around three
real ownership questions:

1. **Launch-day sequence** - the ordered checklist for the .org cutover
2. **You need to do** - human-only work (decisions, accounts, eyeballs on the live site)
3. **Claude can do** - codeable work that doesn't depend on launch state

Plus the standing sections: review queue, maintenance, parking lot, confirmed skips, and the v1.1 ship-review checklist that's still pending your pass.

> **Currently 65+ commits unpushed.** See HISTORY.md "v1.4 launch-prep batch" for the full list of what shipped in this branch.

---

## 1. Launch-day sequence

These are gated on the .org domain flip and should happen roughly in order.

### Pre-flip prep (any time before launch day)

- [ ] **Push the 65+ unpushed commits to main.** Includes everything from the May 9-10 launch-prep sessions: launch-grace pipeline (migs 100-101), callboard scheduled publish (mig 103), profile phone field (mig 104), organizations.categories multi-badge (mig 105), production_team post type consolidation (mig 106), digest dated subject + Sunday-night cron move, /digest page restructure, expanded backup table coverage, anti-spam on 4 more endpoints, verified-badge bug fix, apply-verified area + categories, clickable team headshots/names, removed Ko-Fi widget, calendar search + typeahead, resume builder polish, email-test panel removal, etc. See HISTORY.md "v1.4 launch-prep batch" for the full breakdown.
- [ ] **Add `ANTHROPIC_API_KEY` to GitHub Actions secrets.** Calendar-sync cron silently skips it now; without the key the workflow fails on `ai-generic` adapter sources. Add at `Settings → Secrets and variables → Actions → New repository secret`. Value is the `sk-ant-...` from console.anthropic.com.
- [ ] **Manual-trigger the backup workflow on main after push** to verify the expanded 31-table dump runs cleanly. Check the `ssta-backups` repo afterward for a `snapshots/<today>/` folder with 31 JSON files.
- [ ] **Manual-trigger the calendar-sync workflow** once `ANTHROPIC_API_KEY` is in. Next scheduled run is 2026-06-01; manual trigger gives fresh data ahead of launch. (Earliest you should run it: 2026-06-01, when the Anthropic monthly spend cap resets.)
- [x] ~~**Re-hide incomplete bulk-imported profiles** before invitations go out.~~ Superseded by mig 100's launch-grace pipeline: bulk-imported profiles get 30 days from `invited_at` to complete required fields; cron warns at T+27 and auto-hides at T+30. Save handlers on `/edit/[token]` + `/admin/profiles/[id]/edit` auto-republish when fields fill in. No manual `gate-incomplete-profiles.mjs` run needed at launch. (`scripts/gate-incomplete-profiles.mjs` and the `--unhide` companion stay around as dev tools but are not part of the launch sequence.)
- [ ] **Wipe filler info from the callboard** so the public board reads as empty (or only contains real posts) on launch day. Same for any throwaway calendar entries or test profiles that slipped through. (Claude can do this on request — see section 3.)

### Flip the domain

- [ ] **DNS flip Cloudflare → Netlify.** Replace the four Squarespace A records with Netlify's load-balancer IPs (or the ALIAS Netlify provides). Replace the `www` CNAME with the Netlify subdomain. Both DNS-only (gray cloud) - Netlify handles its own TLS.
- [ ] **Add `southsoundtheatreartists.org` as a custom domain in Netlify.** Let's Encrypt cert provisions in ~10 min.
- [ ] **Update `PUBLIC_SITE_URL` in Netlify env** to `https://southsoundtheatreartists.org`. Trigger a clear-cache deploy after - magic-link emails, callboard digest links, and marquee URLs all read this.
- [ ] **Rotate `ADMIN_PASSWORD`** in Netlify env to a stronger value. Tell Lexi via private channel.

### Post-flip verification

- [ ] **Final smoke test on the .org URL.** Magic-link resend, contact form delivery, admin login + 2FA, callboard submission, marquee render, all working against the live domain.
- [ ] **Email-flow smoke test.** Walk every transactional email end-to-end on the live domain: magic-link edit, contact form, admin 2FA, admin daily digest, weekly community digest, subscription confirm + manage + unsubscribe, profile-approved welcome, rejection. Confirm each lands in Gmail / Outlook / Apple Mail without spam-flagging.
- [ ] **HTML email rendering test.** Send the same template to Gmail web, Gmail mobile (iOS), Outlook web, Apple Mail (iOS). Confirm logo + signature render cleanly, no broken layout, no "via gmail.com" suffix, no spam classification. ~30 min.
- [ ] **Backup-restore dry-run.** Restore the most recent JSON snapshot into a scratch DB (or a fresh Supabase project) and confirm everything reads correctly. Last chance to find a backup-format bug while there's still a known-good source of truth. ~30 min.

### Send invitations

- [ ] **Mail-merge magic-link URLs from `Submissions/_results.csv`.** Swap `localhost:5173` for `https://southsoundtheatreartists.org` per row before sending.
- [ ] **Run `scripts/send-launch-invitations.mjs`.** Already built and dry-run verified. Test on `--slug=lexi-barnett` first. Re-run-safe (skips anyone with an unused token from the past 30 days). Run **after** `gate-incomplete-profiles.mjs`.

### Lexi handoff

- [ ] **Service-account 2FA / password transfers** to Lexi's phone: Squarespace registrar, Netlify, Supabase, Cloudinary, Resend.
- [ ] **Ko-fi onboarding.** Lexi connects Stripe / PayPal in her Ko-fi dashboard. The widget itself was removed from /support-us in commit `250d320` (was rendering as the empty "Powered by Ko-fi" panel). Once she's onboarded, swap `<KofiWidget />` back into `src/routes/support-us/+page.svelte` (the component file is still in `$lib/components/`) and update the page copy to mention donations are live.

---

## 2. You need to do

Items that are gated on a human - your decisions, your accounts, your eyes on the live site.

### Decisions / approvals

- [ ] **Push approval for the 65+-commit batch.** Standing rule: I never push without explicit per-batch approval. When ready, say the word.
- [ ] **v1.1 ship-review checklist.** See the bottom of this file - 10+ items I built without your eyes on, that you'll want to walk through before launch.

### Account / external-service work

- [ ] Add `ANTHROPIC_API_KEY` to GitHub Actions secrets (above)
- [ ] Service-account 2FA transfers to Lexi (above)
- [ ] Ko-fi Stripe/PayPal connection (Lexi)

### Live-domain testing

- [ ] Smoke test on the .org URL (above)
- [ ] Email-flow smoke test on production domain (above)
- [ ] HTML email rendering test (above)
- [ ] Backup-restore dry-run (above)

---

## 3. Claude can do

Code / DB work that doesn't depend on launch state. I'll knock these out whenever you point me at them.

### Pre-launch hygiene

- [ ] **Wipe filler info from the callboard.** The 6 seeded posts plus any test productions / placeholder rows that slipped in during staging. DB-side cleanup, similar to the test-fixture wipe we just did.
- [ ] **Calendar org-category filter.** /theatres now has chip filters for Theatre / Educational Theatre / Opera / etc. (orgs.categories array). The calendar (`/calendar`) doesn't yet filter by org category - someone hunting for "Educational Theatre productions" can't. Plumb the org's categories through to the production list query, add a chip filter row, and update the digest queries the same way for parity. ~1.5-2 hrs. Adding new badges to `KNOWN_CATEGORY_SLUGS` would auto-surface here too once the wiring lands.
- [ ] **`ADMIN_GUIDE.md` draft** for Lexi. Currently deferred to give her time on the staging deploy first; could draft a skeleton from the admin panel walkthrough now and let her layer in real-use notes after launch. ~1 hr.

### Adapter / data follow-ups

- [ ] **Renton Civic rescue heuristic** - untested live. Hit the Anthropic monthly spend cap before validation. Verify after 2026-06-01 with `node scripts/calendar-sync.mjs --org=rentoncivic --force`. If the rescue works it should land all 5 shows.
- [ ] **Centerstage default-schedule fallback spot-check.** OvationTix per-show drill via Playwright frequently times out, so the adapter falls back to Fri/Sat 7:30pm + Sun 2pm. Right ~80% of the time but wrong for Wednesday matinees / Thursday previews. Spot-check Centerstage productions in `/admin/calendar` and override individual performances when needed.
- [ ] **Manual orgs with no source URL.** `astra` and `brave-stage` are seeded but show `status='pending'` - never given a source URL. Look up each and either set a real source_url + adapter, or leave manual.
- [ ] **Dukesbay Eventbrite check.** Currently 0 shows because they have no upcoming events on Eventbrite. When they post a new show, the next monthly cron should pick it up. If a show appears on dukesbay.org but doesn't surface in the calendar, force-run via `node scripts/calendar-sync.mjs --org=dukesbay --force`.

### Theatre directory copy

- [ ] **/theatres descriptions for all 26 orgs.** Generated facts-only blurbs from each org's site. Voice is Claude's, not Lexi's. Edit in `scripts/seed-theatre-metadata.mjs` then re-run `node scripts/seed-theatre-metadata.mjs --overwrite`.

### Maintenance (non-urgent)

- [ ] **Cloudinary headshot orphan cleanup script.** Each profile-photo upload creates a new asset (auto-generated `public_id`). When a user replaces their headshot, the old asset stays around indefinitely. Currently negligible (Free tier is 25 GB, headshots ~200KB; would need 100k+ orphans to matter). Build `scripts/cleanup-orphan-headshots.mjs` that walks Cloudinary's `headshots/` folder, compares to currently-referenced URLs across `profiles`, `pending_submissions`, and parsed-out URLs in `site_content.body_markdown`, and deletes anything not referenced. Run manually so you can review before destructive action.

---

## 4. Parking lot

Discussed and parked. Mostly speculative - revisit if real usage signals demand. The first sub-section is the exception: definite builds that just got sequenced for after launch.

### Definite builds (post-launch)

- **Self-serve edit for callboard posts.** Today there's no public path to edit a posted call - posters have to email Lexi. Build an "Edit this post" link near the bottom of `/callboard/[id]` (or on the post-submit thanks page) that takes them to a small form: re-enter the name + email they used at submit time, system emails them a fresh magic-link to `/callboard/edit/[token]`. Token TTL = until expires_at, or 30 days max. Reuses most of the public submit form's component. ~3-4 hrs total: token issuance + edit page + edit-link request page + email template. Mirrors the artist-side `/edit-link` + `/edit/[token]` flow that already works for profiles, just scoped to callboard rows.

### v2.x roadmap (deferred)

- **v2.x Auto-populated regional calendar polish.** Audit complete (2026-05-02). 26 orgs, mostly AI-generic extraction. Architecture settled; Phase 0 dry-run was the next step but adapter expansion (Group B) covered 5 of the highest-volume orgs already.
- **v2 driven by real usage.** Batch admin actions (if Lexi clears >10 items per session regularly), image cropping UI (if artists complain about auto-crop), embeddable profile widgets (if anyone asks), favorites / starred artists (localStorage, no accounts), WYSIWYG editor migration (if Lexi struggles with markdown).

### v1.3 ideas (light shape)

- **Public production archive page** (searchable past + present productions across orgs). Low priority until enough archived productions exist for the archive to be useful.

### Smaller bets

- **Profile QR code.** Cut for v1.1 in favor of the Share button (Web Share API). Revisit if artists ask for printable QR for headshot/business-card use. ~1 hr.
- **Better admin empty states.** Functional today, just utilitarian. Revisit if onboarding feels barren.
- **PDF redaction tooling.** A draw-rectangles-on-canvas → flatten-to-image-PDF workflow for artists who upload PDFs with contact info. The pre-upload warning modal covers the educational part and the structured resume builder sidesteps the use case. Revisit if PDFs with exposed contact info show up in real submissions. Approach: PDF.js renders pages to canvas, user draws white rectangles, pdf-lib assembles a new PDF from rasterised pages so the text-layer is gone.
- **Discipline-specific resume sections.** v1.1 ships a generic credits/training/skills builder. Revisit if specific disciplines (designers? technicians?) struggle with the generic shape.
- **Multi-category disciplines.** Sound Designer plausibly belongs in both Music & Sound and Design; left single-category for now. Revisit if multiple ambiguous-home disciplines surface.
- **Embedded analytics summary on /admin home.** Right now the View Analytics pill links out to GoatCounter. Could pull top numbers via API and render summary cards on /admin once we know which metrics matter.
- **Calendar-sync title-drift checker.** The LLM extraction occasionally normalizes proper nouns ("Mamma Mia!" → "Mama Mia"). Prompt fix should prevent recurrences but doesn't catch them when they do happen. Build only if title drift surfaces a second time. Approach: re-fetch source, Levenshtein-distance check against stored titles, flag distance > 2.
- **Sponsors / paid listings page.** A `/sponsors` (or "Services" / "Partners") page where vetted businesses useful to theatre artists pay for a listing. Distinct from `/resources` (curated free) and `/theatres` (auto-pulled producing). Wait for the first vendor to *ask* before building. Schema sketch + open questions live in repo history (commit `bf7affc`).
- **Volunteer Opportunities.** A new section / post type for theatres to post non-production needs - "Looking for ushers Saturday 6/7," "House manager for closing weekend," "Help painting the set Tues evening." Distinct from the audition / designer / crew callboard slices because it's lower-commitment + recurring. Could ship as a new `post_type` slug + filter chip on `/callboard` (~30 min) or as its own page (~2 hrs). Lean toward the chip - the callboard already has the verification + auto-expire plumbing.
- **Unified "needs your attention" feed on /admin.** Today /admin shows pending counts for six surfaces. A merged latest-N feed (oldest first, with a per-row link straight to the relevant admin page) would make the daily check-in faster. ~1 hr.
- **"View as visitor" preview for landing-page copy.** When Lexi edits `/admin/content` for the callboard lede, she has to open `/callboard` in another tab to verify it looks right. An admin-only `?preview=draft` query param that pulls draft content on the public page would match WYSIWYG expectations without building one. Not blocking - current workflow works.
- **Multi-field directory search.** `/directory` search is name-only today. Real theatre searches are skill-based ("lighting designer who works with drag performers"). Multi-field search across name + bio + disciplines via Postgres FTS or `ilike` across columns would be more useful. Wait for actual usage to confirm before building.
- **Per-post discipline-specific anti-spam tuning.** Current rate limit is 5 submits/hour/IP/endpoint, applied uniformly. Could differentiate (e.g., contact form gets 10/hour, callboard submit gets 3/hour) once real-traffic patterns are visible.
- **Calendar "Later this month" bucket.** /digest page + email currently caps calendar at 14 days out. A 15-30 day bucket could surface farther-out productions. Holding because (per discussion) callboard's dead-zone problem is more pressing and was already solved with "Still open."
- **CSV bulk import for verified orgs (calendar + callboard).** A production manager pasting/uploading a CSV to add a whole season's worth of productions or callboard posts in one shot, instead of submitting one form at a time. Verified-org-only since the trust gate already exists for them. Needs: per-surface example/template CSV downloadable from the upload page (column headers documented), strict per-row validation with a preview-before-commit step (show parsed rows + flag any rows missing required fields or with bad enum values), idempotency on re-upload (dedup on title+run_start for productions, title+expires_at for callboard). Same approach as `bulk-import-profiles.mjs` but interactive instead of one-shot, and gated on the org-edit token rather than admin-only. ~6-8 hrs each side; could reuse a lot of code between the two.
- **/help page in the hamburger.** Public walk-through of common flows: how to submit a profile, how the magic-link edit flow works, how to claim a production credit, how the digest subscription works, etc. Strongest version is task-based ("How do I…?") not feature-listed, and the copy comes from questions Lexi actually fields rather than speculation - so wait until she has a few months of operator notes before writing. ~2-3 hrs once the content is decided. In the meantime, inline tooltips / hint text on the forms themselves cover the most common confusion points.
- **Profile CSV export with phone-PII guard.** No admin profile-export feature exists today. If one gets built later (probable - "give me a list of every artist with their phone for casting outreach"), the phone column needs special handling: separate "Export with phone numbers" button distinct from the regular export, confirm modal naming exactly what's included, audit-log row stamped when the PII export runs. Default export should omit phone. See `mig 104` comment about phone privacy boundaries for context.

---

## 5. Confirmed skips (do not build)

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
- Auto-graduate-at-18 flow for minor profiles (no birthdate stored - intentional, keeps minor PII off the system; manual flip via the "I'm 18 now" button on the artist's edit page)
- Default `e_trim` on headshot URLs (1/50 defect rate didn't justify the over-crop risk - manual Cloudinary edits cover it)
- "Volunteer" compensation type (subsumed by "None / unpaid"; dropped from the submit form)

---

## 6. v1.1 ship-review checklist

I built the v1.1 batch (multi-resume, production credits, multi-admin, blog, OG cards) without your eyes on the decisions. These items are still pending your pass.

### Decisions worth your eyes

- [ ] **Resume changes no longer flow through the trust gate.** Previously the resume builder edits queued in `flagged_edits` for untrusted profiles. Now they apply directly. Reasoning: low abuse risk (artists writing about themselves), and the production-credit auto-link is the constraint that matters. If drama erupts, admin can still remove via /admin/profiles/[id]/edit. Existing flagged_edits with `resume_data` in `proposed_changes` are stale - approve/reject by hand.
- [ ] **Auto-added production credits land in the artist's "inbox"** (resume_ids=[]), not on a specific resume. Artist explicitly assigns via chip toggles in MultiResumeBuilder.
- [ ] **Linked resume rows can't be free-edited** until detached. Chip reads "🔗 Linked credit" and inputs are disabled. Detaching converts source from `production` to `hand`, breaks the FK, and lets the artist edit normally.
- [ ] **Production credit dedup.** When auto-creating a linked row from a credit, fuzzy-matches existing hand-entered rows on `show + company + year` (case-insensitive) and promotes that row to linked instead of duplicating. Could surface unexpected promotions if an artist has a hand-typed entry similar to a real production - low risk.
- [ ] **Production credits live immediately, no claim-verification gating.** Anyone with the right token can add them. The `source` enum tracks who added (`admin`/`org`/`artist`). If abuse surfaces, we can add a "claim pending org confirmation" flow.
- [ ] **`/calendar/[id]` is now public** and the calendar list links every entry there. The external "Tickets / details" URL still works but is surfaced from the detail page.
- [ ] **Multi-admin: `ADMIN_PASSWORD` env still works as the bootstrap path.** First successful login from `ADMIN_EMAIL`+`ADMIN_PASSWORD` creates the owner row with the hashed env password (scrypt). After that, env vars are only consulted on a genuinely empty `admin_users` table. Don't change `ADMIN_PASSWORD` casually after Lexi's first login - it's the recovery fallback.
- [ ] **All existing admin sessions + trusted devices were wiped** by mig 080. You'll need to re-log in once. Bootstrap flow not verified end-to-end (would have required burning a 2FA email).
- [ ] **Login form has a new (optional) email field.** Blank = uses `ADMIN_EMAIL` env (bootstrap path). Multi-admin logins always supply email + password.
- [ ] **2FA codes route to the matched admin's email**, not `ADMIN_EMAIL` env, after multi-admin migration. Owner stays at `ADMIN_EMAIL` via bootstrap.
- [ ] **Org self-serve is admin-mediated.** No public "request edit access" form. Lexi clicks "Generate edit link" on /admin/organizations next to a verified org, copies the URL out of the form-ok banner, sends to the org rep manually. 60-day TTL.
- [ ] **OG cards skip minor profiles.** No headshot exposure via the social-share preview. Falls back to the generic site card.
- [ ] **Cast list paste parser** recognises `Name as Role`, `Name - Role`, `Name: Role`, `Role: Name` (only when LHS matches a known role keyword like "Director"), and `Name, Role`. Lines without a separator land as `{name: line, position: ""}` so admin can fix in-line.

### Things to test

- [ ] **Multi-resume editor at /edit/[token]:** add a resume, rename inline, add credits, toggle chips to assign credits to multiple resumes, view inbox tab, delete a resume (entries should drop into inbox). Each action is a live API call; check console.
- [ ] **Public /artists/[slug] with multiple resumes:** picker chips appear at top of the resume block. Default = resume with most entries. URL `?resume=<id>` deep-links.
- [ ] **Production credits on /admin/calendar/[id]/credits:** quick-add a single credit, paste-cast a multi-line list, click "Find profile" on an unlinked credit, link to a real artist, edit position field (cascades to linked resume row's role).
- [ ] **`/calendar/[id]` public detail page:** linked artists are hyperlinked to /artists/[slug]; unlinked free-text names render plain.
- [ ] **"Currently appearing in" badge on /artists/[slug]:** create a credit linking an artist to a production whose run dates include today (or open within 60 days). Visit profile, confirm badge.
- [ ] **Org self-serve flow:** /admin/organizations → click Generate edit link on a verified org → copy URL → open in incognito → /org-edit/[token] lists org's productions → click Manage credits → /org-edit/[token]/credits/[id] is the same editor as admin sees.
- [ ] **Artist self-claim:** /edit/[token] has a "Claim a production credit" panel near the bottom. Search a production by title, pick it, fill role + category, submit. Credit appears on the production's /calendar/[id] page; resume row appears in the artist's inbox.
- [ ] **Multi-admin bootstrap:** sign in once at /admin/login with env email + password. admin_users gets a row, sessions table repopulates. Visit /admin/admins as owner; invite a fake co-admin; copy invite link; open in incognito; set password at /admin/accept-invite/[token]; sign in as that admin (email + password).
- [ ] **Blog:** /admin/blog → + New post → draft → edit, add cover image, publish → /blog and /blog/[slug] render. Footer + Nav menu both link to /blog publicly.
- [ ] **OG cards:** share /artists/<slug> to iMessage / Messenger / Slack and confirm the per-artist card renders. The Cloudinary URL is in the page's `og:image` meta tag - pasting it into a browser should return a real image (HTTP 200, image/jpeg). URL generation tested but not visual quality - may need stroke/font tweaks if names look bad against busy headshots.
