// scripts/calendar-sync.mjs
//
// Walk active organizations rows and run the AI-extraction pipeline for each.
// Skips orgs whose cadence_days hasn't elapsed since last_checked_at
// (default 30 days). For each source: fetches HTML, hashes it, skips the
// AI call if unchanged since last run, otherwise extracts shows + per-
// performance schedule and upserts into productions + performances.
//
// Per-org rate-limit politeness: a 45s sleep between sources keeps us
// under the Tier-1 50K input-tokens-per-minute Claude limit. The full
// 16-org walk takes ~12-15 minutes wall clock when many sources have
// changed; near-zero when nothing has changed (cache hits).
//
// Run:
//   node scripts/calendar-sync.mjs                # cron mode (cadence-aware)
//   node scripts/calendar-sync.mjs --force        # ignore cadence + cache
//   node scripts/calendar-sync.mjs --org=tlt      # just this slug
//
// Requires SUPABASE_DB_URL + ANTHROPIC_API_KEY.

import { config as loadDotenv } from "dotenv";
import pg from "pg";
import { syncEventSource } from "./_lib/calendar-sync.mjs";
import { closeBrowser } from "./_lib/playwright-fetch.mjs";

loadDotenv({ override: true });

const { Client } = pg;

const INTER_SOURCE_DELAY_MS = 45_000; // be polite between orgs

function parseArgs() {
  const out = { force: false, orgSlug: null };
  for (const a of process.argv.slice(2)) {
    if (a === "--force") out.force = true;
    else if (a.startsWith("--org=")) out.orgSlug = a.slice("--org=".length);
    else if (a === "--help" || a === "-h") {
      console.log(
        "Usage: node scripts/calendar-sync.mjs [--force] [--org=<slug>]",
      );
      process.exit(0);
    }
  }
  return out;
}

async function main() {
  const args = parseArgs();
  const dbUrl = process.env.SUPABASE_DB_URL;
  if (!dbUrl) {
    console.error("::error::SUPABASE_DB_URL not set");
    process.exit(1);
  }
  if (!process.env.ANTHROPIC_API_KEY) {
    console.error("::error::ANTHROPIC_API_KEY not set");
    process.exit(1);
  }

  const db = new Client({ connectionString: dbUrl, ssl: { rejectUnauthorized: false } });
  await db.connect();

  try {
    // Cron only runs adapters that actually fetch + extract. Manual
    // entries (adapter='manual') stay in organizations for admin
    // visibility but are skipped here so we don't waste API tokens
    // hitting unscrapeable / placeholder pages.
    //
    // Aliasing slug -> org_slug and name -> org_name so the lib + the
    // log-formatting code below keep working without a rename pass on
    // every source.* reference.
    let where, params;
    if (args.orgSlug) {
      where = `active = true and adapter <> 'manual' and slug = $1 and deleted_at is null`;
      params = [args.orgSlug];
    } else if (args.force) {
      where = `active = true and adapter <> 'manual' and deleted_at is null`;
      params = [];
    } else {
      where = `active = true and adapter <> 'manual' and deleted_at is null and (
                 last_checked_at is null
                 or last_checked_at < now() - (cadence_days * interval '1 day')
               )`;
      params = [];
    }

    const sourcesRes = await db.query(
      `select id,
              slug as org_slug,
              name as org_name,
              source_url, adapter, last_hash,
              last_show_count, cadence_days, last_checked_at, last_status
         from public.organizations
        where ${where}
        order by slug`,
      params,
    );
    const sources = sourcesRes.rows;

    if (sources.length === 0) {
      console.log("::notice::no organizations due for sync");
      return;
    }

    console.log(`Syncing ${sources.length} source${sources.length === 1 ? "" : "s"}${args.force ? " (forced)" : ""}`);

    let totalCost = 0;
    let totalShows = 0;
    let totalPerfs = 0;
    let okCount = 0;
    let unchangedCount = 0;
    let errorCount = 0;

    for (let i = 0; i < sources.length; i++) {
      const src = sources[i];
      console.log(`\n[${i + 1}/${sources.length}] ${src.org_name} (${src.org_slug})`);
      const result = await syncEventSource(db, src, { force: args.force });
      console.log(
        `  status=${result.status}  shows=${result.showCount ?? 0}  perfs=${result.performanceCount ?? 0}  cost=$${(result.cost ?? 0).toFixed(4)}  ${result.durationMs}ms`,
      );
      if (result.error) console.log(`  error: ${result.error}`);

      totalCost += result.cost ?? 0;
      totalShows += result.showCount ?? 0;
      totalPerfs += result.performanceCount ?? 0;
      if (result.status === "ok") okCount++;
      else if (result.status === "unchanged") unchangedCount++;
      else if (result.status === "error" || result.status === "empty") errorCount++;

      // Polite delay before next source's API calls (skip on last)
      if (i < sources.length - 1 && result.status !== "unchanged") {
        await new Promise((r) => setTimeout(r, INTER_SOURCE_DELAY_MS));
      }
    }

    console.log(
      `\n::notice::sync complete: ${okCount} ok, ${unchangedCount} unchanged, ${errorCount} error/empty | ${totalShows} shows, ${totalPerfs} performances | $${totalCost.toFixed(4)}`,
    );
  } finally {
    await db.end();
    // Headless browser launched lazily by playwright-using adapters.
    // Close it explicitly so the cron job doesn't hang on Chromium.
    await closeBrowser();
  }
}

main().catch((err) => {
  console.error("::error::Fatal:", err);
  process.exit(1);
});
