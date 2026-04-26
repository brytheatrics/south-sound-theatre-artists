# South Sound Theatre Artists Directory — CLAUDE.md

This document describes the full scope of a community website for South Sound theatre artists. Use it to create a detailed build plan before writing any code. Ask clarifying questions if anything is ambiguous before proceeding.

---

## Project Overview

A free community web platform for South Sound (Tacoma/Olympia/Gig Harbor area) theatre artists. It serves as:
1. A searchable directory of theatre artists of all disciplines
2. A callboard for audition notices, production announcements, and crew/designer calls
3. A community resource maintained by a single non-technical admin

**Core constraints:**
- Zero ongoing cost (or as close to it as possible)
- Admin must never need to touch Supabase, Netlify, or any backend directly
- Built to be handed off and maintainable by someone else in the future
- Clean, simple code and architecture

---

## Tech Stack

| Layer | Tool | Why |
|---|---|---|
| Frontend | Netlify (static) | Free hosting, admin already familiar |
| Database | Supabase (free tier) | Postgres + REST API + file storage |
| Image storage | Cloudinary (free tier) | Auto-compress/resize headshots on upload |
| Email | Resend (free tier) | Magic links, contact form routing, notifications |
| Donations | Ko-fi embed | Zero cost, zero maintenance |
| Domain | Already owned by admin | No cost |
| Admin email | Cloudflare Email Routing | Free custom domain email forwarding to Gmail |

No paid services. No login system for artists — magic link / token-based editing only.

---

## User Roles

### Artist (no account)
- Submits profile via public form
- Receives magic link via email after approval to edit their profile
- Can request a new magic link via "resend my edit link" flow
- Can be contacted via on-site contact form (their real email is never exposed)

### Theatre Organization (verified)
- Applies for verified status
- Once verified, can post to the callboard without admin approval for every post
- Still goes through initial approval to receive verified status

### Admin (Lexi)
- Single admin, non-technical
- Accesses a password-protected admin panel on the same Netlify deployment
- Password stored as a Netlify environment variable
- Never touches Supabase, Cloudinary, or Resend directly
- All management happens through the admin panel UI

---

## Artist Profile

### Submission Form (public)
Fields:
- Full name
- Disciplines (multi-select — see filter list below)
- Bio (freeform text)
- Headshot (image upload via Cloudinary — no file size restriction, show "large files may take a moment" message for files over a reasonable threshold, display a progress indicator)
- Resume (see Resume section below)
- Availability status (Available / Currently Committed)
- Experience level (Emerging / Mid-Career / Veteran — self-reported)
- Union status (AEA / AGMA / Non-Union)
- Geographic area (Tacoma / Olympia / Gig Harbor / Other South Sound)
- Age range (optional, self-reported — relevant for actors)
- Languages spoken
- Instagram handle (optional)
- Personal website URL (optional)
- Email address (never displayed publicly — used for magic link and contact routing only)

### Profile Page
- Public URL: `/artists/[slug]`
- Displays all public fields
- "Last Updated" timestamp
- Contact form (see Contact section)
- Link to on-site resume if built, or PDF resume download if uploaded

### Editing
- Artist receives a unique token-based magic link on approval
- "Resend my edit link" button on the site — artist enters email, receives new link
- **Minor edits** (bio, contact info, social links, availability status) — go live immediately, flag admin in background
- **Major edits** (headshot, disciplines/roles) — return profile to pending state, require re-approval
- Availability status can be toggled by the artist at any time without re-approval

---

## Resume System

Artists have three options, which can coexist:

### Option 1: On-site structured resume builder
- Form-based editor with sections relevant to theatre disciplines
- **Actor sections:** Theatre Credits (Show / Role / Company), Film & TV, Training, Skills (dialects, combat, dance, instruments, etc.)
- **Director / Designer / SM sections:** Credits (Show / Position / Company), Training, Software & Skills
- **General:** A freeform credits section that works for any discipline
- Renders as a clean public page at `/artists/[slug]/resume`
- Printable via browser print-to-PDF (no server-side PDF generation needed)
- Shareable URL
- Text stored in Supabase — essentially zero storage cost

### Option 2: PDF resume upload
- Uploaded via Cloudinary (handles PDFs as well as images)
- Displayed as a download link on the profile
- PDFs are small (~200KB typical) — negligible storage impact

### Option 3: PDF parsing / column mapping (for import)
- Artist uploads existing PDF resume
- System attempts to extract tabular data
- If clean columns are detected, present a column mapping UI (similar to cast list import on rehearsalblock.com) — artist maps columns to fields (Show / Role / Company)
- If layout is too complex to parse cleanly, gracefully fall back: show extracted raw text alongside the blank structured form so the artist can reference it while filling in manually
- Never show a broken or scrambled result — always fall back gracefully

---

## Headshot Handling

- Upload goes through Cloudinary
- Cloudinary auto-resizes and compresses on ingest — original file is not stored
- No artificial file size cap — large files just take longer, show progress indicator and "this may take a moment for large files" message
- Store only the Cloudinary URL in Supabase

---

## Filters (Directory Search Page)

- **Discipline / Role** (multi-select): Actor, Director, Scenic Designer, Lighting Designer, Costume Designer, Sound Designer, Projection Designer, Props Designer, Stage Manager, Choreographer, Music Director, Playwright, Producer, Technician, Crew, Other
- **Availability**: Available / Currently Committed
- **Experience Level**: Emerging / Mid-Career / Veteran
- **Union Status**: AEA / AGMA / Non-Union
- **Geographic Area**: Tacoma / Olympia / Gig Harbor / Other South Sound
- **Age Range** (optional field — only show in filter if artist provided it)
- **Languages Spoken**

---

## Contact System

- Every profile has a contact form — this is the only contact mechanism
- Form fields: Sender name, sender email, message
- System emails the message to the artist's real email via Resend
- Artist's real email is never displayed on the site
- Artist replies directly from their own email — from that point it is normal email between two people
- Spam protection: honeypot field (no CAPTCHA — keep UX clean)
- No on-site messaging, no chat, no stored conversations

---

## Callboard

A separate section of the site for time-sensitive community postings.

### Post Types

**Audition Notice**
- Show title, producing company, show dates, audition date/time/location
- Roles available with breakdowns
- Compensation (paid / stipend / volunteer)
- How to submit (in person, video, email, etc.)
- Contact/submission info

**Production Announcement**
- Show, company, dates, ticket/info link

**Call for Designers / Crew**
- Position(s) needed, show, company, compensation, timeline

**General Opportunity**
- Workshops, classes, staged readings, anything that doesn't fit above

### Posting Rules
- Unverified individuals: submit post, admin approves before it goes live
- Verified theatre organizations: posts go live immediately without per-post approval
- All posts include an expiration date — auto-unpublish after audition date or closing date passes (keeps the board current without manual cleanup)
- Admin can remove any post at any time from the admin panel

### Verified Theatre Organization Status
- Theatres apply via a simple form
- Admin approves and grants verified status in the admin panel
- Verified badge shown on their callboard posts

---

## Email Notifications (Opt-in)

- Artists can opt in to receive email notifications when new callboard posts go up matching their discipline(s)
- Managed via a preference toggle in their magic-link edit page
- Sent via Resend

---

## Admin Panel

Password-protected page on the same Netlify deployment. Password stored as Netlify environment variable. No separate auth system.

### Sections

**Pending Queue**
- New artist profile submissions awaiting approval
- Flagged edits (headshot or discipline changes on existing profiles)
- Unverified callboard post submissions
- Each item shows full preview — approve or reject with one click
- Rejection sends an email to the submitter with the reason typed by admin

**All Profiles**
- Searchable list of all live profiles
- Admin can edit any profile directly
- Admin can unpublish any profile

**Callboard Management**
- All active and expired posts
- Admin can remove any post

**Verified Organizations**
- List of verified theatre orgs
- Approve new applications
- Revoke verified status if needed

---

## Site Pages & Navigation

| Page | Notes |
|---|---|
| Home | Intro, spotlight/featured profiles (rotating, admin-curated or random), callboard preview, donate button |
| Directory | Searchable, filterable artist profiles |
| Callboard | All active posts, filterable by post type |
| Submit Your Profile | Public artist submission form |
| Post to Callboard | Public callboard submission form |
| About | Who runs this, what it's for, how to get involved, Lexi's story |
| Contact | Simple form routing to Lexi's email (her real email never displayed) |
| Support Us | Ko-fi embed, framed as "help keep this community resource free" |
| Artist Edit Page | Accessed only via magic link — not in main navigation |
| Admin Panel | Password-protected — not in main navigation |

---

## Spotlight / Featured Profiles

- Rotating featured profiles on the homepage
- Admin can curate which profiles are featured via the admin panel
- Falls back to random selection from approved profiles if admin hasn't curated

---

## Email Infrastructure

- Admin's public-facing email: `lexi@southsoundtheatreartists.com` (or similar)
- Set up via Cloudflare Email Routing — forwards to her existing Gmail at no cost
- Gmail "Send As" configured so replies come from the custom address
- All system emails (magic links, contact form routing, callboard notifications) sent via Resend from the same domain

---

## What to Build First (Suggested Order)

1. Supabase schema — profiles, tokens, callboard posts, verified orgs, disciplines
2. Cloudinary integration — headshot upload flow
3. Public artist submission form
4. Admin panel — pending queue, approve/reject, profile management
5. Magic link edit flow — token generation, resend flow, edit page
6. Public directory page with filters
7. Individual profile pages with contact form
8. Contact form routing via Resend
9. On-site resume builder
10. PDF resume upload
11. PDF parsing / column mapping import
12. Callboard — submission form, public board, admin management, verified org flow
13. Email notifications (opt-in)
14. Spotlight / featured section on homepage
15. About, Contact, Support Us pages
16. Cloudflare Email Routing setup instructions for admin

---

## Notes for Claude Code

- Write clean, well-commented code — this will be handed off and maintained by others
- Every feature touching the admin must be usable by a non-technical person
- Never expose artist real email addresses anywhere in the frontend
- All environment variables (Supabase keys, Cloudinary keys, Resend keys, admin password) go in Netlify environment variables — never hardcoded
- Mobile-first design — theatre people are on their phones constantly
- Build the admin panel and public site as the same Netlify deployment, admin routes behind password gate
- Ask clarifying questions before beginning if anything is ambiguous
