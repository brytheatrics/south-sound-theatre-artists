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
  // Sourced via a research pass on 2026-05-02. Confirm before launch:
  // emails marked _note are inferred / unconfirmed; logo URLs are
  // third-party CDN paths (Wix / Squarespace / Weebly / WordPress) that
  // may rotate over time and should be mirrored to Cloudinary if we
  // care about long-term resilience. Anything still null was left null
  // because the org doesn't publish a public alias / logo asset.

  // === Tacoma / Pierce ===
  { slug: "tlt",
    homepage_url: "https://www.tacomalittletheatre.com/",
    description: "Tacoma's oldest community theatre, founded in 1918 and based at 210 North I Street since 1940. Stages a multi-show mainstage season plus education programs.",
    public_email: null,
    logo_url: null,
    _note: "No general info@/boxoffice@ — only program-specific addresses (education@, clubtlt@). Phone-first contact." },
  { slug: "tmp",
    homepage_url: "https://www.tmp.org/",
    description: "Founded 1994, dedicated to the American musical, with a mainstage season plus family theatre and youth education programs.",
    public_email: "boxoffice@tmp.org",
    logo_url: "https://static.wixstatic.com/media/7da657_5366589b98714fffba3556e30d71dd6f~mv2.png" },
  { slug: "mustardseed",
    homepage_url: "https://oslc.com/mustardseed/",
    description: "Community theatre and ministry of Our Savior Lutheran Church in Tacoma, producing one large musical per year (typically June).",
    public_email: null,
    logo_url: null,
    _note: "User-supplied 'mustardseedtheater.com' didn't resolve. Active site is hosted under oslc.com. Site lists a personal staff address (gerod@oslc.com) - not using as public alias." },
  { slug: "newmuses",
    homepage_url: "https://www.newmuses.com/",
    description: "Tacoma-based theatre company founded in 2009, performing classical and modern plays at the Dukesbay Theater downtown.",
    public_email: "tickets@newmuses.com",
    logo_url: "https://www.newmuses.com/uploads/1/9/1/6/1916660/published/revised-logo-black.png" },
  { slug: "toyboat",
    homepage_url: "https://sites.google.com/site/toyboattheatreco/home",
    description: "Tacoma theatre company founded in 2011 by Marilyn Bennett, producing intimate plays in unconventional venues across the city.",
    public_email: null,
    logo_url: null,
    _note: "Hosted on Google Sites and may be dormant - direct fetch redirects to a Google login. Verified via Theatre Puget Sound's directory." },
  { slug: "screamingbutterflies",
    homepage_url: "https://www.screamingbutterfliestheatre.org/",
    description: "Independent Tacoma theatre company that reimagines classic stories for modern audiences, with a focus on social-justice themes.",
    public_email: null,
    logo_url: "https://static.wixstatic.com/media/6503a1_1d13751794584cec95495a2c191bcd49~mv2.png",
    _note: "/contact page exposes only a web form, no email address." },
  { slug: "dukesbay",
    homepage_url: "https://dukesbay.org/",
    description: "Independent theatre company founded in 2011 by Randy Clark and Aya Hashiguchi Clark. Operates a 40-seat black-box venue in Tacoma's Theater District; prioritizes work by artists of all ethnicities.",
    public_email: "info@dukesbay.org",
    logo_url: "https://dukesbay.org/wp-content/uploads/2013/10/logo.png",
    _note: "info@ surfaced via a directory listing rather than the org's own contact page (which uses obfuscated mailto links). Confirm before bulk-emailing." },
  { slug: "lakewood",
    homepage_url: "https://www.lakewoodplayhouse.org/",
    description: "Community theatre in Lakewood, founded 1938 (incorporated 1941 as Lakewood Community Players). 151-seat black-box thrust stage at the Lakewood Towne Center.",
    public_email: "boxoffice@lakewoodplayhouse.org",
    logo_url: "https://www.lakewoodplayhouse.org/uploads/8/1/1/6/81162538/published/lp-logo-white.png",
    _note: "Email format inferred from site's standard contact pattern (the page used an obfuscation widget). Confirm before mass mailing." },

  // === South Pierce ===
  { slug: "manestage",
    homepage_url: "https://www.manestagetheatre.com/",
    description: "Community theatre in Puyallup (116 West Main), producing mainstage shows and youth/family arts programs.",
    public_email: "boxoffice@manestagetheatre.com",
    logo_url: "https://static.wixstatic.com/media/74ee78_baaab4629e2f4003853bb2e253f950be~mv2.jpg",
    _note: "Originally tagged Sumner; actual address is Puyallup." },
  { slug: "nwcenter",
    homepage_url: "https://northwestcenterthe.wixsite.com/nwctheatre",
    description: null,
    public_email: null,
    logo_url: null,
    _note: "Wix URL appears empty/under construction. A separate Puyallup youth-theatre org named Northwest Theatre Lab (nwtheatrelab.com, info@nwtheatrelab.com) appears more active. Confirm with Lexi which org she means." },

  // === Olympia / Thurston ===
  { slug: "harlequin",
    homepage_url: "https://harlequinproductions.org/",
    description: "Olympia's professional theatre, founded in 1991 by Scot and Linda Whitney. Performs at the historic State Theater downtown (202 4th Ave E).",
    public_email: null,
    logo_url: null,
    _note: "Site lists no public email - only a box office phone." },
  { slug: "tao",
    homepage_url: "https://www.olytheater.com/",
    description: "Theater Artists Olympia (TAO), since 2003, produces innovative and avant-garde works by new playwrights in the South Puget Sound.",
    public_email: "info@olytheater.com",
    logo_url: "https://static.wixstatic.com/media/c3fce3_723ba99b331943529ee242d77dcea079~mv2.png" },
  { slug: "animalfire",
    homepage_url: "https://www.animalfiretheatre.com/",
    description: "Olympia-based, actor-driven, all-volunteer company best known for free Shakespeare in the Park each summer.",
    public_email: "AnimalFireTheatre@gmail.com",
    logo_url: "https://img1.wsimg.com/isteam/ip/1ee3d638-20d6-465b-ab90-4faee49deb3d/Animal%20Fire%20Horizontal%20Logo-04.png" },
  { slug: "evergreen",
    homepage_url: "https://evergreenplayhouse.com/",
    description: "Community theatre in Centralia, established in 1959 and operating continuously ever since.",
    public_email: "theevergreenplayhouse@gmail.com",
    logo_url: "https://images.squarespace-cdn.com/content/v1/65da9ad03d7f7d3fb99d4ade/465d568d-740c-48bf-8b39-5d8b39e0a426/EP+Script+Logo_wh+.png" },
  { slug: "olt",
    homepage_url: "https://olympialittletheater.org/",
    description: "Olympia Little Theatre, founded 1939 - the oldest live theatre in Olympia and one of the oldest in Washington State.",
    public_email: "oltadmin@olympialittletheatre.org",
    logo_url: "https://olympialittletheater.org/wp-content/uploads/2023/03/logo-2x-300x123.png",
    _note: "Domain is olympialittletheater.org (American spelling) but their published email uses olympialittletheatre.org (British). Confirm spelling before sending." },
  { slug: "oft",
    homepage_url: "https://olyft.org/",
    description: "Olympia Family Theater, founded 2006, produces theatre for young audiences and offers year-round classes and camps for K-12 youth in downtown Olympia.",
    public_email: "info@olyft.org",
    logo_url: null,
    _note: "olyft.org returned 403 to direct fetch - details verified via search results / contact page link. Logo not captured." },
  { slug: "stringshadow",
    homepage_url: "https://www.stringandshadow.com/",
    description: "Olympia-based touring puppet theatre that creates large-scale outdoor shows using cardboard, fabric, and paper-mache.",
    public_email: "stringandshadow@gmail.com",
    logo_url: "https://static.wixstatic.com/media/49cf0e_b21015c979554b71a591c1a29996f9f3~mv2.jpg" },

  // === South King ===
  { slug: "bat",
    homepage_url: "https://battheatre.org/",
    description: "Burien Actors Theatre, incorporated 1980 (roots back to 1955), produces a four-show mainstage season at the Little Theatre at Kennedy Catholic High School.",
    public_email: "info@BATtheatre.org",
    logo_url: "https://battheatre.org/wp-content/uploads/2024/11/banner-burien.png",
    _note: "logo_url is the site's banner image - they don't publish a clean logo asset." },
  { slug: "emerald",
    homepage_url: "https://www.emeraldtheatre.org/",
    description: "501(c)(3) non-profit theatre serving South King County since 2012, producing plays, musicals, and cabaret performances around the Puget Sound.",
    public_email: "Info@emeraldtheatre.org",
    logo_url: "https://static.wixstatic.com/media/a9c0d4_15ec5af218a04aceb93b8418aeb5329d~mv2.png" },
  { slug: "auburn",
    homepage_url: "https://www.auburnwa.gov/city_hall/parks_arts_recreation/arts_and_entertainment/theater_and_performing_arts/auburn_community_players",
    description: "Volunteer-actor community theatre group operating under the City of Auburn's Parks, Arts & Recreation department. Produces three productions a year.",
    public_email: null,
    logo_url: null,
    _note: "No standalone site - they live on the City of Auburn site. General contact is the city's Theater Operations Specialist by phone." },
  { slug: "theatrebattery",
    homepage_url: "https://www.theatrebattery.org/",
    description: "Experimental, site-responsive theatre company in Kent. Builds a custom performance space for each production through community partnerships.",
    public_email: "theatrebattery@gmail.com",
    logo_url: "https://images.squarespace-cdn.com/content/v1/5f272221cfd0ad73288402f4/02719f20-4044-4f7e-8b96-3acd7bb473b9/tempImagebk0FFh.gif",
    _note: "Email surfaced from external listings, not the contact page." },
  { slug: "centerstage",
    homepage_url: "https://centerstagetheatre.com/",
    description: "Federal Way's professional theatre company, founded in 1977. Operates the city-owned Knutzen Family Theatre under contract with the City of Federal Way.",
    public_email: "boxoffice@centerstagetheatre.com",
    logo_url: "https://centerstagetheatre.com/wp-content/uploads/2026/04/Centerstage-Logo_Horiz_Blk_WhtBG-scaled.jpg" },
  { slug: "rentoncivic",
    homepage_url: "https://www.rentoncivictheatre.org/",
    description: "Renton Civic Theatre, founded 1987, produces musicals and plays in a restored 1923 movie house in downtown Renton.",
    public_email: "boxoffice@rentoncivictheatre.org",
    logo_url: "https://www.rentoncivictheatre.org/api/media/file/RCT-Logo-WhtYlw.svg" },

  // === Gig Harbor / Kitsap ===
  { slug: "jewelbox",
    homepage_url: "https://www.jewelboxpoulsbo.org/",
    description: "Community theatre in Poulsbo presenting mainstage productions and a Spotlight entertainment series. Operating for 25+ years.",
    public_email: "poulsbojewelbox@hotmail.com",
    logo_url: "https://static.wixstatic.com/media/cc00b6_1aa4a8d8a0b44cf188ba122ad5472785~mv2.png" },
  { slug: "bremerton",
    homepage_url: "http://www.bctshows.com/",
    description: "Bremerton Community Theatre produces comedies, dramas, and musicals at the Robert Montgomery Auditorium in Bremerton.",
    public_email: "boxoffice@bctshows.com",
    logo_url: null,
    _note: "bremertoncommunitytheatre.org 301-redirects to bctshows.com - using the canonical domain. Logo asset is HTTP-only, left null." },
  { slug: "bpa",
    homepage_url: "https://bainbridgeperformingarts.org/",
    description: "Bainbridge Performing Arts (BPA), based on Bainbridge Island, programs theatre, music, and arts education out of its Madison Avenue venue.",
    public_email: "boxoffice@bainbridgeperformingarts.org",
    logo_url: "https://images.squarespace-cdn.com/content/v1/646bb15205ede7654ba7ff7f/322c31c1-708d-4538-a8b9-45d5e413b708/BPA+logo.png" },
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
