# Build Plan

Phased implementation plan for South Sound Theatre Artists. See `PRODUCT_SPEC.md` for full scope; this doc captures architecture decisions and the order to build them in.

---

## Tech Stack (settled)

| Layer | Choice |
|---|---|
| Frontend | SvelteKit + `adapter-netlify` |
| Hosting | Netlify Free |
| Database | Supabase Free + GitHub Actions keepalive cron + UptimeRobot |
| Image / PDF storage | Cloudinary Free |
| Transactional email | Resend Free (with SPF / DKIM / DMARC configured) |
| Admin email forwarding | Cloudflare Email Routing |
| Donations | Ko-fi embed |
| Backups | Weekly GitHub Actions JSON dump → private GitHub repo |
| Monitoring | UptimeRobot Free on public URL + Resend volume alerts |

Hard constraint: **zero ongoing cost**. Supabase Free pause risk is mitigated by the keepalive cron, not by upgrading to Pro.

---

## Auth Model

No traditional accounts. Three access tiers:

- **Browse** (directory, profiles, callboard, all public pages): zero auth.
- **Submit** (new profile, callboard post, report, contact form): zero auth + one-time email verification before the submission appears in Lexi's queue. Filters bots automatically.
- **Edit own profile / change notification preferences**: magic link to artist's email. Tokens are **single-use, 24-hour expiry, invalidated on use**.
- **Admin (Lexi)**: password (Netlify env var) + magic-link 2FA (6-digit code to admin email) + 30-day session cookie + server-side session token (revocable).

Rate limiting: 5 password attempts per IP per 15 minutes on the admin login endpoint, then lockout.

---

## Data Model (key tables)

| Table | Purpose |
|---|---|
| `profiles` | Live artist profiles |
| `pending_submissions` | New profiles awaiting email verify + admin approval |
| `flagged_edits` | Major edits (headshot, disciplines) requiring re-approval |
| `magic_link_tokens` | Single-use edit tokens with expiry |
| `email_log` | Every Resend send, hashed recipient + type + sent_at; pruned at 35 days |
| `email_blocklist` | Admin-curated abusive sender emails |
| `reports` | User-submitted reports on profiles / posts |
| `featured_profiles` | Spotlight rotation selection |
| `site_content` | Editable copy keyed by slug (homepage, about, etc.) |
| `email_templates` | Editable email body templates with variable placeholders |
| `announcement_banner` | Optional site-wide banner with date range |
| `disciplines` | Editable list of discipline tags |
| `productions` | Shows extracted from approved callboard posts (v1.2+) |
| `callboard_posts` | Audition notices, etc. (v1.2+) |
| `verified_orgs` | Approved theatre organizations (v1.2+) |
| `notification_subscriptions` | Artist opt-ins for weekly digest by discipline (v1.2+) |

All tables include `created_at`, `updated_at`. Soft-deleted rows have `deleted_at` set; a daily cron hard-deletes rows where `deleted_at` is older than 30 days.

---

## Phased Roadmap

### v1 - Directory only
The minimum viable site: artists submit, get approved, edit, get contacted. Launch and let people use it.

**Features:**
- Public artist submission form with email verification before queue
- Admin pending queue (one-at-a-time, daily digest email at 8am if non-empty)
- Admin profile management (search, edit, unpublish, soft-delete with 30-day recovery)
- Magic-link edit flow with resend
- Public directory with filters (discipline, availability, experience level, union, area, age range, languages)
- Profile pages with contact form (Resend-routed, real email never exposed)
- Email blocklist in admin panel
- Report button on profiles → admin queue
- Featured profile rotation on homepage (date-bucketed seed, not pure random)
- Editable homepage / about / support us / contact / footer copy via admin (markdown + toolbar)
- Editable email templates via admin (markdown)
- Announcement banner (optional, with date range)
- Editable disciplines list
- Email-deliverability bundle: SPF, DKIM, DMARC, verified test sends to Gmail / Outlook / Yahoo
- Sitemap.xml + per-page robots meta (public pages indexed; admin / edit / queue noindex)
- Graceful Supabase outage page (catch DB connection failure, render "back soon" template)
- "Member since" date on profiles
- Privacy and Terms pages (draft text, lawyer review before launch)
- Profile delete flow (artist-initiated from edit page)
- Headshot rights consent checkbox on upload
- About / Contact / Support Us pages
- Cloudflare Email Routing setup doc
- ADMIN_GUIDE.md + inline admin-panel help
- Smart empty states throughout admin

### v1.1 - Resume features + Mentorship + QR codes
Profile-level polish that doesn't change the core data flow.

- On-site structured resume builder (theatre credits, training, skills sections per discipline)
- PDF resume upload via Cloudinary
- PDF parsing + column mapper (bounded scope: tabular layouts only, raw-text fallback for everything else)
- Mentorship opt-in: checkbox on Veteran-tier profiles + a "Find a mentor" filter view
- Profile QR code (client-side library, links to public URL)
- Analytics (Plausible or GoatCounter free tier)

### v1.2 - Callboard + Notification opt-ins + Productions data
Adds the second product surface and the data foundation for v1.3.

- Callboard public page (filterable by post type)
- Public callboard submission form (with email verification for unverified posters)
- Admin callboard management (approve unverified posts, remove any post)
- Verified theatre organization application + approval flow
- Verified-org callboard posts go live immediately without per-post approval
- Auto-unpublish posts after audition / closing date
- Opt-in weekly digest of matching callboard posts (Sunday evening, skip empty weeks)
- `productions` table populated from approved callboard posts as a side effect
- Resource library (curated links, content-managed by admin)

### v1.3 - Discovery layer
Three features sharing the productions data, ship together.

- "What's Playing" calendar (production announcements as a month/list view)
- "Currently appearing in" badges on artist profiles
- Public production archive page (searchable past + present productions)

### v2 - Driven by real usage
Add nothing speculatively. Triggers are concrete signals from real users:
- Batch admin actions if Lexi clears >10 items per session regularly
- Image cropping UI if artists complain about auto-crop results
- Embeddable profile widgets if anyone asks
- Favorites / starred artists (localStorage, no accounts)
- WYSIWYG editor migration if Lexi struggles with markdown
- Whatever else surfaces

---

## v1 Build Order

Ordered to surface integration risks early and reach a usable demo as fast as possible.

1. **Repo + scaffolding**: SvelteKit init, Netlify config, Supabase project, env vars, `.env.example`
2. **Supabase schema**: tables for v1 (profiles, pending_submissions, magic_link_tokens, email_log, email_blocklist, reports, featured_profiles, site_content, email_templates, announcement_banner, disciplines)
3. **Cloudinary integration**: signed upload URLs, headshot upload component with progress indicator
4. **Public artist submission form**: all fields per spec, headshot upload, rights consent, honeypot anti-spam
5. **Email verification step**: send confirmation link → click verifies email → row appears in queue
6. **Resend wrapper + email_log**: every send goes through one helper that logs first
7. **Admin auth**: password endpoint with rate limit + magic-link 2FA + session cookie
8. **Admin pending queue**: list + detail view + approve / reject (with rejection reason → email)
9. **Magic-link edit flow**: token generation, "resend my link" form, edit page with all fields, single-use token invalidation
10. **Public directory page**: list + filters + search by name
11. **Profile pages**: public view + contact form (Resend-routed, blocklist check, fake-success on blocked)
12. **Admin profile management**: search, edit any field, unpublish (soft-delete), "trash" view for 30-day recovery
13. **Reports flow**: report button on profile → admin queue
14. **Email blocklist UI**: list view, add (paste email + note), remove
15. **Editable site content**: site_content table + markdown editor + live preview pane in admin
16. **Editable email templates**: same pattern + variable placeholder sidebar
17. **Editable disciplines**: add / remove / reorder list editor
18. **Featured profiles + spotlight rotation**: admin selection + date-seeded rotation on homepage
19. **Announcement banner**: edit form + active-window logic on public pages
20. **Static pages**: About, Contact, Support Us, Privacy, Terms (draft text)
21. **Sitemap.xml + robots meta**: public pages indexed, admin noindex
22. **Graceful outage page**: DB failure detection + fallback template
23. **Daily admin digest cron**: GitHub Action runs 8am daily, emails Lexi if queue non-empty
24. **Email volume alert**: GitHub Action runs daily, alerts at 70% (2100/3000) of monthly Resend cap
25. **Supabase keepalive cron**: GitHub Action runs every 3 days, hits `/api/healthcheck`
26. **Weekly backup cron**: GitHub Action runs weekly, dumps tables → private repo as JSON
27. **Stale profile cleanup cron**: 18 months no edit → "still in the area?" email; 30 days no response → archive
28. **ADMIN_GUIDE.md + inline help**: per-section help text in admin panel + standalone reference doc
29. **Cloudflare Email Routing setup doc**: instructions for Lexi when transferring service accounts

Most of these are 1-3 days of focused work. v1 total estimate: 6-10 weeks part-time.

---

## Architecture Commitments

These make later phases cheap to add. Bake them into v1 even when the immediate need is small:

1. **APIs accept arrays from day one.** `POST /api/admin/approve { ids: [...] }` even when called with one ID. Batch actions become a UI-only change later.
2. **Queue items keyed by stable IDs**, with action handlers taking ID parameters (not closures over rendered rows). Multi-select state can be layered on top later.
3. **All copy is in the database, not hardcoded.** `site_content`, `email_templates`, `disciplines`, `announcement_banner`. Lexi never needs a code change to update text.
4. **Markdown rendering is centralized** through one shared component so output is consistent everywhere.
5. **All emails go through one wrapper** (`sendEmail`) that logs to `email_log` and checks blocklist before calling Resend.
6. **Soft-delete is the default** for admin actions; hard delete is a separate cron job after 30 days.
7. **Magic-link tokens are single-use and invalidated on use**, not just on expiry.
8. **Profile slugs are user-controlled on collision** via a popup at submission, not auto-suffixed.

---

## Admin Panel Structure

**v1 sections:**

- Pending Queue (submissions, flagged edits, reports - one daily digest email if non-empty)
- All Profiles (search / filter / edit / unpublish / soft-delete with trash recovery)
- Featured Profiles (homepage spotlight rotation)
- Site Content (homepage / about / support us / contact / footer - markdown editor + preview)
- Announcement Banner (optional site-wide, with date range)
- Email Templates (magic link / resend / rejection / contact-routed / verified org / weekly digest header)
- Disciplines (add / remove / reorder)
- Email Blocklist
- Settings (admin contact email, daily digest preference)

**v1.2 adds:** Callboard Management, Verified Organizations.

**Editor UX:** markdown + toolbar (Bold / Italic / Link / List / Heading / Image-upload). Live preview pane alongside. Image button uploads to Cloudinary and inserts the markdown image syntax automatically. Email templates show a variable-placeholder sidebar.

---

## Launch Checklist

Before flipping the public DNS over:

- [ ] All v1 features functional end-to-end
- [ ] SPF, DKIM, DMARC configured on the domain (verify with `mxtoolbox.com` or similar)
- [ ] Test magic-link, contact-form, and admin-2FA emails delivered to Gmail / Outlook / Yahoo without landing in spam
- [ ] Cloudflare Email Routing forwarding `lexi@domain` to her Gmail
- [ ] Gmail "Send As" configured so her replies come from the custom address
- [ ] Privacy + Terms pages reviewed and replaced with lawyer-approved copy (or template service like TermsFeed / Termly)
- [ ] All env vars set in Netlify production: Supabase URL + key, Cloudinary cloud + key, Resend key, admin password, session secret
- [ ] Supabase keepalive cron deployed and verified (manually trigger once, confirm log entry)
- [ ] Weekly backup cron deployed and verified
- [ ] Daily admin digest cron deployed and verified
- [ ] UptimeRobot monitor on public URL with email alerts to Blake
- [ ] Resend volume alert cron tested at simulated 70% threshold
- [ ] Sitemap.xml accessible at `/sitemap.xml`
- [ ] robots.txt accessible at `/robots.txt`
- [ ] Public profile pages render correct OG meta tags (test with Facebook / Twitter card validators)
- [ ] Admin panel mobile layout tested on phone
- [ ] First-time admin empty states render correctly
- [ ] One real test submission walked through entire flow (submit → verify email → approve → edit via magic link → contact form → message arrives)
- [ ] Domain registrar 2FA transferred to Lexi's phone
- [ ] Service account passwords transferred to Lexi (Netlify, Supabase, Cloudinary, Resend)
- [ ] ADMIN_GUIDE.md complete and shared with Lexi

---

## Confirmed Skips (do not build)

These came up in planning and were explicitly cut. Do not add without revisiting:

- Forum or chat (moderation load)
- Reviews or ratings of artists / theatres (community drama risk)
- Internal messaging (email already exists)
- vCard / "Add to contacts" download (privacy gets weird with hidden emails)
- Theatre venue mini-directory (overkill, callboard contacts cover it)
- Image cropping UI in v1 (Cloudinary auto-crop is fine; add later if needed)
- Embeddable profile widgets (no demand signal)
- Batch admin actions in v1 (architecture allows cheap retrofit if needed)
- Traditional account system (magic-link + admin password is the entire identity model)
- One-click email-based admin approval links (more attack surface than benefit)
- WYSIWYG editor in v1 (markdown + toolbar covers 99% of needs; migration path exists if Lexi struggles)

---

## Deploy Targets

- **Netlify preview / staging URL**: https://southsoundtheatreartists.netlify.app (auto-deploys from `main`)
- **Custom domain** (post-launch): TBD - Lexi owns it, DNS access pending

## Open Items Pending Real-World Information

- Domain name (Lexi owns it; needs access for DNS configuration ~2 weeks before launch)
- Final legal copy for Privacy and Terms (lawyer or template service review)
- Lexi's preferred admin contact email format (`lexi@domain` or other)
- Service account transfer plan timing (after v1 feature-complete, before public launch)
