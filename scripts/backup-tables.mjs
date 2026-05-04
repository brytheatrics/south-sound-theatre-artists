// scripts/backup-tables.mjs
//
// Dumps every public table to a JSON file under ./backup-out/. The
// backup workflow then commits + pushes that directory to a separate
// private repo (set via BACKUP_REPO_PATH + BACKUP_REPO_TOKEN secrets).
//
// We use a hardcoded table list rather than information_schema so
// migrations / schema mistakes can't accidentally exfiltrate something.
// New tables added later need to be added here on purpose.

import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { getDb, exitOk, exitFail } from "./_lib/cron.mjs";

// Order doesn't matter for a JSON dump; this is just the explicit list.
// Junk / runtime-only tables (admin_login_attempts, magic_link_tokens,
// admin_sessions) are excluded - they're either rotation-only or
// privacy-sensitive.
const TABLES = [
  "profiles",
  "pending_submissions",
  "flagged_edits",
  "email_log",
  "email_blocklist",
  "reports",
  "featured_profiles",
  "site_content",
  "email_templates",
  "announcement_banner",
  "disciplines",
  "discipline_categories",
  "areas",
  "unions",
  "callboard_posts",
  "organizations",
  "productions",
  "callboard_subscriptions",
  "marquee_settings",
  "resources",
  "resource_categories",
];

async function main() {
  const outDir = process.env.BACKUP_OUT_DIR || "backup-out";
  mkdirSync(outDir, { recursive: true });

  const db = getDb();
  await db.connect();
  try {
    const totals = {};
    for (const table of TABLES) {
      const res = await db.query(`select * from public.${table}`);
      totals[table] = res.rowCount;
      writeFileSync(
        join(outDir, `${table}.json`),
        JSON.stringify(res.rows, null, 2),
      );
    }
    // Manifest with timestamps + row counts for easy diffing across
    // weekly snapshots.
    writeFileSync(
      join(outDir, "manifest.json"),
      JSON.stringify(
        {
          generated_at: new Date().toISOString(),
          tables: totals,
        },
        null,
        2,
      ),
    );
    exitOk(
      `Dumped ${TABLES.length} tables (${Object.values(totals).reduce(
        (a, b) => a + b,
        0,
      )} rows) to ${outDir}/`,
    );
  } finally {
    await db.end();
  }
}

main().catch((err) => {
  console.error(err);
  exitFail("backup-tables crashed");
});
