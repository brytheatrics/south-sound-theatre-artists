# Claude Code Instructions for South Sound Theatre Artists

A free community web platform for South Sound (Tacoma / Olympia / Gig Harbor) theatre artists. Surfaces: artist directory, callboard for audition notices, calendar of productions with cast / production-team tagging, public theatre directory, native blog, mentorship discovery. Maintained by Lexi (non-technical) with optional co-admins (multi-admin live since mig 080).

---

## Where to look

| Doc | Purpose |
|---|---|
| [README.md](README.md) | Project overview + dev commands |
| [TODO.md](TODO.md) | **Master todo list.** Launch-blocking work, unpushed commits, "needs your eyes," verification sweeps, parking lot |
| [ARCHITECTURE.md](ARCHITECTURE.md) | Schema, auth, conventions, cron schedule, infrastructure |
| [HISTORY.md](HISTORY.md) | What shipped, version-by-version (v1 → today) + the v2.x calendar audit |
| [PRODUCT_SPEC.md](PRODUCT_SPEC.md) | Original product vision (reference only) |
| [scripts/BULK_IMPORT_README.md](scripts/BULK_IMPORT_README.md) | Operational doc for the artist bulk-importer |

When you start a session, glance at TODO.md to see what's queued; read the relevant section of ARCHITECTURE.md before assuming a convention.

---

## Local development

```bash
pnpm dev                    # dev server at http://localhost:5173
pnpm check                  # typecheck - must be 0 errors before committing
pnpm db:migrate             # apply pending SQL files in supabase/migrations/
pnpm db:migrate --status    # show applied vs pending without changes
```

Migrations run against `SUPABASE_DB_URL` from `.env`. Each file runs in its own transaction; reruns are idempotent (filenames tracked in a `_migrations` table). Use `on conflict do nothing` for seed inserts so re-running is safe.

---

## Must-know conventions

Quick reminders. The full set lives in [ARCHITECTURE.md](ARCHITECTURE.md#conventions).

- **Svelte 5 runes only.** `$state()`, `$derived()`, `$effect()`, `$props()`. No stores.
- **No em dashes.** Use `-` instead in code, copy, and chat.
- **No `window.confirm()`, `alert()`, or `prompt()`.** Use the themed `ConfirmModal`.
- **Mobile-first.** Default to mobile layouts and progressively enhance.
- **No copy hardcoded in components.** Pull from `site_content` or its own table so Lexi can edit without touching code.
- **APIs accept arrays from day one.** `{ ids: [...] }` even when called with one ID.
- **All emails go through one wrapper** that logs to `email_log` before calling Resend.
- **Soft-delete by default for admin actions.** 30-day trash before hard-delete.
- **No traditional accounts.** Browse + submit are public. Edit via single-use magic link. Org-rep credit-tagging via admin-issued 60-day org-edit link. Admin uses email + password + 2FA + session cookie (multi-admin: each admin has their own row in `admin_users`; ADMIN_EMAIL/ADMIN_PASSWORD env vars are the bootstrap path on a freshly-empty table).
- **Markdown + toolbar for admin content editing.** Live preview pane. Image button uploads to Cloudinary.

---

## Git workflow

**Standing permission granted to commit local changes without asking.** Commit at natural breakpoints (feature complete, typecheck passing, before task switch) with clear messages matching the existing repo style. Prefer new commits over amending. Mention what was committed in the response summary so Blake can review in `git log`.

**Never push without explicit permission.** Pushing triggers a Netlify build + deploy on the free tier (300 build minutes / month). Always ask "want me to push these commits?" and wait for approval before `git push`. This is a hard rule - do not override it even if Blake has approved a push earlier in the same session. Each push needs its own approval.

**Never deploy manually** (Netlify CLI, deploy hooks, etc.) without explicit permission. Same rationale.

---

## Cost constraints

Zero ongoing cost is a hard constraint. Free-tier ceilings: Resend 3000/mo, Supabase 500MB DB + 7-day pause, Cloudinary 25GB storage / 25GB bandwidth, Netlify 125k function invocations/mo + 300 build minutes/mo. The Supabase keepalive cron in GitHub Actions runs every 3 days and is mandatory.

---

## Admin handoff plan

The repo is being built by Blake but operated by Lexi (non-technical). Plan for two handoffs:

- **To Lexi**: inline help in admin panel + `ADMIN_GUIDE.md` covering common tasks (deferred - see TODO.md).
- **To future devs**: README + ARCHITECTURE + this CLAUDE.md + `.env.example`.

Service accounts (Netlify, Supabase, Cloudinary, Resend, domain registrar) start under Blake's email; transferred to Lexi at launch with 2FA on her phone.
