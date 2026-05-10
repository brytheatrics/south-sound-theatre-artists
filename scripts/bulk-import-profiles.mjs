// scripts/bulk-import-profiles.mjs
//
// One-shot bulk import for profiles that came in via email before the
// site existed. Reads ./imports/<Person Name>/ folders, each containing
// any combination of:
//   - bio.txt          -> profile.bio (full file contents, trimmed)
//   - headshot.{jpg,png,webp,heic,jpeg}  -> uploaded to Cloudinary
//   - resume*.pdf      -> 0+ PDFs uploaded to Cloudinary as raw uploads,
//                         attached as profile.resumes [{label, url}, ...]
//   - meta.txt         -> "key: value" lines for known fields
//                         (email / disciplines / area / city / pronouns /
//                          playable_age / languages / website / instagram
//                          / facebook / tiktok / linkedin / twitter /
//                          youtube / unions / ethnicities)
//
// Folder name becomes the full_name. Anything missing is left empty.
// Profiles missing required fields (disciplines or geographic_area) are
// imported as hidden drafts so they don't show on /directory until you
// finish them in /admin/profiles.
//
// Discipline auto-detection: if meta.txt doesn't supply disciplines and
// a bio.txt exists, the script greps the bio for canonical discipline
// names + a small alias table (SM / LD / ASM / etc) and applies what it
// finds. Imperfect by design - artists fix their own profiles via
// magic-link later, so a slightly trigger-happy parse is the right call.
//
// Outputs ./imports/_results.csv with one row per folder showing what
// was imported, what was inferred, and the magic-link edit URL so you
// can mail-merge those out in waves once you're ready.
//
// Usage:
//   node scripts/bulk-import-profiles.mjs            # real import
//   node scripts/bulk-import-profiles.mjs --dry-run  # parse + report only

import { readdirSync, readFileSync, statSync, writeFileSync, existsSync } from "node:fs";
import { join, basename, extname, dirname } from "node:path";
import { randomBytes, createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import "dotenv/config";
import pg from "pg";

const { Client } = pg;

const DRY_RUN = process.argv.includes("--dry-run");
// Default trust is FALSE for imports. The trust flag controls whether
// future magic-link edits the artist makes apply directly or queue in
// flagged_edits for admin review. Defaulting to untrusted is the safer
// posture for bulk imports - Lexi can flip individual rows to trusted
// from /admin/profiles after eyeballing them. If you're importing a
// known batch (people Lexi vouches for), pass --trust-all to flip the
// default for that run.
const TRUST_ALL = process.argv.includes("--trust-all");
// Optional --imports-dir <path> override for the source folder. Default
// is ./imports/ in the repo. Use this to point at OneDrive / Desktop
// folders without having to copy files around. Folders named "Template"
// or "Past" (case-insensitive) are skipped: Template = working scaffold,
// Past = artists already imported, kept on disk for reference. The
// dedup check still fires for anything in the root, so a forgotten
// move-to-Past is safely skipped (status='skipped_existing') rather
// than re-imported as a duplicate.
const argDirIdx = process.argv.indexOf("--imports-dir");
const IMPORTS_DIR =
  argDirIdx >= 0 && process.argv[argDirIdx + 1]
    ? process.argv[argDirIdx + 1]
    : "imports";
const RESULTS_CSV = join(IMPORTS_DIR, "_results.csv");
const EDIT_TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

const env = {
  db: process.env.SUPABASE_DB_URL,
  cloudName: process.env.PUBLIC_CLOUDINARY_CLOUD_NAME,
  apiKey: process.env.CLOUDINARY_API_KEY,
  apiSecret: process.env.CLOUDINARY_API_SECRET,
  siteUrl: process.env.PUBLIC_SITE_URL || "https://southsoundtheatreartists.org",
};

function fail(msg) {
  console.error(`ERROR: ${msg}`);
  process.exit(1);
}

if (!env.db) fail("SUPABASE_DB_URL is not set in .env");
if (!DRY_RUN && (!env.cloudName || !env.apiKey || !env.apiSecret)) {
  fail("Cloudinary env (CLOUD_NAME / API_KEY / API_SECRET) is incomplete");
}

const IMAGE_EXTS = new Set([".jpg", ".jpeg", ".png", ".webp", ".heic"]);
const PDF_EXT = ".pdf";
const DOCX_EXT = ".docx";

// Convert a .docx file to .pdf alongside it. Returns the PDF path on
// success, null if the conversion couldn't run. Used so artists who
// emailed a Word doc (or that one person who used Pages) end up with a
// real PDF on their profile without manual intervention.
//
// Strategy: shell out to PowerShell + Word COM automation on Windows.
// Idempotent - if the .pdf already exists alongside the .docx, returns
// it without re-running Word. Skipped (returns null) if Word isn't
// available; we surface a warning rather than failing the whole row.
function convertDocxToPdf(docxPath) {
  const pdfPath = docxPath.replace(/\.docx$/i, ".pdf");
  if (existsSync(pdfPath)) return pdfPath;
  if (process.platform !== "win32") {
    console.warn(`  ! ${basename(docxPath)}: docx->pdf needs Windows + Word, skipping`);
    return null;
  }
  // Word's ExportAsFixedFormat is the most reliable PDF export (handles
  // images / tables / headers consistently across Office versions).
  // wdExportFormatPDF = 17.
  const ps = `
    $ErrorActionPreference = 'Stop'
    $word = New-Object -ComObject Word.Application
    $word.Visible = $false
    try {
      $doc = $word.Documents.Open([string]'${docxPath.replace(/'/g, "''")}', $false, $true)
      $doc.ExportAsFixedFormat([string]'${pdfPath.replace(/'/g, "''")}', 17)
      $doc.Close($false)
    } finally {
      $word.Quit()
    }
  `;
  try {
    execFileSync("powershell.exe", ["-NoProfile", "-Command", ps], {
      stdio: ["ignore", "ignore", "pipe"],
    });
    return existsSync(pdfPath) ? pdfPath : null;
  } catch (err) {
    console.warn(`  ! ${basename(docxPath)}: docx->pdf conversion failed (${err.message?.slice(0, 200)})`);
    return null;
  }
}

// Cloudinary's free-tier image upload caps at 10 MB per request. Phone
// cameras emit 13-20 MB JPEGs, so over-cap files would 400 the upload
// without any auto-fix. This downsizes oversized headshots in place
// (writes a sibling .resized.jpg, returns its path) using PowerShell +
// System.Drawing, mirroring the docx-to-pdf approach above. Only fires
// when the source file is >9 MB.
const CLOUDINARY_IMAGE_CAP_BYTES = 9 * 1024 * 1024; // 9MB safety margin
function ensureImageUnderCap(imagePath) {
  let stats;
  try {
    stats = statSync(imagePath);
  } catch {
    return imagePath;
  }
  if (stats.size <= CLOUDINARY_IMAGE_CAP_BYTES) return imagePath;
  if (process.platform !== "win32") {
    console.warn(
      `  ! ${basename(imagePath)}: file is ${(stats.size / 1024 / 1024).toFixed(1)}MB, over the 10MB Cloudinary cap. Auto-resize needs Windows; pre-resize manually and rerun.`,
    );
    return imagePath; // let the upload fail loudly
  }
  const out = imagePath.replace(/\.[^.]+$/, ".resized.jpg");
  if (existsSync(out)) return out; // already resized in a prior run
  // Down-sample the long edge to 2000px and re-encode as JPEG quality
  // 85. That's the same target the browser-side downsizeImage util uses
  // and it lands well under the cap for any normal phone photo.
  const ps = `
    $ErrorActionPreference = 'Stop'
    Add-Type -AssemblyName System.Drawing
    $img = [System.Drawing.Image]::FromFile([string]'${imagePath.replace(/'/g, "''")}')
    try {
      $maxEdge = 2000
      $ratio = [Math]::Min($maxEdge / $img.Width, $maxEdge / $img.Height)
      if ($ratio -gt 1) { $ratio = 1 }
      $newW = [int]($img.Width * $ratio)
      $newH = [int]($img.Height * $ratio)
      $resized = New-Object System.Drawing.Bitmap $newW, $newH
      $g = [System.Drawing.Graphics]::FromImage($resized)
      $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
      $g.DrawImage($img, 0, 0, $newW, $newH)
      $jpegEncoder = [System.Drawing.Imaging.ImageCodecInfo]::GetImageEncoders() | Where-Object { $_.MimeType -eq 'image/jpeg' }
      $encParams = New-Object System.Drawing.Imaging.EncoderParameters 1
      $encParams.Param[0] = New-Object System.Drawing.Imaging.EncoderParameter([System.Drawing.Imaging.Encoder]::Quality, [int64]85)
      $resized.Save([string]'${out.replace(/'/g, "''")}', $jpegEncoder, $encParams)
      $g.Dispose(); $resized.Dispose()
    } finally {
      $img.Dispose()
    }
  `;
  try {
    execFileSync("powershell.exe", ["-NoProfile", "-Command", ps], {
      stdio: ["ignore", "ignore", "pipe"],
    });
    if (!existsSync(out)) return imagePath;
    const before = (stats.size / 1024 / 1024).toFixed(1);
    const after = (statSync(out).size / 1024 / 1024).toFixed(1);
    console.log(
      `  i ${basename(imagePath)}: resized for upload (${before}MB -> ${after}MB)`,
    );
    return out;
  } catch (err) {
    console.warn(
      `  ! ${basename(imagePath)}: auto-resize failed (${err.message?.slice(0, 200)}); upload will likely error`,
    );
    return imagePath;
  }
}

// Canonical SSTA areas. Loose-matched against the meta.txt area value.
// Exact list comes from the DB at runtime.

// Common discipline aliases to canonical name patterns. The script
// matches these against bio text; multiple aliases can map to the same
// canonical discipline. Match order doesn't matter - dedup happens at
// the end. Patterns are case-insensitive, word-boundary matched.
const DISCIPLINE_ALIASES = [
  // Performers
  { pattern: /\b(actor|actress|acting)\b/i, names: ["Actor"] },
  // "performer" stands alone, "performed" / "performing" / "appeared"
  // are verb-context for an actor. Catches bios that describe roles
  // without ever using the word "actor" ("performed as Hamlet at...",
  // "is a performer based in...", "appeared in dozens of productions").
  { pattern: /\bperformer\b/i, names: ["Actor"] },
  { pattern: /\bperformed\b/i, names: ["Actor"] },
  { pattern: /\bperforming\b/i, names: ["Actor"] },
  { pattern: /\bappeared (in|on|with|at)\b/i, names: ["Actor"] },
  { pattern: /\b(voice over|voice-over|voiceover|vo artist|voice actor)\b/i, names: ["Voice Actor"] },
  { pattern: /\b(singer|vocalist|singing)\b/i, names: ["Singer / Vocalist"] },
  { pattern: /\b(dancer|dancing)\b/i, names: ["Dancer"] },
  { pattern: /\b(musical theatre|music theatre performer|musical theater)\b/i, names: ["Musical Theatre Performer"] },
  { pattern: /\b(ensemble|ensemble performer)\b/i, names: ["Ensemble Performer"] },
  { pattern: /\b(swing performer|swing role)\b/i, names: ["Swing"] },
  { pattern: /\b(understudy|understudying)\b/i, names: ["Understudy"] },
  { pattern: /\b(improviser|improvising|improv)\b/i, names: ["Improviser"] },
  { pattern: /\b(circus performer|circus artist|aerialist)\b/i, names: ["Circus Performer"] },
  { pattern: /\b(puppeteer|puppetry)\b/i, names: ["Puppeteer"] },
  { pattern: /\b(deviser|devised theatre|devising)\b/i, names: ["Deviser"] },

  // Direction / leadership.
  // Standalone "director" is too easy a false positive (it shows up
  // inside "Marketing Director", "Music Director", "Director of X",
  // etc.). Rely on verb forms ("directing" / "directed") and the
  // multi-word patterns below to catch the right contexts.
  { pattern: /\b(directing|directed)\b/i, names: ["Director"] },
  { pattern: /\bassistant director\b/i, names: ["Assistant Director"] },
  { pattern: /\bassociate director\b/i, names: ["Associate Director"] },
  { pattern: /\bartistic director\b/i, names: ["Artistic Director"] },
  { pattern: /\bcasting director\b/i, names: ["Casting Director"] },
  { pattern: /\b(music director|musical director|md\b)/i, names: ["Music Director"] },
  { pattern: /\b(choreographer|choreographing|choreography)\b/i, names: ["Choreographer"] },
  { pattern: /\bassistant choreographer\b/i, names: ["Assistant Choreographer"] },
  { pattern: /\b(intimacy director|intimacy coordinator)\b/i, names: ["Intimacy Director"] },
  { pattern: /\b(fight director|fight choreographer)\b/i, names: ["Fight Director"] },
  { pattern: /\bmovement director\b/i, names: ["Movement Director"] },

  // Design
  { pattern: /\b(scenic designer|set designer|scenic design|set design)\b/i, names: ["Scenic Designer"] },
  { pattern: /\b(lighting designer|lighting design|\bld\b)\b/i, names: ["Lighting Designer"] },
  { pattern: /\b(costume designer|costume design)\b/i, names: ["Costume Designer"] },
  { pattern: /\b(sound designer|sound design)\b/i, names: ["Sound Designer"] },
  { pattern: /\b(projection designer|projection design)\b/i, names: ["Projection Designer"] },
  { pattern: /\bvideo designer\b/i, names: ["Video Designer"] },
  { pattern: /\b(props designer|props design|properties designer)\b/i, names: ["Props Designer"] },
  { pattern: /\bprops master\b/i, names: ["Props Master"] },
  { pattern: /\b(makeup designer|hair (and|&) makeup designer)\b/i, names: ["Makeup Designer"] },
  { pattern: /\bmakeup artist\b/i, names: ["Makeup Artist (Run Crew)"] },
  { pattern: /\bwig designer\b/i, names: ["Wig Designer"] },
  { pattern: /\bhair designer\b/i, names: ["Hair Designer"] },
  { pattern: /\bgraphic designer\b/i, names: ["Graphic Designer"] },

  // Stage management
  { pattern: /\b(stage manager|stage management|\bsm\b)\b/i, names: ["Stage Manager"] },
  { pattern: /\b(assistant stage manager|\basm\b)\b/i, names: ["Assistant Stage Manager"] },
  { pattern: /\bproduction stage manager|psm\b/i, names: ["Production Stage Manager"] },
  { pattern: /\bproduction manager\b/i, names: ["Production Manager"] },
  { pattern: /\bcompany manager\b/i, names: ["Company Manager"] },

  // Crew / tech
  { pattern: /\b(technical director|\btd\b)\b/i, names: ["Technical Director"] },
  { pattern: /\bassistant technical director\b/i, names: ["Assistant Technical Director"] },
  { pattern: /\b(carpenter|scenic carpenter|build crew)\b/i, names: ["Scenic Carpenter"] },
  { pattern: /\bmaster carpenter\b/i, names: ["Master Carpenter"] },
  { pattern: /\b(electrician|electrics|theatrical electrician)\b/i, names: ["Theatrical Electrician"] },
  { pattern: /\bmaster electrician\b/i, names: ["Master Electrician"] },
  { pattern: /\b(sound (engineer|op|mixer)|a1)\b/i, names: ["A1 / Sound Engineer"] },
  { pattern: /\b(stitcher|seamstress|tailor|costume shop)\b/i, names: ["Stitcher / Seamstress / Tailor"] },
  { pattern: /\b(dresser)\b/i, names: ["Dresser"] },
  { pattern: /\bwardrobe (supervisor|head)\b/i, names: ["Wardrobe Supervisor"] },
  { pattern: /\brun crew\b/i, names: ["Run Crew"] },
  { pattern: /\bdeck crew\b/i, names: ["Deck Crew"] },
  { pattern: /\bfly crew\b/i, names: ["Fly Crew"] },
  { pattern: /\b(light board op|lighting board op)\b/i, names: ["Light Board Operator"] },
  { pattern: /\b(sound board op)\b/i, names: ["Sound Board Operator"] },
  { pattern: /\bfollow spot\b/i, names: ["Follow Spot Operator"] },
  { pattern: /\btheatrical rigger|rigging\b/i, names: ["Theatrical Rigger"] },
  { pattern: /\bscenic artist|scenic painter\b/i, names: ["Scenic Artist / Painter"] },

  // Music
  { pattern: /\bcomposer|composing\b/i, names: ["Composer"] },
  { pattern: /\barranger|arrangements\b/i, names: ["Arranger"] },
  { pattern: /\borchestrator\b/i, names: ["Orchestrator"] },
  { pattern: /\blyricist\b/i, names: ["Lyricist"] },
  { pattern: /\bconductor\b/i, names: ["Conductor"] },
  { pattern: /\bpit musician\b/i, names: ["Pit Musician"] },
  { pattern: /\brehearsal pianist\b/i, names: ["Rehearsal Pianist"] },

  // Writing / producing
  { pattern: /\b(playwright|playwriting|wrote (the )?play)\b/i, names: ["Playwright"] },
  { pattern: /\b(dramaturg|dramaturgy)\b/i, names: ["Dramaturg"] },
  { pattern: /\b(producing|produced (the )?(show|production))\b/i, names: ["Producer"] },
  { pattern: /\bproducer\b/i, names: ["Producer"] },
  { pattern: /\bexecutive producer\b/i, names: ["Executive Producer"] },
  { pattern: /\bassociate producer\b/i, names: ["Associate Producer"] },
  { pattern: /\badapter|adaptation\b/i, names: ["Adapter"] },
  { pattern: /\btranslator\b/i, names: ["Translator (Theatre)"] },
  { pattern: /\bscript doctor\b/i, names: ["Script Doctor"] },

  // Coaches
  { pattern: /\bdialect coach\b/i, names: ["Dialect Coach"] },
  { pattern: /\bvocal coach\b/i, names: ["Vocal Coach"] },
  { pattern: /\bacting coach\b/i, names: ["Acting Coach"] },
  { pattern: /\bmovement coach\b/i, names: ["Movement Coach"] },

  // Education / admin
  { pattern: /\b(teaching artist|theatre educator|theater educator)\b/i, names: ["Teaching Artist"] },
  { pattern: /\bworkshop facilitator\b/i, names: ["Workshop Facilitator"] },
  { pattern: /\bgeneral manager\b/i, names: ["General Manager"] },
  { pattern: /\bdevelopment director\b/i, names: ["Development Director"] },
  { pattern: /\bmarketing director\b/i, names: ["Marketing Director"] },
  { pattern: /\bgrant writer\b/i, names: ["Grant Writer"] },
  { pattern: /\bbox office\b/i, names: ["Box Office Manager"] },
  { pattern: /\bhouse manager\b/i, names: ["House Manager"] },
  { pattern: /\busher\b/i, names: ["Usher"] },

  // Documentation
  { pattern: /\bproduction photographer\b/i, names: ["Production Photographer"] },
  { pattern: /\bvideographer\b/i, names: ["Videographer / Archivist"] },
];

// Skipped in the canonical-list fallback because they're either too
// generic ("Other"), match too loosely ("Crew", "Technician"), or are
// catch-all placeholders that artists pick deliberately rather than
// being a thing inferable from prose.
const CANONICAL_SKIP = new Set([
  "Other",
  "Crew",
  "Designer (General)",
  "Performer (General)",
  "Technician",
  "Technician (General)",
]);

function inferDisciplines(bio, canonical) {
  if (!bio) return [];

  // Two-pass approach to avoid leaks like "Marketing Director" tagging
  // both Marketing Director AND Director:
  //   1. Run multi-word "specific" alias patterns first, recording the
  //      matched spans.
  //   2. Replace those spans with spaces in a working copy of the bio.
  //   3. Run the rest of the alias patterns + canonical-list fallback
  //      against the reduced text, so single-word fallbacks ("Director",
  //      "Actor") can't re-match inside an already-consumed span.
  const found = new Set();
  let working = bio;

  function consume(re) {
    if (!re.test(working)) return false;
    // Replace every match with same-length whitespace so other patterns
    // that depend on offsets / boundaries don't shift.
    working = working.replace(new RegExp(re.source, re.flags + "g"), (m) =>
      " ".repeat(m.length),
    );
    return true;
  }

  // Specific patterns first - sorted by source length (longest = most
  // specific). Single-word fallback patterns get processed last.
  const sorted = [...DISCIPLINE_ALIASES].sort(
    (a, b) => b.pattern.source.length - a.pattern.source.length,
  );
  for (const { pattern, names } of sorted) {
    if (consume(pattern)) {
      for (const n of names) found.add(n);
    }
  }

  // Canonical-list fallback: pick up the long tail. Skip the known
  // false-positive prone names. Word-boundary, case-insensitive.
  for (const name of canonical) {
    if (CANONICAL_SKIP.has(name)) continue;
    const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const re = new RegExp(`\\b${escaped}\\b`, "i");
    if (re.test(working)) found.add(name);
  }
  return [...found].filter((d) => canonical.includes(d));
}

function parseMeta(text) {
  const out = {};
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const colon = trimmed.indexOf(":");
    if (colon === -1) continue;
    const key = trimmed.slice(0, colon).trim().toLowerCase();
    const val = trimmed.slice(colon + 1).trim();
    if (key && val) out[key] = val;
  }
  return out;
}

function splitList(s) {
  return s
    .split(/[,;\n]+/)
    .map((x) => x.trim())
    .filter(Boolean);
}

// Mirror of src/lib/util/url.ts (inlined here so the .mjs script doesn't
// need to import from $lib). Without normalisation, a value like
// "harryturpin.com" gets used as-is on the profile page and the browser
// treats it as a relative path.
function normalizeUrl(input) {
  const v = String(input ?? "").trim();
  if (!v) return "";
  if (v.startsWith("/") && !v.startsWith("//")) return v;
  if (/^[a-z][a-z0-9+.-]*:/i.test(v)) return v;
  if (v.startsWith("//")) return "https:" + v;
  return "https://" + v;
}

function slugify(name) {
  return name
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 60);
}

async function uniqueSlug(db, base) {
  let slug = base;
  let n = 2;
  while (true) {
    const r = await db.query(`select 1 from profiles where slug = $1`, [slug]);
    if (r.rowCount === 0) return slug;
    slug = `${base}-${n}`;
    n++;
  }
}

function titleCaseFromFilename(filename) {
  const base = filename.replace(/\.[^.]+$/, "");
  const words = base.replace(/[_\-]+/g, " ").trim();
  if (!words || /^resume$/i.test(words)) return "Resume";
  return words
    .split(/\s+/)
    .map((w) => (w.length <= 3 ? w.toUpperCase() : w[0].toUpperCase() + w.slice(1).toLowerCase()))
    .join(" ");
}

function cloudinarySign(params, secret) {
  const stringToSign =
    Object.keys(params)
      .sort()
      .map((k) => `${k}=${params[k]}`)
      .join("&") + secret;
  return createHash("sha1").update(stringToSign).digest("hex");
}

async function uploadToCloudinary(filePath, opts) {
  // opts.folder ('headshots' or 'resumes'), opts.resourceType ('image' or 'raw'),
  // opts.transformation (optional, image only)
  const timestamp = Math.floor(Date.now() / 1000);
  const params = { folder: opts.folder, timestamp: String(timestamp) };
  if (opts.transformation) params.transformation = opts.transformation;
  const signature = cloudinarySign(params, env.apiSecret);

  const fileBytes = readFileSync(filePath);
  const form = new FormData();
  form.append("file", new Blob([fileBytes]), basename(filePath));
  form.append("api_key", env.apiKey);
  form.append("timestamp", String(timestamp));
  form.append("signature", signature);
  form.append("folder", opts.folder);
  if (opts.transformation) form.append("transformation", opts.transformation);

  const url = `https://api.cloudinary.com/v1_1/${env.cloudName}/${opts.resourceType}/upload`;
  const resp = await fetch(url, { method: "POST", body: form });
  if (!resp.ok) {
    const txt = await resp.text();
    throw new Error(`Cloudinary upload failed (${resp.status}): ${txt.slice(0, 300)}`);
  }
  const json = await resp.json();
  return json.secure_url;
}

function readFolder(folderPath) {
  const entries = readdirSync(folderPath);
  let bioPath = null;
  let metaPath = null;
  let imagePath = null;
  const pdfPaths = [];
  const docxPaths = [];
  for (const name of entries) {
    const full = join(folderPath, name);
    if (statSync(full).isDirectory()) continue;
    const lower = name.toLowerCase();
    const ext = extname(lower);
    if (lower === "bio.txt" || lower === "bio.md") bioPath = full;
    else if (lower === "meta.txt") metaPath = full;
    else if (IMAGE_EXTS.has(ext) && !imagePath) imagePath = full;
    else if (ext === PDF_EXT) pdfPaths.push(full);
    else if (ext === DOCX_EXT) docxPaths.push(full);
  }
  // Convert any .docx files to PDF and add to the pdf list. Skips
  // already-converted siblings (idempotent on rerun).
  for (const docx of docxPaths) {
    const converted = convertDocxToPdf(docx);
    if (converted && !pdfPaths.includes(converted)) {
      pdfPaths.push(converted);
    }
  }
  return { bioPath, metaPath, imagePath, pdfPaths };
}

async function loadCanonicalDisciplines(db) {
  const r = await db.query(`select name from disciplines order by name`);
  return r.rows.map((x) => x.name);
}

async function loadCanonicalAreas(db) {
  const r = await db.query(`select name from areas order by sort_order`);
  return r.rows.map((x) => x.name);
}

function matchArea(input, areas) {
  if (!input) return null;
  const lower = input.toLowerCase();
  // Exact (case-insensitive) match first
  for (const a of areas) if (a.toLowerCase() === lower) return a;
  // Contains check ('Tacoma' in 'Tacoma area')
  for (const a of areas) if (a.toLowerCase().includes(lower) || lower.includes(a.toLowerCase().split(" ")[0])) return a;
  return null;
}

function parseAgeRange(s) {
  if (!s) return [null, null];
  const m = s.match(/(\d{1,3})\s*[-–to]+\s*(\d{1,3})/);
  if (!m) return [null, null];
  const a = Number(m[1]);
  const b = Number(m[2]);
  if (a >= 0 && b <= 120 && a <= b) return [a, b];
  return [null, null];
}

async function importFolder(db, folderName) {
  const folderPath = join(IMPORTS_DIR, folderName);
  const fullName = folderName.trim();
  const { bioPath, metaPath, imagePath, pdfPaths } = readFolder(folderPath);
  const bio = bioPath ? readFileSync(bioPath, "utf-8").trim() : null;
  const meta = metaPath ? parseMeta(readFileSync(metaPath, "utf-8")) : {};

  const canonical = await loadCanonicalDisciplines(db);
  const areas = await loadCanonicalAreas(db);

  // Disciplines: explicit meta wins; otherwise infer from bio.
  // Meta values match case-insensitively against the canonical list and
  // are normalised to the canonical capitalisation - so "actor" or
  // "ACTOR" both end up as "Actor" in the DB.
  // Common shorthand for canonical disciplines. People emailing in
  // bios won't necessarily spell out "Performer (General)" or
  // "Educator (General)" - those parens are admin-side schema
  // bookkeeping, not how artists describe themselves. Map the
  // intuitive short forms to the canonical names so the meta.txt
  // doesn't silently drop them.
  const DISCIPLINE_ALIASES = {
    performer: "Performer (General)",
    educator: "Educator (General)",
    teacher: "Educator (General)",
    designer: "Designer (General)",
    technician: "Technician (General)",
    // Common typos seen during launch import:
    choreophrapher: "Choreographer",
  };

  let disciplines = [];
  let inferredDisciplines = false;
  let unmatchedDisciplines = []; // surfaced in console + results.csv
  if (meta.disciplines) {
    const canonicalLower = new Map(canonical.map((c) => [c.toLowerCase(), c]));
    const supplied = splitList(meta.disciplines);
    for (const d of supplied) {
      const lower = d.toLowerCase();
      const hit = canonicalLower.get(lower) ?? DISCIPLINE_ALIASES[lower];
      if (hit) disciplines.push(hit);
      else unmatchedDisciplines.push(d);
    }
    // Dedupe in case the alias resolves to a discipline already in
    // the list (e.g. "Performer, Performer (General)").
    disciplines = [...new Set(disciplines)];
    if (unmatchedDisciplines.length > 0) {
      console.warn(
        `  ! ${folderName}: meta.txt disciplines not in canonical list (dropped): ${unmatchedDisciplines.join(", ")}. Add via /admin/disciplines or update meta.txt to match.`,
      );
    }
  } else if (bio) {
    disciplines = inferDisciplines(bio, canonical);
    inferredDisciplines = disciplines.length > 0;
  }

  const matchedArea = matchArea(meta.area, areas);
  const [ageMin, ageMax] = parseAgeRange(meta.playable_age);
  const languages = meta.languages ? splitList(meta.languages) : [];
  const unions = meta.unions ? splitList(meta.unions) : [];
  const ethnicities = meta.ethnicities ? splitList(meta.ethnicities) : [];

  const baseSlug = slugify(fullName);

  // Dedupe guard: if a profile already exists with this person's email
  // (from meta.txt) OR the same base slug, skip the row instead of
  // creating a duplicate -2 / -3 / etc. The folder can sit alongside
  // already-imported ones across multiple runs without producing
  // duplicates each time. Only triggers when meta supplies a real
  // email; placeholder emails would all collide on the same shared
  // domain.
  if (meta.email) {
    const existingByEmail = await db.query(
      `select slug from profiles where email = $1::text limit 1`,
      [meta.email.toLowerCase()],
    );
    if (existingByEmail.rowCount > 0) {
      return {
        folder: folderName,
        slug: existingByEmail.rows[0].slug,
        full_name: fullName,
        email: meta.email.toLowerCase(),
        email_is_placeholder: false,
        has_bio: !!bio,
        has_headshot: !!imagePath,
        resume_count: pdfPaths.length,
        disciplines,
        inferred_disciplines: inferredDisciplines,
        unmatched_disciplines: unmatchedDisciplines.join("|"),
        area: matchedArea ?? "",
        status: "skipped_existing",
        missing_required: "",
        edit_url: "[skipped - profile exists]",
      };
    }
  }
  const existingBySlug = await db.query(
    `select slug from profiles where slug = $1::text limit 1`,
    [baseSlug],
  );
  // If the slug is taken AND there's no email to match on, refuse to
  // auto-suffix - that's how we ended up with -2 dups before. Surface
  // it so Lexi can decide manually.
  if (existingBySlug.rowCount > 0 && !meta.email) {
    return {
      folder: folderName,
      slug: baseSlug,
      full_name: fullName,
      email: "",
      email_is_placeholder: true,
      has_bio: !!bio,
      has_headshot: !!imagePath,
      resume_count: pdfPaths.length,
      disciplines,
      inferred_disciplines: inferredDisciplines,
      unmatched_disciplines: unmatchedDisciplines.join("|"),
      area: matchedArea ?? "",
      status: "skipped_slug_collision",
      missing_required: "no email to dedupe on",
      edit_url: "[skipped - slug already exists, add email to meta.txt to dedupe]",
    };
  }
  const slug = await uniqueSlug(db, baseSlug);

  // Email is NOT NULL in the schema. Use a placeholder when missing so
  // the import doesn't fail. Flagged in the results CSV so you know
  // which ones need a real email later.
  const email = meta.email
    ? meta.email.toLowerCase()
    : `import+${slug}@unknown.ssta.local`;
  const emailIsPlaceholder = !meta.email;

  // Required-to-publish gate: must have at least one discipline AND an
  // area. Otherwise the row imports as a hidden draft.
  const canPublish = disciplines.length > 0 && !!matchedArea;
  const missingRequired = [];
  if (disciplines.length === 0) missingRequired.push("disciplines");
  if (!matchedArea) missingRequired.push("area");

  let headshotUrl = null;
  if (imagePath && !DRY_RUN) {
    // Cloudinary's 10MB cap is on the inbound payload, not the
    // post-transformation output, so we have to resize before uploading.
    const sized = ensureImageUnderCap(imagePath);
    headshotUrl = await uploadToCloudinary(sized, {
      folder: "headshots",
      resourceType: "image",
      transformation: "c_limit,w_1200,h_1200,q_auto,f_auto",
    });
  } else if (imagePath && DRY_RUN) {
    headshotUrl = "[would upload]";
  }

  const resumes = [];
  for (const pdfPath of pdfPaths) {
    if (DRY_RUN) {
      resumes.push({
        label: titleCaseFromFilename(basename(pdfPath)),
        url: "[would upload]",
      });
      continue;
    }
    const url = await uploadToCloudinary(pdfPath, {
      folder: "resumes",
      resourceType: "raw",
    });
    resumes.push({ label: titleCaseFromFilename(basename(pdfPath)), url });
  }

  let editUrl = null;
  if (!DRY_RUN) {
    // Insert profile.
    const ins = await db.query(
      `insert into profiles
        (slug, full_name, email, phone, bio, disciplines, headshot_url,
         headshot_consent, geographic_area, city, pronouns,
         playable_age_min, playable_age_max, languages, unions,
         ethnicities, instagram_handle, facebook_url, tiktok_handle,
         linkedin_url, twitter_handle, youtube_url, website_url,
         resumes, trusted, published)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26)
       returning id`,
      [
        slug,
        fullName,
        email,
        // Optional from meta.txt. Privacy boundary: never rendered
        // publicly, only seeded so artists who already shared a number
        // don't have to re-enter when they get their edit link.
        meta.phone?.trim() || null,
        bio,
        disciplines,
        headshotUrl,
        !!headshotUrl,
        matchedArea,
        meta.city ?? null,
        meta.pronouns ?? null,
        ageMin,
        ageMax,
        languages,
        unions,
        ethnicities,
        meta.instagram ?? null,
        normalizeUrl(meta.facebook) || null,
        meta.tiktok ?? null,
        normalizeUrl(meta.linkedin) || null,
        meta.twitter ?? null,
        normalizeUrl(meta.youtube) || null,
        normalizeUrl(meta.website) || null,
        JSON.stringify(resumes),
        TRUST_ALL,
        canPublish,
      ],
    );
    const profileId = ins.rows[0].id;

    // Generate a single-use 30-day edit token. Saved to results CSV so
    // it can be mail-merged out later when ready - NOT emailed during
    // the import.
    const token = randomBytes(32).toString("base64url");
    const tokenHash = createHash("sha256").update(token).digest("hex");
    const expires = new Date(Date.now() + EDIT_TOKEN_TTL_MS).toISOString();
    await db.query(
      `insert into magic_link_tokens
         (token_hash, email, purpose, target_id, expires_at)
       values ($1, $2, 'edit_profile', $3, $4)`,
      [tokenHash, email, profileId, expires],
    );
    editUrl = `${env.siteUrl}/edit/${token}`;
  }

  return {
    folder: folderName,
    slug,
    full_name: fullName,
    email,
    email_is_placeholder: emailIsPlaceholder,
    has_bio: !!bio,
    has_headshot: !!imagePath,
    resume_count: pdfPaths.length,
    disciplines,
    inferred_disciplines: inferredDisciplines,
    unmatched_disciplines: unmatchedDisciplines.join("|"),
    area: matchedArea ?? "",
    status: canPublish ? "published" : "hidden_draft",
    missing_required: missingRequired.join("|"),
    edit_url: editUrl ?? "[dry-run]",
  };
}

function csvEscape(v) {
  const s = String(v ?? "");
  if (/[,"\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

async function main() {
  let folders = [];
  try {
    folders = readdirSync(IMPORTS_DIR).filter((name) => {
      if (name.startsWith("_")) return false; // skip _results.csv etc.
      if (name.toLowerCase() === "template") return false; // working template
      // "past" folder = artists already imported, kept on disk for
      // reference. Dedup-by-email check still fires for anything
      // that wasn't moved here, so a forgotten move-to-past is a
      // skip-not-duplicate, not a dupe insert.
      if (name.toLowerCase() === "past") return false;
      const full = join(IMPORTS_DIR, name);
      return statSync(full).isDirectory();
    });
  } catch (err) {
    fail(`Could not read ${IMPORTS_DIR}/: ${err.message}`);
  }

  if (folders.length === 0) {
    console.log(`No folders found in ${IMPORTS_DIR}/`);
    return;
  }

  console.log(
    `${DRY_RUN ? "[DRY RUN] " : ""}Importing ${folders.length} folder(s) from ${IMPORTS_DIR}/`,
  );

  const db = new Client({
    connectionString: env.db,
    ssl: { rejectUnauthorized: false },
  });
  await db.connect();

  const results = [];
  for (const folder of folders) {
    try {
      const result = await importFolder(db, folder);
      results.push(result);
      const flag =
        result.status === "published"
          ? "✓"
          : result.status === "skipped_existing"
          ? "skip"
          : result.status === "skipped_slug_collision"
          ? "skip"
          : "draft";
      console.log(
        `  ${flag} ${folder} -> ${result.slug} (${result.disciplines.length} disciplines${result.inferred_disciplines ? ", inferred" : ""}, ${result.resume_count} resume(s)${result.missing_required ? `, missing: ${result.missing_required}` : ""})`,
      );
    } catch (err) {
      console.error(`  ! ${folder} FAILED: ${err.message}`);
      results.push({
        folder,
        slug: "",
        status: "error",
        missing_required: "",
        edit_url: "",
        full_name: folder,
        email: "",
        email_is_placeholder: false,
        has_bio: false,
        has_headshot: false,
        resume_count: 0,
        disciplines: [],
        inferred_disciplines: false,
        unmatched_disciplines: "",
        area: "",
        error: err.message,
      });
    }
  }

  await db.end();

  const headers = [
    "folder",
    "slug",
    "status",
    "full_name",
    "email",
    "email_is_placeholder",
    "has_bio",
    "has_headshot",
    "resume_count",
    "disciplines",
    "inferred_disciplines",
    "unmatched_disciplines",
    "area",
    "missing_required",
    "edit_url",
    "error",
  ];
  const lines = [headers.join(",")];
  for (const r of results) {
    lines.push(
      headers
        .map((h) => {
          if (h === "disciplines") return csvEscape(r.disciplines.join(", "));
          return csvEscape(r[h]);
        })
        .join(","),
    );
  }
  writeFileSync(RESULTS_CSV, lines.join("\n") + "\n");

  const drafts = results.filter((r) => r.status === "hidden_draft").length;
  const published = results.filter((r) => r.status === "published").length;
  const skipped = results.filter((r) => r.status?.startsWith("skipped")).length;
  const errors = results.filter((r) => r.status === "error").length;
  const ok = drafts + published;
  console.log("");
  console.log(
    `Done. ${ok} imported (${published} published, ${drafts} drafts), ${skipped} skipped, ${errors} error(s). See ${RESULTS_CSV}.`,
  );
  if (DRY_RUN) console.log("(Dry run - no rows actually written. Re-run without --dry-run to import.)");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
