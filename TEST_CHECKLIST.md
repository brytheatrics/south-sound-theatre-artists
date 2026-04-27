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

- **No admin-side profile editor** for existing profiles. Lexi can
  click "Send edit link" on /admin/profiles to email the artist a
  fresh magic link, or use the Supabase Table Editor.
  /admin/profiles/new exists for *creating* starter profiles on behalf
  of artists with whatever info Lexi has on file.
- **No `flagged_edits` split** in the magic-link edit flow. Per the
  spec, major changes (headshot, disciplines) should queue in
  `flagged_edits` for admin re-approval; v1 step 9 applies all edits
  directly.
- **Directory pagination**: capped at 48 results. Add cursor
  pagination when the directory grows past that.
- **Mobile admin sidebar** wraps but isn't a hamburger - works but
  not ideal on phones.
- **Markdown preview in /admin/content** is a tiny in-house parser
  (headings, paragraphs, **bold**, *italic*, lists, links). Not full
  CommonMark. Good enough for the editable copy.

---

## What I didn't build

- **Step 23-27 crons**: daily admin digest, email volume alert,
  Supabase keepalive, weekly backup, stale profile cleanup. All are
  GitHub Actions cron jobs that need a workflow file + secrets.
  Defer to a cron-setup session.
- **Step 28 ADMIN_GUIDE.md**: separate doc-writing session.
- **Step 29 Cloudflare Email Routing setup doc**: separate
  doc-writing session.
- **Profile QR code, on-site resume builder, callboard**: v1.1 / v1.2
  per BUILD_PLAN.

---

## Things spawning into background tasks / future sessions

(Add here if any come up.)
