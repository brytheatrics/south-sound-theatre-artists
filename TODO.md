# TODO

Master list of outstanding work. Sections, in roughly priority order:

1. **Launch-blocking** — must happen before the .org domain flips
2. **Unpushed commits** — local-only work waiting on a push
3. **Needs your eyes** — judgment calls / copy review from earlier sessions
4. **Verification sweeps** — manual run-throughs not yet done
5. **Maintenance** — non-urgent but real deadlines
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
- [ ] **`scripts/send-launch-invitations.mjs`** — bulk-send the `admin_invitation` email template to every imported artist. Behavior:
  - Recipients: every published profile **except** Lexi and Blake.
  - Skip placeholder emails (`@unknown.ssta.local`) with a warning.
  - Generate a fresh edit token per artist (30-day TTL); insert to `magic_link_tokens`.
  - Use `sendEmail` so every send hits `email_log`.
  - `--dry-run` and `--slug=foo` flags.
  - Run **after** `scripts/gate-incomplete-profiles.mjs` (default mode) so incomplete profiles arrive at the "your profile isn't visible yet" banner state.
  - Test plan: `--slug=lexi-barnett` and `--slug=blake-r-york` first.
- [ ] **`ADMIN_PASSWORD` rotation** in Netlify env to a stronger value. Tell Lexi via private channel.
- [ ] **Re-hide incomplete bulk-imported profiles** before invitations go out — re-run `scripts/gate-incomplete-profiles.mjs` (or the equivalent SQL). Currently 21 profiles are temporarily published so the directory looks populated during staging review.
- [ ] **Mail-merge the magic-link URLs** from `Submissions/_results.csv`. Swap `localhost:5173` for `https://southsoundtheatreartists.org` per row before sending.
- [ ] **Backup cron secrets** — set `BACKUP_REPO` (`owner/repo`) and `BACKUP_REPO_TOKEN` (fine-grained PAT with `contents:write`) once the destination repo exists.
- [ ] **`ADMIN_GUIDE.md`** — operator's reference for Lexi. Deferred to give her time on the staging deploy first; pull common-task notes from real use.
- [ ] **Final smoke test on the .org URL** post-DNS-flip: magic-link resend, contact form delivery, admin login + 2FA, callboard submission, marquee render, all working against the live domain.

### Lexi-side onboarding (not code)

- [ ] **Ko-fi onboarding.** Connect Stripe / PayPal in her Ko-fi dashboard. Until then the embed shows a barebones "Powered by Ko-fi" panel with no working donation form. (Profile already created at `ko-fi.com/lexibarnettssta`.)
- [ ] **Service-account 2FA / password transfers** to her phone: Squarespace registrar, Netlify, Supabase, Cloudinary, Resend.

---

## 2. Unpushed commits (need a push to deploy)

Since the last push (`85c1c9b` env fix), these have landed locally but not on staging. Many are user-visible. Push when ready:

- `32037b5` Theme: drop Auto mode
- `36c0d95` Resources: multi-category tagging
- `5dab51c` Compat shim: re-add `resources.category_id` temporarily
- `200b172` Resources: trigger to sync `category_id ← category_ids[1]`
- `22b832f` Mentorship: dedicated `/mentorship` discovery page
- `362287e` Homepage: playbill redesign + three-door nav + spotlight rework
- `a0ae07f` Mentorship: accordion discipline filter to match `/directory`
- `27051ed` Calendar org consolidation → single `organizations` table (mig 065)
- `7a2da7e` Trust-this-device admin login (mig 066)
- `2849902` Marquee: calendar items deep-link with `?highlight=` and pulse
- `5d502ac` Email: HTML pipeline with signature substitution (migs 067 + 068)
- `c1197c0` Weekly community digest: double-opt-in + calendar slice (mig 069)
- ... plus everything from this week's sessions (color revert, "Other" area fixes, three new bulk-imported profiles, favicon tint, etc.)

After this batch ships, run the parked migration:

```bash
mv supabase/migrations/_pending/070_resources_cleanup.sql supabase/migrations/
pnpm db:migrate
```

That migration drops the `resources.category_id` compat shim from migs 062 + 063.

---

## 3. Needs your eyes

Judgment calls and AI-generated copy from earlier sessions that benefit from a Lexi pass.

### Theatre directory copy
- [ ] **/theatres descriptions** for all 26 orgs. Generated facts-only blurbs from each org's site. Voice is Claude's, not Lexi's. Edit in `scripts/seed-theatre-metadata.mjs` then re-run `node scripts/seed-theatre-metadata.mjs --overwrite`.

### Theatre data flags (verify, then check off)
- [ ] **Bremerton Community Theatre URL changed.** Old `bremertoncommunitytheatre.org` redirects to `bctshows.com`. Updated `homepage_url`, kept `source_url` (still valid for arts-people scrape). Confirm cron picks them up next sync.
- [ ] **Mustard Seed lives at `oslc.com/mustardseed/`**, not `mustardseedtheater.com`. Updated `homepage_url`, kept `source_url` pointing at csstix where their actual ticketing happens.
- [ ] **ManeStage**: described as Sumner originally, actual address is Puyallup. Description corrected; `area_id` already correct (South Pierce).
- [ ] **Northwest Center Theatre — likely defunct or renamed.** Wix URL is empty/dormant. There's a separate active org named "Northwest Theatre Lab" (nwtheatrelab.com) that may be the rebrand. Worth asking around before including in /theatres.

### Three new bulk-imported drafts (2026-05-06)
- [ ] **Hester Elwell, JoJo Flores, Thomas Morisada** — imported as hidden drafts with no area set. Open `/admin/profiles?published=false`, set `geographic_area`, flip `published` (or leave for the artist to fill in via their magic-link).

---

## 4. Verification sweeps (polish layer, manually un-checked)

These shipped via individual commits and need a sweep before invitations go out:

- [ ] **Submit form fields admin page** (`/admin/submit-form`): add a test area, rename it, confirm it cascades to a profile that uses it (spot-check `geographic_area` text), then remove. Repeat for unions and ethnicities. Verify "Other" rows are locked.
- [ ] **Auto-save sort number** on `/admin/submit-form` and `/admin/disciplines`: edit number, tab away, refresh, confirm new position stuck. Empty/unchanged values should not fire a request.
- [ ] **Save banner placement** on `/admin/profiles/[id]/edit`: scroll to bottom, click Save, confirm "Saved." appears next to the button (not 2000px up in the header).
- [ ] **Mentorship dots** on `/directory` cards: profile with `mentorship_offering` populated shows a rust dot top-right; hover reveals styled tooltip listing disciplines. Same for moss + `mentorship_seeking`. Side-by-side when both populated.
- [ ] **Discipline display order**: on `/edit/[token]` (or admin edit), reorder via up/down arrows, save, confirm card teaser on `/directory` matches new order. "Shows on cards" badge appears only on the top two rows.
- [ ] **Complete-to-publish gate**: run `scripts/gate-incomplete-profiles.mjs` (default mode), open an unpublished bulk-import profile's edit link, see the rust banner listing missing fields, fill them in, save, confirm profile auto-publishes. Banner mirrored on `/admin/profiles/[id]/edit`.
- [ ] **Headshot/photo required**: try saving `/submit` or `/edit/[token]` without a photo, confirm error.
- [ ] **Awaiting email verification panel** at `/admin`: insert a fake `pending_email` row (or wait for a natural one), click "Resend verification", confirm email arrives + `email_log` has a new row.
- [ ] **Sort tiebreaker** on `/directory?sort=newest`: most recently approved profile appears first within today's date batch.
- [ ] **Resume privacy banner** on `/edit/[token]` when artist already has resumes uploaded: rust panel above the resume list, same redact-phone-and-email advice as the upload modal.
- [ ] **Mobile body weight**: open the site at 375px width, body copy should read substantial (not "delicate"). Inter Tight 500.
- [ ] **5xx outage page** — temporarily break `SUPABASE_DB_URL` in `.env`, confirm friendly outage page renders. Skipped on every prior run.

---

## 5. Maintenance (non-urgent, real deadlines)

- [ ] **GitHub Actions Node 20 → 24 migration.** All 6 workflows currently pin `actions/checkout@v4`, `actions/setup-node@v4`, and `pnpm/action-setup@v4`, which run on Node 20. GitHub forces Node 24 default on **2026-06-02** and removes Node 20 entirely on **2026-09-16**. Bump action versions to `@v5` (or later, when stable) for all three before September. One-line change per action per workflow; no code changes.
- [ ] **Cloudinary headshot orphan cleanup.** Each profile-photo upload creates a new asset (auto-generated public_id). When a user replaces their headshot, the old asset stays around indefinitely. Currently negligible (Free tier is 25 GB, headshots ~200KB; would need 100k+ orphans to matter), but worth a periodic-audit script eventually. Build `scripts/cleanup-orphan-headshots.mjs` that walks Cloudinary's `headshots/` folder, compares to currently-referenced URLs across `profiles`, `pending_submissions`, and parsed-out URLs in `site_content.body_markdown`, and deletes anything not referenced. Run manually so the operator can review before destructive action.

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
- **Multi-admin with per-user accounts.** When Lexi wants to add a second admin, swap env-var auth for an `admin_users` table (email, password_hash, role), keep 2FA-via-email but route to that user's email. Includes an `/admin/admins` invite + management page. ~3-4 hours; design choices clearer once a real second user is in mind.

---

## v1.3 / v2.x roadmap

These are deferred features with shape, not active work. Triggers are concrete signals from real users:

- **v1.3 Discovery layer.** "What's Playing" calendar (production announcements as month/list view), "Currently appearing in" badges on artist profiles, public production archive page (searchable past + present productions). Ships from manually-submitted data; can launch before v2.x.
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
