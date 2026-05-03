// scripts/seed-theatre-metadata.mjs
//
// Populates the public-facing metadata columns on event_sources
// (description, homepage_url, public_email, logo_url) used by the
// /theatres directory page. Idempotent — re-running updates only
// non-null fields, so admin overrides made via /admin/event-sources
// are preserved across re-seeds.
//
// Run:
//   node scripts/seed-theatre-metadata.mjs           # apply
//   node scripts/seed-theatre-metadata.mjs --dry-run # preview
//   node scripts/seed-theatre-metadata.mjs --overwrite # force-replace existing values

import { config as loadDotenv } from "dotenv";
import pg from "pg";

loadDotenv({ override: true });

const { Client } = pg;

// Edit this array as Lexi (or admin) confirms metadata. Fields are
// optional individually — leaving description null on a row falls back
// to "[name] in [area]" on the cards UI.
//
// _note fields are operator-facing reminders (where data came from,
// data quality flags); they don't get written to the DB.
//
/** @type {Array<{slug: string, homepage_url?: string|null, description?: string|null, public_email?: string|null, logo_url?: string|null, _note?: string}>} */
const METADATA = [
  // === FILL ME IN AFTER RESEARCH PASS ===
  // Each entry must include slug. Other fields optional.
  // Example shape:
  // { slug: "harlequin",
  //   homepage_url: "https://harlequinproductions.org/",
  //   description: "Olympia's only year-round professional theatre, founded 1991.",
  //   public_email: "boxoffice@harlequinproductions.org",
  //   logo_url: null },
];

function parseArgs() {
  return {
    dryRun: process.argv.includes("--dry-run"),
    overwrite: process.argv.includes("--overwrite"),
  };
}

async function main() {
  const args = parseArgs();
  const url = process.env.SUPABASE_DB_URL;
  if (!url) {
    console.error("SUPABASE_DB_URL not set");
    process.exit(1);
  }
  if (METADATA.length === 0) {
    console.error("No metadata defined. Edit scripts/seed-theatre-metadata.mjs first.");
    process.exit(1);
  }

  const db = new Client({ connectionString: url, ssl: { rejectUnauthorized: false } });
  await db.connect();

  console.log(
    `Seeding metadata for ${METADATA.length} theatres${args.dryRun ? " (DRY RUN)" : ""}${args.overwrite ? " [overwrite mode]" : ""}`,
  );

  let updated = 0;
  let skipped = 0;
  for (const m of METADATA) {
    if (!m.slug) {
      console.error("  !  entry missing slug; skipping");
      continue;
    }
    // Default mode: only fill in null fields, so admin edits survive a
    // re-seed. Overwrite mode forces every non-undefined field through.
    const setClauses = [];
    const values = [m.slug];
    let i = 2;
    const fields = ["description", "homepage_url", "public_email", "logo_url"];
    for (const f of fields) {
      if (m[f] === undefined) continue;
      if (args.overwrite) {
        setClauses.push(`${f} = $${i}`);
      } else {
        // COALESCE: keep the existing value if the column is already non-null.
        setClauses.push(`${f} = coalesce(${f}, $${i})`);
      }
      values.push(m[f]);
      i++;
    }
    if (setClauses.length === 0) {
      skipped++;
      continue;
    }
    if (args.dryRun) {
      console.log(`  [dry] ${m.slug}: ${setClauses.join(", ")}`);
      continue;
    }
    const res = await db.query(
      `update public.event_sources
         set ${setClauses.join(", ")}, updated_at = now()
         where org_slug = $1
         returning org_slug`,
      values,
    );
    if (res.rowCount === 0) {
      console.error(`  !  ${m.slug}: no event_sources row found; skipping`);
    } else {
      updated++;
      console.log(`  ~  ${m.slug}: updated`);
    }
  }

  console.log(`\nDone. ${updated} updated, ${skipped} skipped.`);
  await db.end();
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
