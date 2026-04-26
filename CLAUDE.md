# Claude Code Instructions for South Sound Theatre Artists

## Project Overview

A free community web platform for South Sound (Tacoma/Olympia/Gig Harbor) theatre artists. Two main surfaces: a searchable artist directory and a callboard for audition notices and production announcements. Maintained by a single non-technical admin (Lexi).

### Key docs (read on demand, not auto-loaded)
- **`PRODUCT_SPEC.md`** - full scope: artists, callboard, admin panel, filters, resume system, email infrastructure
- **`BUILD_PLAN.md`** - phased implementation plan (v1 directory, v1.1 resumes, v1.2 callboard, v1.3 discovery features), architecture decisions, launch checklist

## Local Development

```bash
pnpm dev                # dev server at http://localhost:5173
pnpm check              # typecheck - must be 0 errors before committing
```

## Tech Stack

- **SvelteKit** + `adapter-netlify`
- **Supabase Free** - auth (custom magic links + admin password+2FA), profiles, callboard, content
- **Cloudinary Free** - headshot + PDF storage
- **Resend Free** - transactional email (magic links, contact routing, weekly digests)
- **Cloudflare Email Routing** - admin custom-domain email forwarding to Gmail
- **Ko-fi embed** - donations
- **GitHub Actions** - keepalive cron, daily admin digest, weekly backups
- **UptimeRobot Free** - public URL monitoring

## Key Conventions

**Svelte 5 runes only.** `$state()`, `$derived()`, `$effect()`, `$props()`. No stores.

**No em dashes.** Use `-` instead - in code, copy, and chat. (User dislikes em dashes.)

**No traditional accounts.** Browse and submit are public. Editing is via single-use magic link to email. Admin uses password + magic-link 2FA + 30-day session cookie. There are no usernames, no passwords for artists, no account recovery flows.

**No `window.confirm()`, `alert()`, or `prompt()`.** Use themed modals matching the site's styling.

**Mobile-first.** Theatre people are on their phones constantly. Default to mobile layouts and progressively enhance.

**Markdown + toolbar for admin content editing.** Site copy and email templates are markdown stored in DB tables. Admin sees a toolbar (Bold / Italic / Link / List / Image) above a textarea with live preview alongside. Image button uploads to Cloudinary and inserts markdown syntax.

**No copy hardcoded in components.** Any user-visible string (other than UI labels like "Submit") pulls from `site_content` or its own table so Lexi can edit it without touching code.

**APIs accept arrays from day one.** Even single-item operations like approve/reject use `{ ids: [...] }` so batch actions can be added later without an API change.

**All emails go through one wrapper** that logs to `email_log` (with hashed recipient + type + sent_at) before calling Resend. Enables the 70% volume alert to Lexi.

**Soft-delete by default for admin actions.** Rejections and removals go to a 30-day trash before being permanently deleted.

## Auth Model

- **Browse**: zero auth, fully public
- **Submit profile / callboard post / report / contact form**: zero auth + email verification before queue
- **Edit own profile**: magic link to email, single-use, 24-hour expiry, invalidated on use
- **Admin (Lexi)**: password (env var) + magic-link 2FA code (6-digit) + 30-day session cookie. Password endpoint rate-limited to 5 attempts per IP per 15 minutes.

## Data Locations

- **Profiles, callboard, productions, content, blocklist, email log, reports**: Supabase
- **Headshots, PDF resumes**: Cloudinary
- **Backups**: weekly GitHub Actions JSON dump to a private GitHub repo

## Git Workflow

**Standing permission to commit local changes.** Commit at natural breakpoints with clear messages. Prefer new commits over amending.

**Never push without explicit permission.** Pushing triggers Netlify deploy.

## Cost Constraints

- **Zero ongoing cost** is a hard constraint per the spec. Any feature requiring paid services must be justified or rejected.
- Watch the free-tier ceilings: Resend 3000/mo, Supabase 500MB DB + 7-day pause, Cloudinary 25GB storage / 25GB bandwidth, Netlify 125k function invocations/mo.
- Supabase keepalive cron in GitHub Actions every 3 days is mandatory.

## Admin Handoff Plan

The repo is being built by Blake but operated by Lexi (non-technical). Plan for two handoffs:
- **To Lexi**: inline help in admin panel + `ADMIN_GUIDE.md` covering common tasks
- **To future devs**: README + ARCHITECTURE doc + this CLAUDE.md + `.env.example`

Service accounts (Netlify, Supabase, Cloudinary, Resend, domain registrar) start under Blake's email, get transferred or password-changed to Lexi at launch with 2FA moved to her phone.
