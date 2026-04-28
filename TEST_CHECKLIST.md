# Test Checklist

Build commit range: `580794a` → current `main`.

**Last full run-through: 2026-04-27.** All manual tests below pass except
the 5xx outage page (skipped — requires intentionally breaking
`SUPABASE_DB_URL`).

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

- [ ] **Resend domain verification** - until you verify a domain at
  `resend.com/domains` and switch `RESEND_FROM_EMAIL`, every send to a
  recipient other than `ssta.admin@gmail.com` fails with a 403. Blocked
  on domain access.
- [x] **Privacy + Terms** - polished draft now lives in `site_content`
  (last_updated date, contact email, cookies note, minors clause,
  governing law, change-notice). Lexi can fine-tune in /admin/content;
  no lawyer review chosen.
- [x] **`ADMIN_PASSWORD`** - rotated from the dev placeholder. Re-set in
  Netlify env vars at deploy time.
- [ ] **`SESSION_SECRET`** - real random value in dev. Rotate to a fresh
  one in Netlify production env.
- [ ] **Update `static/robots.txt`** to the production custom domain
  when you have one. Blocked on domain access.

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

## What I didn't build

- **Step 23-27 crons** except Supabase keepalive (which ships in
  `.github/workflows/keepalive.yml` and just needs `SUPABASE_URL` +
  `SUPABASE_SERVICE_ROLE_KEY` GitHub Actions secrets to start
  running). Daily admin digest, email volume alert, weekly backup,
  stale profile cleanup all still pending.
- **Step 28 ADMIN_GUIDE.md** - deferred until closer to launch so
  Lexi can drive notes from real use.
- **Step 29 Cloudflare Email Routing setup doc** - blocked on domain
  access.
- **PDF parsing / column mapper** (was in v1.1 spec) - cut. Folded
  into the redaction tooling discussion (BUILD_PLAN "Maybe later").
- **PDF redaction tooling** - parked in BUILD_PLAN "Maybe later"
  with mockup notes.
- **Profile QR code** - skipped in favour of the Share button.

---

## Things spawning into background tasks / future sessions

(Add here if any come up.)
