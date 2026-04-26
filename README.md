# South Sound Theatre Artists

A free community web platform for theatre artists in the South Sound region of Washington State (Tacoma, Olympia, Gig Harbor). A searchable directory of artists and a callboard for audition notices, production announcements, and crew/designer calls.

## Documentation

- **`PRODUCT_SPEC.md`** - full project scope: artist profiles, callboard, admin panel, filters, resume system, email infrastructure
- **`BUILD_PLAN.md`** - phased implementation plan (v1 directory, v1.1 resumes, v1.2 callboard, v1.3 discovery features), architecture decisions, launch checklist
- **`CLAUDE.md`** - project conventions for Claude Code sessions

## Tech Stack

- **SvelteKit** (Svelte 5 runes) + `adapter-netlify`
- **Supabase Free** - database + auth (custom magic links)
- **Cloudinary Free** - headshot and PDF storage
- **Resend Free** - transactional email
- **Cloudflare Email Routing** - admin custom-domain forwarding
- **GitHub Actions** - cron jobs (keepalive, daily digest, weekly backup, volume alerts)

Hard constraint: zero ongoing cost. All services on free tiers.

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

Pre-implementation. Service accounts and infrastructure are set up. Code work begins with v1 per `BUILD_PLAN.md`.
