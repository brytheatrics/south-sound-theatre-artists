# Test Checklist

Running list of things to test, review, or decide that came out of the
autonomous build session. Newest entries on top within each section.

---

## Decisions you should make before launch

- [ ] **Resend domain verification**: until you verify a domain at
  `resend.com/domains` and switch `RESEND_FROM_EMAIL`, every send to a
  recipient other than `ssta.admin@gmail.com` fails with a 403. Real
  artists' verification emails will not arrive. Same for admin 2FA codes
  if you change `ADMIN_EMAIL` away from the verified address.
- [ ] **Privacy + Terms** still use draft placeholder text. Banner on each
  page makes that clear. Need lawyer or template-service review before
  public launch.
- [ ] **`ADMIN_PASSWORD`** is currently set to `ssta-admin-2026-change-me`
  for dev. Change to a strong password (in `.env` and in Netlify env vars)
  before launch.
- [ ] **`SESSION_SECRET`** was generated for dev. Rotate to a fresh random
  value in production.

---

## Manual tests

### Admin auth (step 7)

- [ ] Visit `/admin` while signed out - should redirect to `/admin/login`.
- [ ] Submit the wrong password 5 times - 6th attempt should be rate-limited.
- [ ] Submit the right password (`ssta-admin-2026-change-me`) - should
  send a 6-digit code to `ssta.admin@gmail.com` and forward to
  `/admin/verify`. Check the inbox for the email.
- [ ] Enter the code on `/admin/verify` - should land on `/admin` with
  the sidebar visible.
- [ ] Click "Sign out" - cookie clears, `/admin` should redirect back to
  login.
- [ ] Re-enter the same code - should reject as already-used.
- [ ] Wait 10+ min and try the code - should reject as expired.

---

## Known shortcuts to clean up later

- **`window.confirm()` in admin actions**: the project rule is "no
  native browser dialogs." For speed, the destructive actions on
  `/admin/profiles` and `/admin/profiles/trash` use `confirm()`.
  Should swap for the themed `ConfirmModal` pattern eventually.
- **No admin-side profile editor** in step 12. Lexi can use the artist
  edit-link flow (request a link to her own admin email if she needs to
  test) or the Supabase Table Editor for direct field changes. A proper
  /admin/profiles/[id]/edit page is a follow-up.
- **No flagged_edits split** in the magic-link edit flow. Per the spec
  major changes (headshot, disciplines) should queue in `flagged_edits`
  for admin re-approval; v1 step 9 applies all edits directly.
