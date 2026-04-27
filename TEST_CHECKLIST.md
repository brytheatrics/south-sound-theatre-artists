# Test Checklist

Things to test, review, or decide that came out of the autonomous build
session (steps 7-22 of BUILD_PLAN). Build commit range: `580794a` →
`47cb1e0`.

Quick map of what shipped:

| Step | What | Where |
|---|---|---|
| 7 | Admin auth (password + 2FA + 30-day session) | `/admin/login`, `/admin/verify`, `hooks.server.ts`, `lib/server/admin-auth.ts` |
| 8 | Admin pending queue (approve / reject) | `/admin` |
| 9 | Magic-link edit flow | `/edit-link`, `/edit/[token]`, `/edit/done` |
| 10 | Public directory (filters + search) | `/directory` |
| 11 | Profile page + contact form | `/artists/[slug]` |
| 12 | Admin profile mgmt + soft-delete trash | `/admin/profiles`, `/admin/profiles/trash` |
| 13 | Report a profile + admin reports queue | `/report`, `/admin/reports` |
| 14 | Email blocklist | `/admin/blocklist` |
| 15 | Editable site_content (markdown + preview) | `/admin/content` |
| 16 | Editable email_templates | `/admin/templates` |
| 17 | Editable disciplines | `/admin/disciplines` |
| 18 | Featured profiles (admin curation) | `/admin/featured` + homepage rotation |
| 19 | Announcement banner (date-windowed) | `/admin/banner` + site-wide layout |
| 21 | Sitemap.xml + robots.txt | `/sitemap.xml`, `static/robots.txt` |
| 22 | Graceful outage / error boundary | `+error.svelte` |

---

## Decisions you should make before launch

- [ ] **Resend domain verification** - until you verify a domain at
  `resend.com/domains` and switch `RESEND_FROM_EMAIL`, every send to a
  recipient other than `ssta.admin@gmail.com` fails with a 403. That
  means: artist verification emails, welcome emails on approve,
  rejection emails, contact-form messages, and admin 2FA codes (if you
  change `ADMIN_EMAIL`) all silently fail in production.
- [ ] **Privacy + Terms** still use draft placeholder text. Lawyer or
  template-service review needed before public launch.
- [ ] **`ADMIN_PASSWORD`** is currently `ssta-admin-2026-change-me` for
  dev. Change in `.env` and in Netlify env vars before launch.
- [ ] **`SESSION_SECRET`** generated for dev. Rotate to a fresh random
  value in production.
- [ ] **Update `static/robots.txt`** to point at the production custom
  domain when you have one (currently points at the Netlify preview
  URL).

---

## Manual tests

### Admin auth (step 7)

- [ ] `/admin` while signed out → redirects to `/admin/login`.
- [ ] Wrong password 5 times → 6th attempt blocked with "too many"
      message.
- [ ] Correct password (`ssta-admin-2026-change-me`) → 2FA email lands
      at `ssta.admin@gmail.com`. Enter the 6-digit code on `/admin/verify`
      → land on `/admin`.
- [ ] Sign out → cookie clears, `/admin` redirects to login again.
- [ ] Re-enter the same code after signing in → "already used".
- [ ] Wait 10+ min and try a stale code → "expired".

### Admin pending queue (step 8)

- [ ] Submit a real profile via `/submit` (with `ssta.admin@gmail.com`
      as the email so the verification arrives), click the verification
      link.
- [ ] Open `/admin` - submission shows in the queue.
- [ ] Click to expand - all fields visible, headshot thumbnail clickable.
- [ ] **Approve** → row vanishes from queue, profile appears at
      `/artists/<slug>`, welcome email lands at the submitter address.
- [ ] **Reject** with a reason → row vanishes, rejection email lands.

### Magic-link edit (step 9)

- [ ] After approve above, the welcome email contains an edit link.
- [ ] Click the edit link → editor pre-filled with profile data.
- [ ] Make a change → save → /edit/done page. Profile reflects the change
      at `/artists/<slug>`.
- [ ] Re-click the same link → it's now invalid (single-use).
- [ ] Visit `/edit-link`, enter the email → fresh link arrives.

### Public directory (step 10)

- [ ] `/directory` shows all 8 placeholder profiles + any approved.
- [ ] Click a discipline chip → grid filters live, URL updates.
- [ ] Set the area + union multi-selects, language, and a playable-age
      window → grid filters.
- [ ] Search a name → grid narrows.
- [ ] "Clear (N)" wipes filters.
- [ ] Try empty result by searching a string with no matches → shows the
      "It's quiet here · for now" empty state.

### Profile + contact (step 11)

- [ ] Open `/artists/maren-hollis` (or any seeded slug).
- [ ] Headshot + name + chips + Contact button render correctly.
- [ ] Click Contact → inline form scrolls into view. Fill it out and
      submit → "Message sent" state. Email lands at the artist's address
      (only ssta.admin@gmail.com works in dev sandbox).
- [ ] Try a malformed email → inline error.
- [ ] Add `your.email@blocked.example` to the blocklist via
      `/admin/blocklist`, submit the contact form with that address →
      success message but no email arrives (silent block).

### Admin profile mgmt + trash (step 12)

- [ ] `/admin/profiles` lists all profiles, search by name works.
- [ ] Click "Live"/"Hidden" pill → toggles published flag.
- [ ] Click "Trash" → confirms (native dialog), profile moves out of
      list.
- [ ] `/admin/profiles/trash` shows the soft-deleted profile.
- [ ] "Restore" → profile reappears in main list (still hidden).
- [ ] "Delete forever" → permanently gone.

### Reports (step 13)

- [ ] On a profile page, click "Report this profile" sidebar link.
- [ ] Submit a report with reason (10+ chars) → /report/done page.
- [ ] `/admin/reports` shows the new report under "Open".
- [ ] "Resolve" or "Dismiss" → tab counts update.

### Blocklist (step 14)

- [ ] `/admin/blocklist` add an email → appears in list.
- [ ] Try adding the same email again → "Already blocked" error.
- [ ] Remove → vanishes from list.

### Site content + templates + disciplines (steps 15-17)

- [ ] `/admin/content` tab through slugs. Edit body, click Save → preview
      updates, public page (e.g. `/about`) reflects changes after refresh.
- [ ] `/admin/templates` edit a template body. Variables in
      {{double_braces}} should NOT be escaped - they get filled in by
      the email send wrapper.
- [ ] `/admin/disciplines` add a new discipline (pick category) → it
      appears in the right category group on submission form's picker.
- [ ] Reorder by changing a sort_order → save → new order respected.
- [ ] Remove a discipline → confirms, gone.

### Featured + banner (steps 18-19)

- [ ] `/admin/featured` add a profile. Homepage spotlight rotates only
      through the featured set.
- [ ] Pause one (toggle to "Paused") → drops out of rotation.
- [ ] Remove all featured → homepage falls back to date-seeded random
      from all profiles.
- [ ] `/admin/banner` add a banner with body, enabled, no date window.
      → Refresh the homepage - banner shows above the nav.
- [ ] Set ends_at to 1 minute from now, wait → banner disappears on
      refresh.
- [ ] Disable enabled toggle → banner gone immediately on refresh.

### Sitemap + error page (steps 21-22)

- [ ] `/sitemap.xml` returns XML with all public paths + every published
      profile.
- [ ] `/robots.txt` allows crawling `/`, blocks `/admin`, `/edit`,
      `/verify`, `/report`.
- [ ] Visit a non-existent URL like `/asdf` → friendly 404 page.
- [ ] (Hard) Knock the DB connection over and visit any page → "back
      soon" 5xx page renders instead of a stack trace. (Best tested by
      temporarily breaking SUPABASE_DB_URL in `.env`.)

---

## Known shortcuts to clean up later

- **`window.confirm()` in admin actions** (`/admin/profiles`,
  `/admin/profiles/trash`, `/admin/disciplines`). Project rule says no
  native browser dialogs. Should swap for the themed `ConfirmModal`
  pattern.
- **No admin-side profile editor.** Lexi can use the user edit-link
  flow (request a link to her own admin email if she needs to test) or
  the Supabase Table Editor. A proper /admin/profiles/[id]/edit page is
  a follow-up.
- **No flagged_edits split** in the magic-link edit flow. Per the spec
  major changes (headshot, disciplines) should queue in `flagged_edits`
  for admin re-approval; v1 step 9 applies all edits directly.
- **Directory pagination**: capped at 48 results. Add cursor pagination
  when the directory grows past that.
- **Mobile admin sidebar** wraps but isn't a hamburger - works but not
  ideal on phones.
- **Markdown preview in /admin/content** is a tiny in-house parser
  (headings, paragraphs, **bold**, *italic*, lists, links). Not a full
  CommonMark renderer. Good enough for the editable copy.

---

## What I didn't build

- **Step 23-27 crons**: daily admin digest, email volume alert, Supabase
  keepalive, weekly backup, stale profile cleanup. All are GitHub
  Actions cron jobs that need a workflow file + secrets. Defer to a
  cron-setup session.
- **Step 28 ADMIN_GUIDE.md**: separate doc-writing session.
- **Step 29 Cloudflare Email Routing setup doc**: separate doc-writing
  session.
- **Profile QR code, on-site resume builder, callboard**: v1.1 / v1.2
  per BUILD_PLAN.

---

## Things spawning into background tasks / future sessions

(Add here if any come up.)
