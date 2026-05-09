# Bulk import: profiles from emailed-in bios + headshots

For the launch batch of artists who emailed bios, headshots, and resumes
in before the site existed. One-shot operational tool - the public
submission form takes over from launch onward.

## Folder convention

Drop one folder per person under `./imports/` (gitignored). Anything
goes in the folder; the script picks up what it recognises:

```
imports/
  Jane Smith/
    bio.txt              # required (or .md)  - any text, becomes profile.bio
    headshot.jpg         # optional            - any image format, only one
    resume.pdf           # optional            - 0+ PDFs, any filenames
    acting-resume.docx   # also fine           - .docx auto-converts to PDF
    meta.txt             # optional            - key:value lines for known fields
  Marcus Chen/
    headshot.jpg         # bio + meta optional - missing fields make this a hidden draft
    resume.pdf
```

**Folder name = full name.** Use the form they'd want shown publicly
(`Jane Smith/`, not `jane_smith/`).

**Reserved folder names** are skipped automatically (case-insensitive):
- `Template/` — working scaffold, not a real submission
- `Past/` — artists already imported, kept on disk for reference
- Anything starting with `_` (e.g. `_results.csv`)

The dedup check still fires for everything in the root, so a forgotten
move-to-`Past/` is safely skipped (`status=skipped_existing`) rather
than re-imported as a duplicate.

**Image extensions accepted:** `.jpg .jpeg .png .webp .heic`. Only one
image per folder; the script picks the first one alphabetically.

**PDF labels** are auto-derived from the filename:
`Acting_Resume_2024.pdf` → `Acting Resume 2024`. `resume.pdf` → `Resume`.

**`.docx` auto-conversion:** when the script sees a `.docx`, it shells
out to PowerShell + Microsoft Word's COM automation to generate a
`.pdf` next to it (uses Word's `ExportAsFixedFormat` so images,
tables, and formatting come through cleanly). The original `.docx`
stays in the folder; the new `.pdf` is what gets uploaded to
Cloudinary. Conversion is idempotent - reruns skip a `.docx` whose
sibling `.pdf` already exists.

Requires **Windows + Microsoft Office** for the conversion step. If
the script runs anywhere else, `.docx` files are skipped with a
console warning and the row imports without that resume. Pre-convert
to PDF manually (Word: File → Save As → PDF) if you're running on
mac/Linux.

## meta.txt fields (all optional)

Any line that isn't `key: value` gets ignored, so you can drop comments
in `# like this` or leave blank lines for readability.

```
email: jane@example.com
phone: 253-555-0142
disciplines: Actor, Director, Playwright
area: Tacoma
city: Tacoma
pronouns: she/her
playable_age: 28-45
languages: English, Spanish
unions: AEA
ethnicities: Asian American
website: https://janesmith.com
instagram: @janesmith
facebook: https://facebook.com/janesmith
tiktok: @janesmith
linkedin: https://linkedin.com/in/janesmith
twitter: @janesmith
youtube: https://youtube.com/@janesmith
```

**`phone` is optional and never rendered publicly.** Stored on the profile so artists who already shared a number don't have to re-enter via /edit/[token]. Use any format (`(253) 555-0142`, `253.555.0142`, `+1 253 555 0142`) - we don't enforce a specific shape, just need at least 7 digits.

**`disciplines` in meta.txt overrides** the auto-detection from bio. Use
exact names from the canonical disciplines list (the script silently
drops unrecognised ones, so check the `_results.csv` if you typed
something the parser didn't accept).

**`area` is loose-matched** against the canonical SSTA areas (`Tacoma
area`, `Olympia area`, `Gig Harbor / Kitsap`, etc). Saying "Tacoma" or
"Tacoma area" both work. If the script can't match, the area field is
left blank and the profile becomes a hidden draft.

**`playable_age`** accepts ranges like `28-45`, `28 to 45`, `28–45`. A
single number is ignored.

## Auto-detection of disciplines

If `disciplines` isn't in `meta.txt` but `bio.txt` exists, the script
greps the bio for canonical discipline names + a small alias table
(`SM` -> Stage Manager, `LD` -> Lighting Designer, "directing" ->
Director, etc.) and applies whatever it finds. The detection is
intentionally a bit trigger-happy - artists fix their own profiles via
magic-link later, so a slightly over-tagged profile is a better default
than an empty one.

The `_results.csv` flags every profile where disciplines were inferred
(`inferred_disciplines: true`) so you can spot-check and override via
`meta.txt` before the real run.

## Run it

```bash
# Dry run: parses + reports without touching the DB or Cloudinary
node scripts/bulk-import-profiles.mjs --dry-run

# Real import
node scripts/bulk-import-profiles.mjs

# Real import, with all rows marked trusted=true
# (use only for batches Lexi vouches for - default is untrusted)
node scripts/bulk-import-profiles.mjs --trust-all
```

## Trust flag

Imports default to `trusted = false`. The trust flag governs whether
future magic-link edits an artist makes apply directly or queue in
`flagged_edits` for admin review. Untrusted is the safer posture for a
bulk import where Lexi may not personally know every submitter - she
can flip individual rows to trusted from `/admin/profiles` after
eyeballing them.

For batches she does know (a known company's roster, a vetted
mentorship cohort), pass `--trust-all` to flip the default for that
run.

Both modes write `imports/_results.csv` showing every folder's outcome:

| folder | slug | status | full_name | email | email_is_placeholder | has_bio | has_headshot | resume_count | disciplines | inferred_disciplines | area | missing_required | edit_url | error |

`status` is one of:
- `published` - profile is live on `/directory`
- `hidden_draft` - imported but not published; finish in `/admin/profiles`
- `error` - the row failed; see the `error` column

`edit_url` is a single-use 30-day magic-link edit URL the artist can use
to fill in the rest of their profile. **No emails go out during the
import.** Mail-merge them out from the CSV in waves when you're ready
to announce.

## Email handling for missing addresses

`profiles.email` is `NOT NULL` in the schema, so folders without an
`email:` line in `meta.txt` get a placeholder
(`import+<slug>@unknown.ssta.local`). The `email_is_placeholder` column
in `_results.csv` flags them so you know which folks need a real email
before they can use the magic-link edit flow.

To fix: track down the real email, then update the row directly in
`/admin/profiles/<id>/edit` - the email field is editable. Replacing it
also lets you send them a fresh edit link from the admin UI.

## After the import

1. Open `/admin/profiles?published=false` to see all the hidden drafts
2. For each one, fill in the missing required fields
   (disciplines / area) and flip `published`
3. When you're ready to invite people, use the `edit_url` column from
   `_results.csv` to send them their magic link (mail-merge tool of
   your choice)

## Required env vars

The script reads from `.env`:

- `SUPABASE_DB_URL` (already set for migrations)
- `PUBLIC_CLOUDINARY_CLOUD_NAME` / `CLOUDINARY_API_KEY` /
  `CLOUDINARY_API_SECRET` (already set for Cloudinary uploads)
- `PUBLIC_SITE_URL` (used to build the edit URLs in the results CSV)

## Cloudinary PDF gotcha

PDFs upload to Cloudinary as raw resource type. **The "Allow PDF and
ZIP files delivery" toggle must be on** in Cloudinary console ->
Settings -> Security. Without it, GETs to the resume URLs return 401.
This is a known one-time setting from when v1.1 shipped; it should
already be on if any resume has worked before.

## Re-running

The script doesn't deduplicate on rerun - if you point it at the same
folder twice, you'll get two profiles with auto-suffixed slugs
(`jane-smith` and `jane-smith-2`). Move processed folders out of
`imports/` before running again, or drop only the new folders in.
