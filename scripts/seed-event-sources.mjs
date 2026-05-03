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

// Manual-entry orgs: not auto-pulled by the cron. Lexi maintains them
// from /admin/calendar. The source_url here is just where she checks
// for new shows; cron skips these rows entirely (filtered by
// adapter='manual'). Some are Phase 5 candidates (will move to
// auto-pull when their platform adapter is built).
const MANUAL_SOURCES = [
  // Truly manual (low cadence / unscrapeable / scattered data)
  { slug: "theatrebattery", name: "Theatre Battery", area: "South King County",
    url: "https://www.theatrebattery.org/",
    notes: "1 show/year (Kent). Schedule on homepage. Often only opening date posted until close to show. Tickets via Stranger Tickets." },
  { slug: "newmuses", name: "New Muses Theatre Company", area: "Tacoma / Pierce County",
    url: "https://www.newmuses.com/",
    notes: "1-3 shows/year (Tacoma). Weebly site with no season index - check the 'Plays & Events' submenu in the homepage nav for current shows." },
  { slug: "toyboat", name: "Toy Boat Theatre", area: "Tacoma / Pierce County",
    url: "https://sites.google.com/site/toyboattheatreco/home",
    notes: "Very low cadence (~1 show every couple years). Google Sites Classic - login-walled. Easier to monitor their Theatre Puget Sound directory page or social media for announcements." },
  { slug: "screamingbutterflies", name: "Screaming Butterflies Productions", area: "Tacoma / Pierce County",
    url: "http://screamingbutterfliestheatre.org/",
    notes: "~3 shows/year (Tacoma). Mostly staged readings. Dates often only month-precision until close to show; check social posts for specific dates." },
  { slug: "nwcenter", name: "Northwest Center Theatre", area: "South Pierce",
    url: "https://northwestcenterthe.wixsite.com/nwctheatre",
    notes: "Brand new org (Puyallup). Primary presence is Facebook (@nwct_official). Check their FB page for season announcements." },
  { slug: "stringshadow", name: "String & Shadow Puppet Theater", area: "Olympia / Thurston County",
    url: "https://www.stringandshadow.com/",
    notes: "Touring company. Tour dates scattered across partner venues (Finn River, state parks, libraries). Check their homepage for current production then each partner venue's calendar for dates." },

  // Phase 5 candidates (will auto-pull when the relevant adapter is built)
  { slug: "centerstage", name: "Centerstage Theatre", area: "South King County",
    url: "https://centerstagetheatre.com/current-season/",
    notes: "Federal Way. PHASE 5: will auto-pull via OvationTix adapter (account 36978). Until then, check /current-season for show titles and ci.ovationtix.com/36978/ for performance dates." },
  { slug: "rentoncivic", name: "Renton Civic Theatre", area: "South King County",
    url: "https://www.rentoncivictheatre.org/season-2026",
    notes: "Renton. PHASE 5: will auto-pull via Next.js JSON endpoint probe. Until then, check /season-2026 for the season + events.rentoncivictheatre.org for performance dates." },
  { slug: "dukesbay", name: "Dukesbay Productions", area: "Tacoma / Pierce County",
    url: "https://dukesbay.org/shows/",
    notes: "Tacoma. PHASE 5: will auto-pull via Eventbrite organizer feed. 1-3 shows/year. Until then, check /shows/ for titles and follow each show's Eventbrite link for performance dates." },
  { slug: "bpa", name: "Bainbridge Performing Arts", area: "Gig Harbor / Kitsap",
    url: "https://www.bainbridgeperformingarts.org/events",
    notes: "Bainbridge Island. PHASE 5: will auto-pull via Squarespace ?format=json adapter (cleanest data source in the entire audit). Until then, check /events for the schedule." },
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
    `Seeding ${all.length} event_sources rows (${SOURCES.length} auto, ${MANUAL_SOURCES.length} manual)${args.dryRun ? " (DRY RUN)" : ""}`,
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
      `insert into public.event_sources
         (org_slug, org_name, source_url, adapter, cadence_days, notes, area_id, active)
       values ($1, $2, $3, $4, 30, $5, $6, true)
       on conflict (org_slug) do update
         set org_name = excluded.org_name,
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
