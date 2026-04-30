# Test Checklist

Build commit range: `580794a` → current `main`.

**Last full run-through: 2026-04-27.** All manual tests below pass except
the 5xx outage page (skipped — requires intentionally breaking
`SUPABASE_DB_URL`).

**As of 2026-04-29 the site is live on Netlify staging:**
`https://southsoundtheatreartists.netlify.app`. Real emails deliver
end-to-end (Resend domain verified). DNS for the .org domain is
managed by Cloudflare; A records still point at Squarespace until
launch. See "Launch-day email setup" below for the step-by-step DNS
flip plan.

Quick map of what shipped:

| Step | What | Where |
|---|---|---|
| 7 | Admin auth (password + 2FA + 30-day session) | `/admin/login`, `/admin/verify`, `hooks.server.ts`, `lib/server/admin-auth.ts` |
| 8 | Admin pending queue (approve / reject) | `/admin` |
| 9 | Magic-link edit flow | `/edit-link`, `/edit/[token]`, `/edit/done` |
| 10 | Public directory (filters + search + sort + age-exclusion note) | `/directory` |
| 11 | Profile page + contact form (with Reply-To) | `/artists/[slug]` |
| 12 | Admin profile mgmt + soft-delete trash | `/admin/profiles`, `/admin/profiles/trash` |
| 13 | Report a profile + admin reports queue | `/report`, `/admin/reports` |
| 14 | Email blocklist | `/admin/blocklist` |
| 15 | Editable site_content (markdown + preview) | `/admin/content` |
| 16 | Editable email_templates | `/admin/templates` |
| 17 | Editable disciplines (add / reorder / remove) | `/admin/disciplines` |
| 18 | Featured profiles (admin curation + pause) | `/admin/featured` + homepage rotation |
| 19 | Announcement banner (date-windowed + enabled flag) | `/admin/banner` + site-wide layout |
| 21 | Sitemap.xml + robots.txt | `/sitemap.xml`, `static/robots.txt` |
| 22 | Graceful 404 + 5xx error boundary | `+error.svelte` |

---

## Decisions you should make before launch

- [x] **Resend domain verification** - DONE 2026-04-29. SPF / DKIM /
  DMARC records added via Resend's Cloudflare integration. Domain
  `southsoundtheatreartists.org` shows all green checkmarks in
  Resend. `RESEND_FROM_EMAIL` flipped from `onboarding@resend.dev`
  to `South Sound Theatre Artists <hello@southsoundtheatreartists.org>`.
- [x] **Privacy + Terms** - polished draft lives in `site_content`
  (last_updated date, contact email, cookies note, minors clause,
  governing law, change-notice). Lexi can fine-tune in /admin/content;
  no lawyer review chosen.
- [ ] **`ADMIN_PASSWORD`** - imported placeholder still in Netlify env
  vars (currently `SsTaADMIN3823`). Rotate to a stronger password
  before public launch and tell Lexi via private channel.
- [x] **`static/robots.txt`** sitemap URL updated to `.org` domain.
- [ ] **DNS flip Squarespace -> Netlify**. Cloudflare A records still
  point at Squarespace IPs from the existing site. When Lexi green-
  lights the staging deploy, flip A records to Netlify's load-balancer
  IPs and update `PUBLIC_SITE_URL` in Netlify env to `.org`. Trigger a
  clear-cache redeploy after.

---

## Email pipeline (DONE 2026-04-29)

Steps 1-5 + 7 below were completed today. The site now sends and
receives real email end-to-end through `southsoundtheatreartists.org`.

1. [x] **Resend domain verified.** SPF, DKIM, DMARC records added via
   Resend's Cloudflare integration. Old placeholder `v=spf1 -all`
   record manually deleted (it would have blocked all sends).
2. [x] **DMARC record.** Added by the Resend integration.
3. [x] **Cloudflare Email Routing.** Active for
   `lexi@southsoundtheatreartists.org` and
   `hello@southsoundtheatreartists.org`. Both forward to
   `southsoundtheatreartists@gmail.com`.
4. [x] **Gmail Send-As.** Both addresses configured to send through
   Resend SMTP (`smtp.resend.com:587`, username `resend`, password is
   the Resend API key). Outbound passes SPF / DKIM cleanly - no "via
   gmail.com" suffix.
5. [x] **Site env vars updated.**
   - `RESEND_FROM_EMAIL` = `South Sound Theatre Artists <hello@southsoundtheatreartists.org>`
     (display-name format so mail clients show the org name as
     sender, not just "hello").
   - `ADMIN_EMAIL` = `lexi@southsoundtheatreartists.org`.
   - Both `.env` (local dev) and Netlify production env have the new
     values.
6. [x] **`static/robots.txt`** sitemap URL updated to .org.
7. [x] **Smoke-tested.** Contact form on `/artists/blake-r-york`
   delivers cleanly: `email_log` row shows `status='sent'`, recipient
   gets the email with proper From + Reply-To, replies thread back to
   the original sender.

## Launch-day still-to-do

When Lexi green-lights the staging site for public launch:

1. [ ] **DNS flip Squarespace -> Netlify.** In Cloudflare DNS, replace
   the four Squarespace A records on the apex with Netlify's load-
   balancer IPs (or the ALIAS record Netlify provides). Replace the
   `www` CNAME with the Netlify subdomain. **Set both to DNS-only
   (gray cloud)** - Netlify handles its own TLS, doesn't play well
   with Cloudflare's orange-cloud proxy. Add `southsoundtheatreartists.org`
   as a custom domain in Netlify; it provisions a Let's Encrypt cert
   in ~10 minutes.
2. [ ] **Update `PUBLIC_SITE_URL`** in Netlify env to
   `https://southsoundtheatreartists.org`. Trigger a clear-cache
   deploy after - magic-link emails, callboard digest links, marquee
   item URLs all read this for absolute paths.
3. [ ] **GitHub Actions secrets.** Set the cron-job env vars in
   `Settings -> Secrets and variables -> Actions`:
   `SUPABASE_DB_URL`, `RESEND_API_KEY`, `RESEND_FROM_EMAIL`,
   `ADMIN_EMAIL`, `PUBLIC_SITE_URL`, `SUPABASE_URL`,
   `SUPABASE_SERVICE_ROLE_KEY`. Optional: `BACKUP_REPO`,
   `BACKUP_REPO_TOKEN` for the weekly backup cron (no-ops cleanly
   when unset).
4. [ ] **Mail-merge magic-link URLs** from the bulk-import
   `_results.csv` to invite the 27 imported artists. Swap
   `localhost:5173` for `https://southsoundtheatreartists.org` in
   each URL before sending.
5. [ ] **Rotate `ADMIN_PASSWORD`** in Netlify env to a stronger
   value. Tell Lexi via private channel.
6. [ ] **Lexi's Ko-fi onboarding.** Connect Stripe / PayPal in her
   Ko-fi dashboard so the embed widget renders a real donation form.
   Until that's done the iframe shows a barebones "Powered by Ko-fi"
   panel.
7. [ ] **Final smoke test on the .org URL.** Magic-link resend, contact
   form delivery, admin login + 2FA, callboard submission, marquee
   render all working against the live domain.

---

## Manual tests

### Admin auth (step 7)

- [x] `/admin` while signed out → redirects to `/admin/login`.
- [x] Wrong password 5 times → 6th attempt blocked with "Too many"
      message (429).
- [x] Correct password → 2FA email lands at `ssta.admin@gmail.com`.
      Code verifies → land on `/admin`.
- [x] Sign out → cookie clears, `/admin` redirects to login again.
- [x] Re-enter the same code after signing in → "already used".
- [x] Stale code (backdated `expires_at`) → "That code has expired."

### Admin pending queue (step 8)

- [x] Real submission via `/submit` (ssta.admin@gmail.com) reaches the
      queue after email verification.
- [x] Click row → expanded detail (9 fields, headshot/no-headshot, bio,
      links, actions).
- [x] Approve → row vanishes, profile published at `/artists/<slug>`,
      welcome email logged + delivered.
- [x] Reject with reason → row vanishes, rejection email logged.

### Magic-link edit (step 9)

- [x] Welcome-email edit link works.
- [x] Edits apply, including new headshot upload.
- [x] Single-use enforced (DB shows `used_at` on the burned token).
- [x] `/edit-link` resends a fresh link.

### Public directory (step 10)

- [x] `/directory` shows all 11 published profiles + ages on cards
      where set.
- [x] Discipline checkbox filters live (URL updates, grid narrows).
- [x] Area + union chips, language input, age window, name search,
      "Has headshot" toggle all narrow the grid.
- [x] "Clear (N)" wipes all filters.
- [x] Empty result shows "It's quiet here · for now" state.
- [x] Sort chips (Newest members / Recently updated / Last name A-Z)
      change order without scrolling to top.
- [x] Strict age filter excludes profiles with no range; below-grid
      note tells the searcher how many were excluded.

### Profile + contact (step 11)

- [x] Profile renders: hero name, pronouns, disciplines, area, union
      chips, sidebar (Disciplines, Area, Playable age, Languages,
      Unions, Ethnicity).
- [x] Click Contact → form scrolls into view, submit → "Message sent"
      state.
- [x] Email lands at the artist's address (in dev, only delivers to
      ssta.admin@gmail.com).
- [x] **Reply** in the recipient's mail client targets the sender, not
      the relay address. (Bug fixed during the run.)
- [x] Malformed email → inline server error "Enter a valid email."
- [x] Blocklist silent block: success UI shown, no `email_log` row
      created.

### Admin profile mgmt + trash (step 12)

- [x] `/admin/profiles` lists profiles, search by name works.
- [x] Live/Hidden pill toggles `published`.
- [x] Trash → themed `ConfirmModal` (no native dialog), Cancel
      genuinely cancels (Cancel-deletes bug fixed).
- [x] `/admin/profiles/trash` shows soft-deleted rows.
- [x] Restore → `deleted_at = null`, back in main list (still hidden).
- [x] Delete forever → row hard-removed from DB.
- [x] Sort chips on admin list (Recently updated / Newest / Last name).

### Reports (step 13)

- [x] File a report on a profile, lands in `/admin/reports` under
      "Open".
- [x] Resolve / Dismiss tab counts update.
- [x] Editable notes on any status; resolve/dismiss preserves prior
      notes.

### Blocklist (step 14)

- [x] Add email → appears in list.
- [x] Add same email again → "Already blocked." error.
- [x] Remove → vanishes.

### Site content + templates + disciplines (steps 15-17)

- [x] `/admin/content` save → preview pane updates → public page
      reflects on next request.
- [x] `/admin/templates` save preserves `{{double_braces}}` variables
      (no HTML escaping).
- [x] `/admin/disciplines` add → appears in /submit picker. Reorder
      via sort_order. Remove via themed `ConfirmModal`.

### Featured + banner (steps 18-19)

- [x] Add a profile to featured → homepage spotlight uses it.
- [x] Pause toggle → drops out of rotation; with no active featured,
      spotlight falls back to date-seeded random pick.
- [x] Banner with body + enabled + open-ended window shows above nav.
- [x] `ends_at` in the past → banner gone.
- [x] `enabled = false` → banner gone immediately.

### Sitemap + error page (steps 21-22)

- [x] `/sitemap.xml` returns XML with all public paths + every
      published profile (8 static + N profiles).
- [x] `/robots.txt` allows `/`, blocks `/admin`, `/edit`, `/report`.
- [x] Friendly 404 page on unknown URL ("Not found." with recovery
      links).
- [ ] (Hard / skipped) DB outage → 5xx page renders. Best tested by
      temporarily breaking `SUPABASE_DB_URL` in `.env`.

---

## Bugs found and fixed during the run-through

- **Plays age → Playable age** rename (consistent with submit/edit
  forms which already used "Playable").
- **Discipline-toggle race**: clicking a discipline checkbox submitted
  the form before Svelte rendered the new hidden `<input name="d">`,
  so the URL and grid were always one click behind. Fixed with a
  `setTimeout(submitNow, 0)`.
- **Sort-toggle race**: same bug, same fix.
- **Strict age filter + exclusion note**: when an age filter is set,
  profiles with no range are dropped (so the filter actually narrows)
  and a small italic note below the grid tells the searcher how many
  were excluded.
- **Has-headshot filter chip** added.
- **Themed `ConfirmModal`** replaces the three native `confirm()`
  dialogs in admin pages. The old onsubmit-confirm pattern also had a
  real bug where Cancel still submitted the form because Svelte's
  `use:enhance` listener ran before the inline `preventDefault()`.
- **Reply-To missing** on contact emails: hitting Reply in the
  recipient's inbox went to the relay address instead of the sender.
  `sendEmail` now accepts `replyTo` and the contact action passes it.
- **Last-name sort**: generated `last_name` column (lowercased,
  indexed) for theatre-convention "Smith, John" ordering.
- **Filter changes scroll-to-top**: added `data-sveltekit-noscroll`
  + `data-sveltekit-replacestate` so toggles preserve scroll and
  don't pollute history.
- **Lost-note bug on /admin/reports**: resolve/dismiss no longer
  nullifies an existing note.

---

## Known shortcuts to clean up later

- **Mobile admin sidebar** wraps as a chip row at <720px but isn't a
  hamburger. Functional but not ideal.
- **Markdown preview in /admin/content** is a tiny in-house parser
  (headings, paragraphs, **bold**, *italic*, lists, links). Not full
  CommonMark. Good enough for the editable copy.
- **Pagination** ships at PAGE_SIZE=24. Tested by temporarily lowering
  to 4 in dev.

Resolved since the last run-through:
- ✅ Admin-side profile editor at `/admin/profiles/[id]/edit`
- ✅ `flagged_edits` split via the trust gate (Phase B)
- ✅ Directory pagination
- ✅ `window.confirm()` calls replaced with themed `ConfirmModal`

---

## v1.1 manual checks (done 2026-04-28)

### Mentorship + directory lens

- [x] `/submit`, `/edit/[token]`, admin editor, `/admin/profiles/new`
      all expose Mentorship fieldset with both DisciplinePickers.
- [x] Profile sidebar shows "Mentoring in: ..." and "Looking to learn:
      ..." when set.
- [x] Directory chips: "Open to mentoring" + "Looking to learn"
      narrow the grid.
- [x] Discipline picker doubles as a lens: with mentoring chip on +
      Lighting Designer selected, grid narrows to mentors offering
      lighting; with learning chip on + Director, narrows to people
      seeking directing knowledge.
- [x] Hint copy under DISCIPLINE label updates to reflect the active
      lens.
- [x] Trust gate treats mentorship as a minor field (applies directly
      even when `trusted=false`).

### Resume builder

- [x] Three sections (Credits / Training / Skills), Add / Up / Down /
      Remove per row.
- [x] Empty rows dropped on save.
- [x] Trust-gated as a major field: untrusted artists' changes queue
      in `flagged_edits` with a count summary in the diff view.
- [x] Public profile renders sections under "About," skipping any
      that are empty.

### PDF resume upload

- [x] Multiple resumes per profile, each with a label.
- [x] Cloudinary raw uploads via `/api/cloudinary/sign-resume` with
      8 MB cap and `application/pdf` validation.
- [x] **Pre-upload `ConfirmModal`** warns about contact info on
      public-directory PDFs before the upload starts.
- [x] Profile renders a pill-button row with the labels.
- [x] Trust gate as a major field; flagged_edits diff shows
      "Acting (file.pdf), Directing (file.pdf)" per resume.
- [x] **Cloudinary delivery requires** the "Allow PDF and ZIP files
      delivery" toggle in Cloudinary console → Settings → Security.
      Without it, GETs to the resume URL return 401.

### Trust system (Phase A + B)

- [x] `profiles.trusted` column. Default `false` for new approvals;
      existing profiles seeded `true` via migration backfill.
- [x] "Trusted" / "Not trusted" pill on `/admin/profiles` row.
- [x] Magic-link edit (trusted): all edits apply directly.
- [x] Magic-link edit (untrusted): minor fields apply, major fields
      (`full_name`, `bio`, `headshot_url`, `disciplines`, `resumes`,
      `resume_data`) queue in `flagged_edits`.
- [x] `/admin/flagged-edits` Open / History tabs; diff view shows
      FIELD / CURRENT / PROPOSED. Approve copies values onto profile,
      Reject takes optional reason.

### City field

- [x] Optional `profiles.city` column. Submit / edit / admin editor
      all expose City input.
- [x] Hero subtitle prefers city over `geographic_area` when set
      ("...lakewood" instead of "tacoma area"). Sidebar shows both.
- [x] Directory area filter still keys on `geographic_area` only -
      city is purely a display refinement.

### Areas refactor

- [x] Migration 017: regions with anchor cities ("Tacoma area",
      "Olympia area", "Gig Harbor / Kitsap", added "South King
      County"). Existing profiles remapped.
- [x] Migration 018: `areas.description` column. Hover tooltip shows
      ("Tacoma, Lakewood, Puyallup, ...") on chips, inlined into the
      option text on selects.

### Disciplines bulk-add + category admin

- [x] Migration 019: ~140 disciplines across 13 categories. "Actor"
      renamed to "Actor (Stage)" with profile arrays remapped in
      lockstep.
- [x] `/admin/disciplines` adds Categories management: add / rename
      (cascades to disciplines.category) / reorder / remove (blocked
      when in use).

### Sort + filter polish

- [x] Sort chips on `/directory` and `/admin/profiles`: Newest /
      Recently updated / Last name A-Z. Last name uses generated
      `profiles.last_name` column (lowercased, indexed).
- [x] Filter / sort changes preserve scroll and don't pollute
      browser history (`data-sveltekit-noscroll` +
      `data-sveltekit-replacestate`).
- [x] Strict age filter excludes profiles with no `playable_age_*`
      set; below-grid note tells the searcher how many were
      excluded by other-filter context.
- [x] "Has headshot" filter chip.

### Profile page polish

- [x] Material Symbols person icon for missing-headshot placeholder
      cards.
- [x] Sidebar disciplines / unions / ethnicities / languages render
      as small chips, not comma lists.
- [x] Social handles all clickable (Instagram / TikTok / Twitter
      handles linked via `handleUrl()`).
- [x] **Share button** (`navigator.share` on mobile, clipboard
      fallback on desktop).
- [x] City + area shown together in sidebar "Based in" row.

### Mobile admin

- [x] All admin pages fit at 375px viewport with no horizontal
      overflow.
- [x] `/admin/profiles` table collapses to stacked cards under 720px.
- [x] `/admin/featured` artist-picker SELECT no longer blows out the
      grid column.

### Branding + logos

- [x] Lexi-supplied logo assets in `/static/`: `favicon.svg` (moss
      tile + cream brackets), `logo-short.svg` (used in nav +
      footer), `logo-long.svg` (reserved).
- [x] Pre-launch privacy + terms polish: last-updated date, contact
      email, cookies note, minors clause, governing law, change
      notice, contact section. All editable from `/admin/content`.

### Analytics

- [x] GoatCounter integration. Public routes only, gated on
      `PUBLIC_GOATCOUNTER_CODE`. "View analytics" pill in the public
      nav opens the dashboard in a new tab.
- [x] **Localhost is intentionally skipped** by GoatCounter's
      `count.js`. Real numbers start once the site is pushed and
      visited via the live URL.

### Admin nav memory

- [x] Admin layout writes the current section path to localStorage
      (truncated to the parent tab, never a deep edit page) so the
      "Admin" pill in the public nav bounces back to the section
      Lexi was last on.
- [x] Read happens at click time, not via $effect, to avoid
      stale-on-render due to effect ordering.

### Form ordering

- [x] All four forms (submit / edit / admin editor / admin/new) use
      the same section order: Identity, Headshot, Bio, Resume
      builder, Resume PDFs, Disciplines, Mentorship, then casting /
      unions / ethnicity / links.

---

## v1.2 manual checks (done 2026-04-28)

### Callboard public surface

- [x] `/callboard` renders 7 seeded posts with proper page padding,
      filter strip, secondary toolbar (View / Sort / Verified-only,
      all left-aligned to mirror /directory), closing-this-week strip,
      list + card views.
- [x] Filter chips narrow by post type; verified-only toggle filters
      to posts with `verified_org_id`.
- [x] Detail pages at `/callboard/[id]` render with proper gutters
      desktop + mobile.
- [x] Submit form at `/callboard/submit` aligns at desktop (required
      `*` was wrapping below labels - fixed by removing
      `flex-direction: column` from `.label`). 2-up rows use
      `align-items: end` so inputs line up when one field has a
      label-hint and the other doesn't.

### Callboard moderation

- [x] Admin callboard page shows pending / approved / rejected lists.
      Approve sets status=approved, published=true, and inserts a
      productions row for audition / production types.
- [x] Verified-org posts auto-publish on email-verify token click;
      productions row inserted from the same code path.
- [x] Admin trash retention is 30 days (sweep happens in stale
      profile cleanup cron).

### Callboard subscriptions + weekly digest

- [x] Edit page (`/edit/[token]`) has a "Send me a weekly callboard
      digest" toggle. Toggling on creates / re-activates a row in
      `callboard_subscriptions` keyed on the profile's email and
      seeds disciplines from the profile.
- [x] Toggling off stamps `unsubscribed_at` without deleting the row.
- [x] `scripts/callboard-weekly-digest.mjs` runs locally, pulls
      matching new posts since last_digest_at, sends one email per
      subscriber with content, skips those with nothing new.
- [x] `/callboard/unsubscribe/[token]` honors the one-click
      unsubscribe link from digest emails.

### Resource library

- [x] `/resources` renders an empty state when nothing's curated.
- [x] `/admin/resources` exposes both Add-resource and Add-category
      forms, plus inline edit cards for existing entries.
- [x] Soft-delete on resource removal; ON DELETE SET NULL on
      categories so resources survive a category deletion as
      "Uncategorized".
- [x] "Resources" appears in the public Nav (between Callboard and
      About) and in the admin sidebar Site copy group.

### Homepage marquee

- [x] `/admin/marquee` toggle "Show marquee on the homepage" hides /
      shows the ticker entirely.
- [x] "Cycle through all open callboard posts" toggle. When off, a
      checkbox picker lists all approved + published posts.
- [x] Custom checkbox styling matches the rest of the site (16px,
      accent fill + white check).
- [x] Homepage marquee renders real callboard items as `<a>` links
      to `/callboard/[id]`. Production posts get the ★ glyph,
      everything else gets ✦.
- [x] Animation uses translate3d + GPU compositing + CSS-only :hover
      pause for smoother motion. `prefers-reduced-motion: reduce`
      halts the animation entirely.

### Admin sidebar polish

- [x] Tabs grouped: Review queue (top, where badges live), Directory,
      Homepage curation, Site copy, Config. Hairline rules between
      groups using `--rule` (visible) rather than `--rule-soft`.
- [x] Attention badges on Pending queue / Edit review / Reports /
      Callboard / Organizations driven by a single layout server
      load. Counts cap at "99+".
- [x] Mobile (horizontal wrap) suppresses the group separators.

### Cron smoke tests (2026-04-28)

- [x] `node scripts/admin-daily-digest.mjs` - sent the digest email
      because Pending queue had 1 item; subject and body rendered
      from the `admin_daily_digest` template.
- [x] `node scripts/email-volume-alert.mjs` - exited with "Below 70%
      threshold (sent=19/3000, 0%)". No alert sent.
- [x] `node scripts/stale-profile-cleanup.mjs` - 0 pinged / 0
      archived / 0 purged (no profiles old enough).
- [x] `node scripts/callboard-weekly-digest.mjs` - 0 subs, 0 sent,
      no errors.
- [x] `node scripts/backup-tables.mjs` - dumped 21 tables (251 rows)
      to JSON files.

---

## Launch-prep checks (done 2026-04-29)

### Bulk import

- [x] `scripts/bulk-import-profiles.mjs` ran end-to-end against
      `~/OneDrive/Desktop/Artists Directory/Submissions/`. 27 profiles
      created. 1 resume PDF uploaded to Cloudinary. All headshots
      uploaded.
- [x] Idempotent re-runs: dedup on email match, skip on slug collision
      without email. Verified by running twice.
- [x] DOCX -> PDF auto-conversion works on Windows (PowerShell + Word
      COM). McKenna Webb's `.docx` resume converted + uploaded.
- [x] Disciplines inferred from bio prose with alias table; meta
      override wins; CANONICAL_SKIP excludes false-positive-prone
      catch-alls ("Other", "Crew", etc.).
- [x] Default trust level set to false; `--trust-all` flag flips it
      for vetted batches.
- [x] `_results.csv` written with one row per folder, including
      magic-link edit URLs for mail-merge.

### URL normalisation

- [x] `lib/util/url.ts` `normalizeUrl()` prepends `https://` on bare
      domains. Verified via the bulk import (Harry Turpin's
      `harryturpin.com` is now stored as `https://harryturpin.com` and
      links out correctly from his profile).
- [x] Applied at save time in submit / edit / admin profile editor +
      bulk import script (mirror copy).
- [x] Defensively applied at render time on artist profile page so
      old rows don't break.

### Admin polish

- [x] `/admin/profiles` shows a 44px round headshot next to each row
      (initials placeholder when missing).
- [x] `/admin/disciplines` Save-name action renames a discipline with
      cascade across `profiles.disciplines`,
      `pending_submissions.disciplines`, and the mentorship arrays.
      Two cases verified: simple rename, and merge (when new name
      already exists).
- [x] Logged-in admins on `/artists/<slug>` see a dark bar above the
      profile with status pill + "Edit profile" link to
      `/admin/profiles/<id>/edit`. Hidden drafts viewable via the
      public URL when admin signed in (404 for non-admins).

### Word doc resume support

- [x] ResumesEditor accepts `.pdf`, `.doc`, `.docx`. File picker
      `accept` attribute updated; MIME validation handles all three
      types; modal warning copy generalised.
- [x] Public profile section heading reads "Resumes" instead of
      "Resume PDFs".

### Ko-fi widget

- [x] `/support-us` renders KofiWidget below the markdown content
      when `PUBLIC_KOFI_USERNAME` is set. Widget hides entirely when
      empty.
- [x] Verified on localhost: eyebrow + blurb + iframe + footer link
      all render correctly.
- [ ] **Not yet visible on staging deploy.** Likely an adapter-netlify
      env-var-baking quirk. Will resolve on next clear-cache deploy.

### Email pipeline live

- [x] Resend domain `southsoundtheatreartists.org` verified. SPF /
      DKIM / DMARC records all green.
- [x] Cloudflare Email Routing forwards `lexi@` + `hello@` to
      `southsoundtheatreartists@gmail.com`.
- [x] Gmail Send-As configured for both via Resend SMTP. Test reply
      from Gmail goes out as `hello@southsoundtheatreartists.org`
      with no "via gmail.com" suffix.
- [x] Contact form delivery confirmed: `status='sent'` from Resend,
      email lands in recipient's inbox, Reply-To threads correctly.
- [x] Display name in From header: "South Sound Theatre Artists"
      (was just "Hello" with the local-part fallback before).

### Netlify staging deploy

- [x] Site builds and deploys at
      `https://southsoundtheatreartists.netlify.app` from the public
      `ssta-admin/south-sound-theatre-artists` repo.
- [x] All 12+ env vars imported from local `.env`. `PUBLIC_SITE_URL`
      points at the netlify.app URL (will swap to .org at launch).
- [x] Build pipeline clean. Auto-deploys on push to `main`.

---

## What I didn't build

- **ADMIN_GUIDE.md** - deferred until closer to launch so Lexi can
  drive notes from real use.
- **Cloudflare Email Routing setup doc** - obsolete now that the
  routing is set up directly.
- **PDF parsing / column mapper** (was in v1.1 spec) - cut. Folded
  into the redaction tooling discussion (BUILD_PLAN "Maybe later").
- **PDF redaction tooling** - parked in BUILD_PLAN "Maybe later"
  with mockup notes.
- **Profile QR code** - skipped in favour of the Share button.

### Crons that ship but need secrets to actually run

- **Daily admin digest** - needs `SUPABASE_DB_URL`, `RESEND_API_KEY`,
  `RESEND_FROM_EMAIL`, `ADMIN_EMAIL`, `PUBLIC_SITE_URL` as GitHub
  Actions repo secrets.
- **Email volume alert** - same secrets minus `PUBLIC_SITE_URL`.
- **Stale profile cleanup** - same as daily digest.
- **Weekly callboard digest** - same as daily digest minus
  `ADMIN_EMAIL`.
- **Weekly backup** - needs `SUPABASE_DB_URL`, plus `BACKUP_REPO`
  ("owner/repo") + `BACKUP_REPO_TOKEN` (fine-grained PAT with
  contents:write on that separate private repo). The workflow no-ops
  cleanly when `BACKUP_REPO` / `BACKUP_REPO_TOKEN` are unset, so
  it's safe to leave merged before the target repo exists.
- **Supabase keepalive** - needs `SUPABASE_URL` +
  `SUPABASE_SERVICE_ROLE_KEY`.

### Polish layer (2026-04-29 evening) — to verify

Not yet manually run-through. Each item shipped via its own commit
today and needs a sweep before invitations go out. Tick as verified.

- [ ] **Submit form fields admin page** (`/admin/submit-form`): add
  a test area, rename it, confirm it cascades to a profile that uses
  it (spot-check `geographic_area` text), then remove. Repeat for
  unions and ethnicities. Verify "Other" rows are locked.
- [ ] **Auto-save sort number** on `/admin/submit-form` and
  `/admin/disciplines`: edit number, tab away, refresh, confirm new
  position stuck. Empty/unchanged values should NOT fire a request.
- [ ] **Save banner placement** on `/admin/profiles/[id]/edit`:
  scroll to bottom, click Save, confirm "Saved." appears next to the
  button (not 2000px up in the header).
- [ ] **Mentorship dots** on `/directory` cards: a profile with
  `mentorship_offering` populated shows a rust dot top-right; hover
  reveals a styled tooltip listing the disciplines. Same for moss +
  `mentorship_seeking`. Side-by-side when both arrays populated.
- [ ] **Discipline display order**: on `/edit/[token]` (or admin
  edit), reorder via up/down arrows, save, confirm the card teaser
  on `/directory` matches the new order. "Shows on cards" badge
  appears only on the top two rows.
- [ ] **Complete-to-publish gate**: run
  `node scripts/gate-incomplete-profiles.mjs` (default mode),
  open an unpublished bulk-import profile's edit link, see the rust
  banner listing missing fields, fill them in, save, confirm the
  profile auto-publishes (visible in `/directory` after save).
  Banner mirrored on `/admin/profiles/[id]/edit`.
- [ ] **Headshot/photo required**: try saving `/submit` or
  `/edit/[token]` without a photo, confirm error.
- [ ] **Awaiting email verification panel** at `/admin`: insert a
  fake `pending_email` row (or wait for a natural one), see it
  listed below the main queue, click "Resend verification", confirm
  the email arrives + `email_log` has a new row.
- [ ] **Sort tiebreaker** on `/directory?sort=newest`: most recently
  approved profile appears first within today's date batch (not
  floating arbitrarily inside it).
- [ ] **Resume privacy banner** on `/edit/[token]` when an artist
  already has resumes uploaded: rust panel above the resume list,
  same redact-phone-and-email advice as the upload modal.
- [ ] **Mobile body weight**: open the site at 375px width, body
  copy should read substantial (not "delicate"). Inter Tight 500.

---

## Things spawning into background tasks / future sessions

(Add here if any come up.)
