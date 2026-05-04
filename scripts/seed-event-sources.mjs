// scripts/seed-event-sources.mjs
//
// Seed the organizations table with the 16 orgs validated in Phase 0.5.
// Idempotent: re-running updates existing rows by slug. Source URLs
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
// Notes are written for Lexi (operator-facing, not developer-facing).
// Plain English; no code references, no implementation jargon. Dev
// context (e.g. why Centerstage needs Playwright) lives in commit
// messages + BUILD_PLAN, not on the row.
const SOURCES = [
  // Tacoma / Pierce County
  { slug: "tlt", name: "Tacoma Little Theatre", area: "Tacoma / Pierce County",
    url: "https://www.tacomalittletheatre.com/blog/tag/2025-2026",
    notes: "Tacoma. Pulls automatically. Once a year (around late summer when their new season is announced), the URL above stops working — update the year range (e.g. from '2025-2026' to '2026-2027')." },
  { slug: "lakewood", name: "Lakewood Playhouse", area: "Tacoma / Pierce County",
    url: "https://www.lakewoodplayhouse.org/season-87.html",
    notes: "Lakewood. Pulls automatically. Once a year (around when their new season is announced), the URL above stops working — update the season number in the URL (e.g. from 'season-87.html' to 'season-88.html')." },
  { slug: "tmp", name: "Tacoma Musical Playhouse", area: "Tacoma / Pierce County",
    url: "https://www.tmp.org/season-and-show-tickets",
    notes: "Tacoma. Pulls automatically — their season page URL stays the same year to year." },
  { slug: "mustardseed", name: "Mustard Seed Theater Company", area: "Tacoma / Pierce County",
    url: "https://mustardseedtheater.csstix.com/",
    notes: "Tacoma. Pulls automatically. They produce one show a year (their summer musical)." },

  // South Pierce (Puyallup / Sumner)
  { slug: "manestage", name: "ManeStage Theatre Company", area: "South Pierce",
    url: "https://www.manestagetheatre.com/buy-tickets",
    notes: "Sumner. Pulls automatically from their 'Buy Tickets' page (not their general season page — that one doesn't list specific performance dates)." },

  // Olympia / Thurston County
  { slug: "harlequin", name: "Harlequin Productions", area: "Olympia / Thurston County",
    url: "https://harlequinproductions.org/season/",
    notes: "Olympia. Pulls automatically. Their season URL stays the same year to year, so this should keep working without any maintenance." },
  { slug: "tao", name: "Theater Artists Olympia", area: "Olympia / Thurston County",
    url: "https://www.olytheater.com/calendar",
    notes: "Olympia. Pulls automatically — they keep a public calendar page that lists every performance." },
  { slug: "animalfire", name: "Animal Fire Theatre", area: "Olympia / Thurston County",
    url: "https://animalfiretheatre.com/",
    notes: "Lacey. Pulls automatically. Just one show a year (their summer outdoor Shakespeare)." },
  { slug: "evergreen", name: "Evergreen Playhouse", area: "Olympia / Thurston County",
    url: "https://app.arts-people.com/index.php?ticketing=tep",
    notes: "Centralia. Pulls automatically through their ticketing system." },
  { slug: "olt", name: "Olympia Little Theatre", area: "Olympia / Thurston County",
    url: "https://app.arts-people.com/index.php?ticketing=olylt",
    notes: "Olympia. Pulls automatically through their ticketing system." },
  { slug: "oft", name: "Olympia Family Theater", area: "Olympia / Thurston County",
    url: "https://app.arts-people.com/index.php?ticketing=olyft",
    notes: "Olympia. Pulls automatically through their ticketing system." },

  // South King
  { slug: "bat", name: "Burien Actors Theatre", area: "South King County",
    url: "https://battheatre.org/this-season/",
    notes: "Burien. Pulls automatically." },
  { slug: "emerald", name: "Emerald Theatre", area: "South King County",
    url: "https://www.emeraldtheatre.org/current-production",
    notes: "Auburn. Pulls automatically. Just one show a year (their summer outdoor production)." },
  { slug: "auburn", name: "Auburn Community Players", area: "South King County",
    url: "https://app.arts-people.com/index.php?ticketing=coapa",
    notes: "Auburn. Pulls automatically through their ticketing system. This is the city-run community theatre program." },

  // Kitsap
  { slug: "jewelbox", name: "Jewel Box Theatre", area: "Gig Harbor / Kitsap",
    url: "https://app.arts-people.com/index.php?show=287501",
    notes: "Poulsbo. Pulls automatically — but the URL above points to a specific show. When that show closes, you'll need to update the URL to whatever their next show's ticket page is." },
  { slug: "bremerton", name: "Bremerton Community Theatre", area: "Gig Harbor / Kitsap",
    url: "https://app.arts-people.com/index.php?ticketing=brmct",
    notes: "Bremerton. Pulls automatically through their ticketing system." },
];

// Manual-entry orgs: not auto-pulled by the cron. Lexi maintains them
// from /admin/calendar/new. Notes here are the operator-facing
// instructions (where to look for current shows + how to enter them).
// Cron skips these rows entirely (filtered by adapter='manual').
const MANUAL_SOURCES = [
  { slug: "theatrebattery", name: "Theatre Battery", area: "South King County",
    url: "https://www.theatrebattery.org/",
    notes: "Kent. Manually entered. They produce one show a year and often don't post specific performance dates until close to the run. Check theatrebattery.org for the latest." },
  { slug: "newmuses", name: "New Muses Theatre Company", area: "Tacoma / Pierce County",
    url: "https://www.newmuses.com/",
    notes: "Tacoma. Manually entered. They produce 1\u20133 shows a year. To find what's currently running, look in the 'Plays & Events' menu on newmuses.com." },
  { slug: "toyboat", name: "Toy Boat Theatre", area: "Tacoma / Pierce County",
    url: "https://sites.google.com/site/toyboattheatreco/home",
    notes: "Tacoma. Very low cadence \u2014 roughly one show every couple of years. Their site requires a Google login, so checking their Theatre Puget Sound directory page or social media is usually easier. Add new shows by hand if/when they announce one." },
  { slug: "screamingbutterflies", name: "Screaming Butterflies Productions", area: "Tacoma / Pierce County",
    url: "http://screamingbutterfliestheatre.org/",
    notes: "Tacoma. Manually entered. They produce ~3 shows a year, mostly staged readings. They tend to post month-only dates ('April 2026') until closer to each show \u2014 watch their social posts for specific performance times and add them by hand." },
  { slug: "nwcenter", name: "Northwest Center Theatre", area: "South Pierce",
    url: "https://northwestcenterthe.wixsite.com/nwctheatre",
    notes: "Puyallup. Brand new theatre. They post mostly on Facebook (@nwct_official). Check there for season announcements when they start producing shows." },
  { slug: "stringshadow", name: "String & Shadow Puppet Theater", area: "Olympia / Thurston County",
    url: "https://www.stringandshadow.com/",
    notes: "Olympia. Touring company. Their performances happen at partner venues (Finn River, state parks, libraries) rather than a home theatre, so the schedule is scattered. Check stringandshadow.com for current productions, then each partner venue for performance dates." },
  { slug: "centerstage", name: "Centerstage Theatre", area: "South King County",
    url: "https://centerstagetheatre.com/current-season/",
    notes: "Federal Way. Manually entered. To add a show, visit centerstagetheatre.com/current-season for the show titles, then click each show's 'Tickets' link to find the performance dates." },
  { slug: "rentoncivic", name: "Renton Civic Theatre", area: "South King County",
    url: "https://www.rentoncivictheatre.org/season-2026",
    notes: "Renton. Manually entered. To add a show, visit rentoncivictheatre.org for the show list, then go to events.rentoncivictheatre.org for performance dates." },
  { slug: "dukesbay", name: "Dukesbay Productions", area: "Tacoma / Pierce County",
    url: "https://dukesbay.org/shows/",
    notes: "Tacoma. Manually entered. They produce 1\u20133 shows a year. To add a show, check dukesbay.org/shows for the list, then click into each show's Eventbrite page for performance dates." },
  { slug: "bpa", name: "Bainbridge Performing Arts", area: "Gig Harbor / Kitsap",
    url: "https://www.bainbridgeperformingarts.org/events",
    notes: "Bainbridge Island. Manually entered. To add a show, check bainbridgeperformingarts.org/events for the schedule, then their ThunderTix per-show pages for performance dates." },
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

  const all = [
    ...SOURCES.map((s) => ({ ...s, adapter: "ai-generic" })),
    ...MANUAL_SOURCES.map((s) => ({ ...s, adapter: "manual" })),
  ];

  console.log(
    `Seeding ${all.length} organizations rows (${SOURCES.length} auto, ${MANUAL_SOURCES.length} manual)${args.dryRun ? " (DRY RUN)" : ""}`,
  );

  let inserted = 0;
  let updated = 0;
  for (const s of all) {
    const areaId = areaIdByName.get(s.area);
    if (!areaId) {
      console.error(`  !  ${s.slug}: area "${s.area}" not found in areas table; skipping`);
      continue;
    }
    if (args.dryRun) {
      console.log(`  [dry] ${s.slug} (${s.adapter}, ${s.area}) -> ${s.url}`);
      continue;
    }
    // Manual rows don't get cadence_days reset on update - and we don't
    // overwrite adapter on update either, so a row already promoted from
    // 'manual' to a real adapter (e.g. 'ovationtix') won't be reverted.
    const res = await db.query(
      `insert into public.organizations
         (slug, name, source_url, adapter, cadence_days, notes, area_id, active)
       values ($1, $2, $3, $4, 30, $5, $6, true)
       on conflict (slug) do update
         set name = excluded.name,
             source_url = excluded.source_url,
             notes = excluded.notes,
             area_id = excluded.area_id,
             updated_at = now()
       returning (xmax = 0) as inserted`,
      [s.slug, s.name, s.url, s.adapter, s.notes, areaId],
    );
    if (res.rows[0].inserted) {
      inserted++;
      console.log(`  +  ${s.slug} (${s.adapter}, ${s.area}): inserted`);
    } else {
      updated++;
      console.log(`  ~  ${s.slug} (${s.adapter}, ${s.area}): updated`);
    }
  }

  console.log(`\nDone. ${inserted} inserted, ${updated} updated.`);
  await db.end();
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
