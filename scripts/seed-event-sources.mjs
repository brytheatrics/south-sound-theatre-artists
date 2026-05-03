// scripts/seed-event-sources.mjs
//
// Seed the event_sources table with the 16 orgs validated in Phase 0.5.
// Idempotent: re-running updates existing rows by org_slug. Source URLs
// were chosen for stability where possible (e.g. Harlequin /season/ which
// auto-redirects to the current year, Mustard Seed CSSTix root); orgs
// where only annual-slug URLs work are tagged in `notes` so admin knows
// they need a yearly URL update.
//
// Run:
//   node scripts/seed-event-sources.mjs           # apply (idempotent)
//   node scripts/seed-event-sources.mjs --dry-run # preview without DB writes

import { config as loadDotenv } from "dotenv";
import pg from "pg";

loadDotenv({ override: true });

const { Client } = pg;

// Each source is tagged with the area name from the `areas` table; the
// seed resolves area_id at insert time so this file stays human-readable.
const SOURCES = [
  // Tacoma / Pierce County
  { slug: "tlt", name: "Tacoma Little Theatre", area: "Tacoma / Pierce County",
    url: "https://www.tacomalittletheatre.com/blog/tag/2025-2026",
    notes: "Annual blog-tag slug; update to /blog/tag/<season-year> each year." },
  { slug: "lakewood", name: "Lakewood Playhouse", area: "Tacoma / Pierce County",
    url: "https://www.lakewoodplayhouse.org/season-87.html",
    notes: "Annual season number; update /season-N.html each year." },
  { slug: "tmp", name: "Tacoma Musical Playhouse", area: "Tacoma / Pierce County",
    url: "https://www.tmp.org/season-and-show-tickets",
    notes: "Stable URL." },
  { slug: "mustardseed", name: "Mustard Seed Theater Company", area: "Tacoma / Pierce County",
    url: "https://mustardseedtheater.csstix.com/",
    notes: "CSSTix root - lists current event automatically." },

  // South Pierce (Puyallup / Sumner)
  { slug: "manestage", name: "ManeStage Theatre Company", area: "South Pierce",
    url: "https://www.manestagetheatre.com/buy-tickets",
    notes: "Sumner. /buy-tickets is the canonical schedule page (not /current-season)." },

  // Olympia / Thurston County
  { slug: "harlequin", name: "Harlequin Productions", area: "Olympia / Thurston County",
    url: "https://harlequinproductions.org/season/",
    notes: "Stable URL - /season/ redirects to current year automatically." },
  { slug: "tao", name: "Theater Artists Olympia", area: "Olympia / Thurston County",
    url: "https://www.olytheater.com/calendar",
    notes: "Stable URL. Wix Events per-performance listing." },
  { slug: "animalfire", name: "Animal Fire Theatre", area: "Olympia / Thurston County",
    url: "https://animalfiretheatre.com/",
    notes: "Stable URL - homepage hero. Single annual production." },
  { slug: "evergreen", name: "Evergreen Playhouse", area: "Olympia / Thurston County",
    url: "https://app.arts-people.com/index.php?ticketing=tep",
    notes: "Centralia (Lewis County). Arts People stable code." },
  { slug: "olt", name: "Olympia Little Theatre", area: "Olympia / Thurston County",
    url: "https://app.arts-people.com/index.php?ticketing=olylt",
    notes: "Arts People; stable code." },
  { slug: "oft", name: "Olympia Family Theater", area: "Olympia / Thurston County",
    url: "https://app.arts-people.com/index.php?ticketing=olyft",
    notes: "Arts People; stable code." },

  // South King
  { slug: "bat", name: "Burien Actors Theatre", area: "South King County",
    url: "https://battheatre.org/this-season/",
    notes: "Stable URL. Detail crawls per show." },
  { slug: "emerald", name: "Emerald Theatre", area: "South King County",
    url: "https://www.emeraldtheatre.org/current-production",
    notes: "Stable URL. Single annual outdoor summer production." },
  { slug: "auburn", name: "Auburn Community Players", area: "South King County",
    url: "https://app.arts-people.com/index.php?ticketing=coapa",
    notes: "Arts People (City of Auburn Parks & Arts code 'coapa')." },

  // Kitsap
  { slug: "jewelbox", name: "Jewel Box Theatre", area: "Gig Harbor / Kitsap",
    url: "https://app.arts-people.com/index.php?show=287501",
    notes: "Poulsbo. Per-show URL - update to next show ID when current run ends." },
  { slug: "bremerton", name: "Bremerton Community Theatre", area: "Gig Harbor / Kitsap",
    url: "https://app.arts-people.com/index.php?ticketing=brmct",
    notes: "Arts People; stable code." },
];

function parseArgs() {
  return { dryRun: process.argv.includes("--dry-run") };
}

async function main() {
  const args = parseArgs();
  const url = process.env.SUPABASE_DB_URL;
  if (!url) {
    console.error("SUPABASE_DB_URL not set");
    process.exit(1);
  }
  const db = new Client({ connectionString: url, ssl: { rejectUnauthorized: false } });
  await db.connect();

  // Resolve area names -> ids in one query so per-source inserts are
  // simple. Areas are seeded by migration 002; this just looks them up.
  const areasRes = await db.query(`select id, name from public.areas`);
  const areaIdByName = new Map(areasRes.rows.map((r) => [r.name, r.id]));

  console.log(
    `Seeding ${SOURCES.length} event_sources rows${args.dryRun ? " (DRY RUN)" : ""}`,
  );

  let inserted = 0;
  let updated = 0;
  for (const s of SOURCES) {
    const areaId = areaIdByName.get(s.area);
    if (!areaId) {
      console.error(`  !  ${s.slug}: area "${s.area}" not found in areas table; skipping`);
      continue;
    }
    if (args.dryRun) {
      console.log(`  [dry] ${s.slug} (${s.area}) -> ${s.url}`);
      continue;
    }
    const res = await db.query(
      `insert into public.event_sources
         (org_slug, org_name, source_url, adapter, cadence_days, notes, area_id, active)
       values ($1, $2, $3, 'ai-generic', 30, $4, $5, true)
       on conflict (org_slug) do update
         set org_name = excluded.org_name,
             source_url = excluded.source_url,
             notes = excluded.notes,
             area_id = excluded.area_id,
             updated_at = now()
       returning (xmax = 0) as inserted`,
      [s.slug, s.name, s.url, s.notes, areaId],
    );
    if (res.rows[0].inserted) {
      inserted++;
      console.log(`  +  ${s.slug} (${s.area}): inserted`);
    } else {
      updated++;
      console.log(`  ~  ${s.slug} (${s.area}): updated`);
    }
  }

  console.log(`\nDone. ${inserted} inserted, ${updated} updated.`);
  await db.end();
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
