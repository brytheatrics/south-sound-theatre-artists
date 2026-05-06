# History

What's shipped, version by version. For active work see [TODO.md](TODO.md); for stable references see [ARCHITECTURE.md](ARCHITECTURE.md).

---

## v1 — Directory only (shipped)

The minimum viable site: artists submit, get approved, edit, get contacted.

- Public artist submission form with email verification before queue
- Admin pending queue with daily digest at 8am if non-empty
- Admin profile management (search, edit, unpublish, soft-delete with 30-day recovery)
- Magic-link edit flow with resend; tokens single-use, 24h expiry, invalidated on use
- Public directory with filters (discipline, availability, experience level, union, area, age range, languages)
- Profile pages with contact form (Resend-routed, real email never exposed)
- Email blocklist in admin panel
- Report button on profiles → admin queue
- Featured profile rotation on homepage (date-bucketed seed, not pure random)
- Editable homepage / about / support us / contact / footer copy via admin (markdown + toolbar)
- Editable email templates via admin (markdown)
- Announcement banner (optional, with date range)
- Editable disciplines list
- Email-deliverability bundle: SPF, DKIM, DMARC, verified test sends
- Sitemap.xml + per-page robots meta (public pages indexed; admin / edit / queue noindex)
- Graceful Supabase outage page (catch DB connection failure, render "back soon" template)
- "Member since" date on profiles
- Privacy + Terms pages (editable from `/admin/content`)
- Profile delete flow (artist-initiated from edit page)
- Headshot rights consent checkbox on upload
- About / Contact / Support Us pages
- Trust system (Phase A + B): see ARCHITECTURE.md
- Themed `ConfirmModal` replaces all `window.confirm()` calls

### v1 cron jobs (5 of 5 shipped)

Supabase keepalive, daily admin digest, email volume alert at 70% / 90%, weekly callboard digest, weekly Supabase JSON backup, stale profile cleanup (18-month "still active?" ping plus 30-day soft-delete trash sweep). All as GitHub Actions.

---

## v1.1 — Resume features + Mentorship (shipped)

- ✅ **Structured resume builder.** `resume_data` jsonb on profiles. Three sections (credits / training / skills), each a typed list with Up / Down / Remove. Generic across disciplines. Renders inline on the public profile.
- ✅ **PDF resume upload (multiple per profile).** `resumes` jsonb array of `{label, url}`. Cloudinary raw uploads. Pre-upload `ConfirmModal` warns about contact-info on public-directory PDFs.
- ❌ **PDF parsing / column mapper.** Cut. Folded into the redaction tooling discussion (see TODO.md parking lot) — the structured builder sidesteps the use case.
- ✅ **Mentorship opt-in.** `mentorship_offering` + `mentorship_seeking` text-array columns. Surfaced in profile sidebar and as filter chips on the directory; the discipline picker doubles as a lens.
- ❌ **Profile QR code.** Skipped. Replaced with a Share button (`navigator.share` on mobile, clipboard fallback on desktop).
- ✅ **Analytics: GoatCounter.** Drop-in script gated on `PUBLIC_GOATCOUNTER_CODE`. Public routes only.

### v1.1 polish (mostly shipped via mig 017–044)

- Areas refactor: regions with anchor cities + descriptions for hover tooltips
- Disciplines bulk-add (~140 across 13 categories) + category management UI
- Sort + filter polish: Newest / Recently updated / Last name A-Z; strict age filter with exclusion note; "Has headshot" chip
- Directory pagination at PAGE_SIZE=24
- Material Symbols person icon for missing-headshot placeholder
- Sidebar disciplines / unions / ethnicities / languages render as chips
- City field (display refinement; directory area filter still keys on `geographic_area`)
- Mobile admin polish; profile-mgmt table → card collapse under 720px

---

## v1.2 — Callboard + Notification opt-ins + Productions data (shipped)

- ✅ Callboard public page (filterable by post type, list + card views)
- ✅ Public callboard submission form (with email verification for unverified posters)
- ✅ Admin callboard moderation (approve / reject / soft-delete with trash)
- ✅ Verified theatre organization application + approval flow
- ✅ Verified-org callboard posts go live immediately without per-post approval
- ✅ Auto-unpublish posts after audition / closing date (lazy on page load)
- ✅ Opt-in weekly digest with per-row unsubscribe token + edit-page toggle + Sunday-evening cron
- ✅ `productions` table populated from approved audition / production posts at both approve paths
- ✅ Resource library (`/resources`, `/admin/resources`, categories + soft-delete + sort_order)
- ✅ Homepage marquee fed by callboard + calendar productions
- ✅ Admin sidebar reorder + visual grouping + attention badges

---

## Launch-prep work (2026-04-29 sessions)

- **Bulk import.** `scripts/bulk-import-profiles.mjs` — folder-based importer for the artists who emailed bios + headshots in before the site existed. 27 profiles + 1 resume PDF imported, magic-link edit URLs parked in `_results.csv`. See [scripts/BULK_IMPORT_README.md](scripts/BULK_IMPORT_README.md).
- **URL normalisation** at save and render time (`lib/util/url.ts`).
- **Admin profile thumbnails.** 44px round headshot next to each row on `/admin/profiles`.
- **Discipline rename + cascade** at `/admin/disciplines` (handles both clean rename and merge cases).
- **Admin Edit shortcut** on profile pages — logged-in admins see a thin bar with status pill + edit link.
- **Word doc resume support.** ResumesEditor accepts `.docx` and `.doc`; bulk import auto-converts via PowerShell + Word COM on Windows.
- **Ko-fi widget** on `/support-us`.
- **Email pipeline LIVE.** Domain `southsoundtheatreartists.org` registered at Squarespace, DNS at Cloudflare. Resend domain-verified. Email Routing forwarding `lexi@` + `hello@` to Gmail. Send-As via Resend SMTP.
- **Netlify staging deploy LIVE** at `https://southsoundtheatreartists.netlify.app`.

### Polish layer (2026-04-29 evening)

- `/admin/submit-form` reference-data hub (areas / unions / ethnicities) with cascade-rename.
- Auto-save sort number on blur.
- Mentorship dots on directory headshots (moss + rust, custom tooltip).
- Discipline display order with "SHOWS ON CARDS" badge on the top two.
- Complete-to-publish gate for bulk-imported profiles.
- Required headshot/photo + relabel from "Headshot."
- Awaiting email verification panel on `/admin`.
- Sort tiebreaker (`member_since DESC, created_at DESC`).
- Profile edit save banner placement (next to button, not just header).
- Resume privacy reminder banner above resume list.
- Body weight bump (Inter Tight 500).

---

## Post-launch-prep sessions (2026-04-30 → 2026-05-06)

Mostly listed as commits in [TODO.md](TODO.md) "Unpushed commits." Highlights:

- Theme: drop Auto mode (32037b5)
- Resources: multi-category tagging (36c0d95 + 5dab51c + 200b172, parked cleanup mig 070)
- Mentorship: dedicated `/mentorship` discovery page (22b832f) + accordion filter (a0ae07f)
- Homepage: playbill redesign + three-door nav + spotlight rework (362287e)
- Calendar org consolidation (mig 065) → single `organizations` table
- Trust-this-device admin login (mig 066)
- Marquee: calendar items deep-link with `?highlight=` and pulse
- Email: HTML pipeline with signature substitution (migs 067 + 068)
- Weekly community digest: double-opt-in + calendar slice (mig 069)
- Weekly digest: per-dimension filters + manage page (migs 071 + 072)
- Email: audience-based pause via `EMAIL_PAUSE_COMMUNITY` (mig 073)
- Calendar grid pills: bump font sizes + add caps tracking
- Brand sweep: V3 logo (Lexi's masks + wordmark) shipped, then color palette reverted to moss / terracotta / dark-blue (kept the V3 logos)
- Favicon tinted moss
- "Other" area is a self-sufficient pick (mig 074); empty area no longer defaults to "Other" on edit forms
- 3 more bulk-imported profiles (Hester Elwell, JoJo Flores, Thomas Morisada) — currently hidden drafts

---

## v2.x audit (2026-05-02) — ready for Phase 0 dry-run

**Goal:** the site shows what's playing across South Sound theatre even when companies don't manually post to the callboard.

### Approach (in order of preference, never raw HTML scraping as a default)
1. JSON-LD `Event` schema in the org's site source.
2. iCal / Google Calendar feeds.
3. Ticketing platform APIs / feeds (Tessitura, AudienceView, OvationTix, Eventbrite).
4. AI extraction from a stable season-list URL (Claude Haiku 4.5).
5. Custom HTML scrapers — last resort.
6. Admin review queue — every scraped event lands as a draft; Lexi approves before it goes live.

### Audit findings (26 orgs)
- **No org exposes JSON-LD Event schema usably.**
- **One org exposes a clean structured feed**: Bainbridge Performing Arts via Squarespace's `/events?format=json`.
- **Six orgs share Arts People / OvationTix ticketing** — one platform adapter covers them all.
- **Eleven orgs render a clean season list as plain HTML text** at a stable URL — ideal for AI extraction.
- **One org exposes Eventbrite per-show JSON-LD** (Dukesbay).
- **One org has a likely Next.js JSON endpoint** (Renton Civic).
- **Three orgs need extra work**: New Muses (no season index), OLT (titles on index, dates on per-show subpages — two-step crawl), OFT (bot-blocks WebFetch — needs UA spoof or headless).
- **Four orgs are walls**: Toy Boat, NW Center Theatre, Screaming Butterflies, String & Shadow.

### Architecture decisions (settled 2026-05-02)
- **Vendor:** Anthropic API (Claude Haiku 4.5). $5 of free signup credits cover ~5 years; thereafter ~$1-2/year. Hard monthly spend cap set as belt-and-suspenders.
- **Cadence:** monthly cron is plenty. Per-source `cadence_days` override.
- **Cost-saving cache:** SHA-256 hash of cleaned HTML; skip the AI call when content hasn't changed.
- **Manual refresh button** in admin per source. 1-hour cooldown.
- **Review queue non-negotiable.** After 2-3 months of consistent quality per org, individual orgs could be opted into auto-publish (mirrors `profiles.trusted`).
- **Stale-source detection:** `last_successful_at` + `last_show_count`; email Lexi after 2 weeks empty with a "this URL probably needs updating" alert that suggests the next likely slug.

### Schema direction
Multi-tag, not exclusive categories. Each org carries an array of tags so it can belong to multiple buckets simultaneously. Default-on tags: `producing`, `venue`, `youth`. Default-off: `opera`, `symphony`, `college`, `high-school`.

### Org list (26 orgs, post-audit)

| Region | Org | Adapter | Source |
|---|---|---|---|
| Tacoma | Tacoma Little Theatre | ai-generic | `/blog/tag/2025-2026` |
| Tacoma | Lakewood Playhouse | ai-generic | `/season-87.html` |
| Tacoma | Tacoma Musical Playhouse | ai-generic | `/season-and-show-tickets` |
| Tacoma | Dukesbay Productions | eventbrite | Eventbrite organizer |
| Tacoma | New Muses | manual | no season index |
| Tacoma | Toy Boat | manual | login-walled |
| Tacoma | Screaming Butterflies | manual | month-precision only |
| Tacoma | Mustard Seed | ai-generic | `mustardseedtheater.csstix.com` |
| South Pierce | ManeStage | ai-generic | `/current-season` |
| South Pierce | NW Center Theatre | manual | placeholder site |
| Olympia | Harlequin | ai-generic | `/season-{year}/` |
| Olympia | Olympia Little Theatre | ai-generic-crawl | `/shows/` index → subpages |
| Olympia | Olympia Family Theater | ai-generic w/ UA | `/announcing-our-{yy}-{yy}-season/` |
| Olympia | Theater Artists Olympia | ai-generic | `/calendar` |
| Olympia | String & Shadow | manual | touring |
| Olympia | Animal Fire | ai-generic | homepage |
| Olympia | Evergreen | ai-generic | `/season66` |
| South King | Centerstage | ovationtix | account 36978 |
| South King | Renton Civic | nextjs-probe | `_next/data/{buildId}/...json` |
| South King | Burien Actors Theatre | ai-generic | `/this-season/` |
| South King | Theatre Battery | ai-generic | homepage |
| South King | Emerald | ai-generic | `/current-production` |
| South King | Auburn Community Players | arts-people | org code on city page |
| Gig Harbor | Jewel Box | arts-people | org code |
| Gig Harbor | Bainbridge Performing Arts | squarespace-json | `/events?format=json` |
| Gig Harbor | Bremerton Community Theatre | arts-people | org code `brmct` |

### Implementation phases
- **Phase 0** — Extraction dry-run (no DB changes). Standalone Node script hits the 11 ai-generic orgs once, prints JSON to stdout. Validates Haiku output on real-world theatre HTML. ~$0.10 to run.
- **Phase 1** — Schema + monthly cron. New `event_sources` table, generic AI adapter, HTML hash caching. Writes to `productions` with `status='pending_review'`.
- **Phase 2** — Admin review queue at `/admin/calendar-sync`.
- **Phase 3** — Public calendar view (grid + list).
- **Phase 4** — Source management UI + manual refresh button + stale-detection email.
- **Phase 5** — Platform adapters (Arts People, Eventbrite, Squarespace JSON).
- **Phase 6** — Headless browser support (Playwright). Unlocks OvationTix + Ludus subdomain ticketing. ~50MB dependency, ~30s/source.
- **Phase 7** — Seed all 26 orgs (already done).

### Deferred tiers (separate audits later)
- Venues / presenters (Pantages, Rialto, Theatre on the Square — all Tacoma Arts Live; Washington Center; Federal Way PAC; Auburn PAC)
- Symphony / classical (Tacoma Symphony, Symphony Tacoma, Northwest Sinfonietta, Federal Way Symphony)
- Opera (Tacoma Opera)
- Youth / educational (CSTOCK, OFT youth, WWCA, Olympia Junior Programs)
- Colleges (PLU, UPS, Evergreen, Saint Martin's, TCC, Pierce, SPSCC, Centralia)
- High schools (40+, biggest org-by-org effort, smallest payoff)

---

## Build order (historical, v1)

For reference. Now mostly historical since v1/v1.1/v1.2 all shipped:

1. Repo + scaffolding (SvelteKit init, Netlify config, Supabase project, env vars)
2. Supabase schema for v1
3. Cloudinary integration (signed upload URLs, headshot upload component)
4. Public artist submission form
5. Email verification step
6. Resend wrapper + email_log
7. Admin auth (password endpoint with rate limit + 2FA + session cookie)
8. Admin pending queue
9. Magic-link edit flow
10. Public directory page
11. Profile pages
12. Admin profile management
13. Reports flow
14. Email blocklist UI
15. Editable site content
16. Editable email templates
17. Editable disciplines
18. Featured profiles + spotlight rotation
19. Announcement banner
20. Static pages (About, Contact, Support Us, Privacy, Terms)
21. Sitemap.xml + robots meta
22. Graceful outage page
23. Daily admin digest cron
24. Email volume alert
25. Supabase keepalive cron
26. Weekly backup cron
27. Stale profile cleanup cron
28. ADMIN_GUIDE.md + inline help (DEFERRED to launch-prep)
29. Cloudflare Email Routing setup (LIVE 2026-04-29)

---

## Manual-test history

The original `TEST_CHECKLIST.md` (now removed) carried run-throughs for every step above. Salient bugs caught and fixed during those runs:

- Discipline-toggle race (form serialised stale state because Svelte hadn't re-rendered hidden inputs). Fixed with `setTimeout(submitNow, 0)`.
- Sort-toggle race: same bug, same fix.
- Strict age filter dropping profiles with no range (intentional; added a below-grid note explaining how many were excluded).
- Themed `ConfirmModal` replaces the three native `confirm()` dialogs in admin pages. The old `onsubmit-confirm` pattern had a bug: Cancel still submitted because Svelte's `use:enhance` listener ran before the inline `preventDefault()`.
- Reply-To missing on contact emails: hitting Reply went to the relay address. `sendEmail` now accepts `replyTo`.
- Last-name sort: generated `last_name` column (lowercased, indexed) for theatre-convention "Smith, John" ordering.
- Filter changes scroll-to-top: `data-sveltekit-noscroll` + `data-sveltekit-replacestate`.
- Lost-note bug on `/admin/reports`: resolve/dismiss no longer nullifies an existing note.
- Duplicate "Other" chip on `/admin/profiles/[id]/edit`: removed the hardcoded fallback.
