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

## Things spawning into background tasks / future sessions

(Will fill in if any come up.)
