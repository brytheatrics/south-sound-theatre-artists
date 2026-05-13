# South Sound Theatre Artists

A free community web platform for theatre artists in the South Sound region of Washington State (Tacoma, Olympia, Gig Harbor). A searchable directory of artists and a callboard for audition notices, production announcements, and crew/designer calls.

## Documentation

- **`CLAUDE.md`** - project conventions + where-to-look index for Claude Code sessions
- **`TODO.md`** - master active-work list (launch-blocking, unpushed commits, parking lot, v1.1 build notes)
- **`ARCHITECTURE.md`** - schema, auth model, conventions, cron schedule, infrastructure
- **`HISTORY.md`** - what shipped, version-by-version (v1 → v1.5 launch) + the v2.x calendar audit
- **`PRODUCT_SPEC.md`** - original product vision (reference only)
- **`scripts/BULK_IMPORT_README.md`** - operational doc for the artist bulk-importer

## Tech Stack

- **SvelteKit** (Svelte 5 runes) + `adapter-netlify`
- **Supabase Free** - database + auth (custom magic links)
- **Cloudinary Free** - headshot and PDF storage
- **Resend Free** - transactional email
- **Cloudflare Email Routing** - admin custom-domain forwarding
- **GitHub Actions** - cron jobs (keepalive, daily digest, weekly backup, volume alerts)

**Production hosting:** Netlify (Blake's paid `brytheatrics` team as of v1.5 launch in May 2026). The original "zero ongoing cost" target was relaxed temporarily after Netlify's new credits-based pricing exhausted the free tier in 2 days of launch traffic. Migration to Cloudflare Pages is on the post-launch TODO. All other services (Supabase, Cloudinary, Resend) remain on free tiers.

## Local Development

Requires Node 20+ and pnpm 10+.

```bash
pnpm install        # first-time setup
pnpm dev            # dev server at http://localhost:5173
pnpm check          # typecheck (must be 0 errors before committing)
pnpm lint           # prettier + eslint check
pnpm format         # auto-fix formatting
```

## Environment Variables

Copy `.env.example` to `.env` and fill in values from the password manager. The `.env` file is gitignored.

```bash
cp .env.example .env
```

## Project Structure

```
src/
  routes/         # SvelteKit pages and API endpoints
  lib/            # shared utilities, components, server code
static/           # public assets served as-is
.svelte-kit/      # generated, gitignored
```

## Deployment

Deploys to Netlify on push to `main` (when configured). Free-tier limits apply: 300 build minutes / month. Push only when changes are ready - each push consumes build budget.

## Project Status

Pre-launch. v1 (directory), v1.1 (resumes + mentorship), v1.2 (callboard + verified orgs + auto-pulled calendar), and v1.3 (multi-resume + production credits + multi-admin + blog + per-artist OG cards) are all shipped to staging at `https://southsoundtheatreartists.netlify.app`. Custom domain DNS flip + final smoke test are launch-blocking — see `TODO.md` Section 1.
