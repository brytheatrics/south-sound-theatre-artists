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

// Each source is tagged with an `adapter` (default 'ai-generic' below)
// plus the area name from the `areas` table; the seed resolves area_id
// at insert time so this file stays human-readable.
// Notes are written for Lexi (operator-facing, not developer-facing).
// Plain English; no code references, no implementation jargon. Dev
// context (e.g. how the Ludus / OvationTix / Squarespace-JSON / Eventbrite
// adapters work) lives in commit messages + the adapter source files,
// not on the row.
//
// Adapters:
//   - ai-generic: fetch HTML + Claude extraction. Default for orgs that
//     publish their season as readable text on a single page.
//   - squarespace-json: fetch /events?format=json. Faster + more
//     reliable than scraping Squarespace HTML when the org's site
//     uses Squarespace's events collection.
//   - ovationtix: render ci.ovationtix.com/{accountId} via headless
//     Chromium then Claude-extract. Needed because OvationTix is a
//     JS-rendered SPA.
//   - ludus: render {org}.ludus.com via headless Chromium then
//     Claude-extract. Ludus puts its pages behind a Cloudflare JS
//     challenge that direct fetches can't pass.
//   - eventbrite: render eventbrite.com/o/{organizerId} via headless
//     Chromium then Claude-extract. Mostly for orgs that ticket
//     exclusively via Eventbrite.
//   - manual: skipped by the cron. Listed for admin visibility only.
const SOURCES = [
  // Tacoma / Pierce County
  { slug: "tlt", name: "Tacoma Little Theatre", area: "Tacoma / Pierce County",
    adapter: "ludus",
    url: "https://tlt.ludus.com/",
    notes: "Tacoma. Pulls automatically through their Ludus ticketing page. Should stay stable as long as they keep using Ludus." },
  { slug: "lakewood", name: "Lakewood Playhouse", area: "Tacoma / Pierce County",
    url: "https://www.lakewoodplayhouse.org/season-87.html",
    notes: "Lakewood. Pulls automatically. Once a year (around when their new season is announced), the URL above stops working — update the season number in the URL (e.g. from 'season-87.html' to 'season-88.html')." },
  { slug: "tmp", name: "Tacoma Musical Playhouse", area: "Tacoma / Pierce County",
    url: "https://www.tmp.org/season-and-show-tickets",
    notes: "Tacoma. Pulls automatically — their season page URL stays the same year to year." },
  { slug: "mustardseed", name: "Mustard Seed Theater Company", area: "Tacoma / Pierce County",
    url: "https://mustardseedtheater.csstix.com/",
    notes: "Tacoma. Pulls automatically. They produce one show a year (their summer musical)." },
  { slug: "dukesbay", name: "Dukesbay Productions", area: "Tacoma / Pierce County",
    adapter: "eventbrite",
    url: "https://www.eventbrite.com/o/41082285963",
    notes: "Tacoma. Pulls automatically through their Eventbrite organizer page. They produce 1-3 shows a year and list each on Eventbrite." },

  // South Pierce (Puyallup / Sumner)
  { slug: "manestage", name: "ManeStage Theatre Company", area: "South Pierce",
    adapter: "ludus",
    url: "https://manestagetickets.ludus.com/",
    notes: "Puyallup. Pulls automatically through their Ludus ticketing page. Should stay stable as long as they keep using Ludus." },

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

// Promoted-from-manual orgs: now auto-pulled via dedicated adapters.
// Listed separately from SOURCES only for readability \u2014 they merge in
// at insert time with the main list.
const STRUCTURED_SOURCES = [
  { slug: "centerstage", name: "Centerstage Theatre", area: "South King County",
    adapter: "ovationtix",
    url: "https://web.ovationtix.com/trs/cal/36978",
    notes: "Federal Way. Pulls automatically through their OvationTix ticketing page (account 36978). Should stay stable as long as they keep using OvationTix." },
  { slug: "rentoncivic", name: "Renton Civic Theatre", area: "South King County",
    adapter: "ai-generic",
    url: "https://www.rentoncivictheatre.org/season-2026",
    notes: "Renton. Pulls automatically. The URL has the year in it \u2014 once a year (around when their new season is announced), update the year (e.g. from 'season-2026' to 'season-2027'). Some shows may need their performance schedule filled in manually since the season page only lists run-date ranges." },
  { slug: "bpa", name: "Bainbridge Performing Arts", area: "Gig Harbor / Kitsap",
    adapter: "squarespace-json",
    url: "https://www.bainbridgeperformingarts.org/events",
    notes: "Bainbridge Island. Pulls automatically through their Squarespace events feed. Includes mainstage productions plus concerts and rentals \u2014 the parser filters down to theatre productions." },
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

  // Per-row adapter: explicit `adapter` on the row wins; otherwise
  // SOURCES default to ai-generic and MANUAL_SOURCES default to manual.
  const all = [
    ...SOURCES.map((s) => ({ ...s, adapter: s.adapter ?? "ai-generic" })),
    ...STRUCTURED_SOURCES,
    ...MANUAL_SOURCES.map((s) => ({ ...s, adapter: "manual" })),
  ];

  console.log(
    `Seeding ${all.length} organizations rows (${SOURCES.length + STRUCTURED_SOURCES.length} auto, ${MANUAL_SOURCES.length} manual)${args.dryRun ? " (DRY RUN)" : ""}`,
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
