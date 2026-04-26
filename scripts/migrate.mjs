// scripts/migrate.mjs
//
// Applies SQL files from supabase/migrations/ to the Postgres instance at
// SUPABASE_DB_URL. Tracks applied filenames in a _migrations table so reruns
// are idempotent. Each migration runs in its own transaction.
//
// Usage:
//   node scripts/migrate.mjs           # apply pending migrations
//   node scripts/migrate.mjs --status  # list applied vs pending, no changes

import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import "dotenv/config";
import pg from "pg";

const { Client } = pg;
const __dirname = dirname(fileURLToPath(import.meta.url));
const MIGRATIONS_DIR = join(__dirname, "..", "supabase", "migrations");

const connectionString = process.env.SUPABASE_DB_URL;
if (!connectionString) {
  console.error("ERROR: SUPABASE_DB_URL is not set in .env");
  process.exit(1);
}

const statusOnly = process.argv.includes("--status");

const client = new Client({
  connectionString,
  ssl: { rejectUnauthorized: false },
});

async function main() {
  await client.connect();

  await client.query(`
    create table if not exists public._migrations (
      filename     text primary key,
      applied_at   timestamptz not null default now()
    );
  `);

  const applied = new Set(
    (await client.query("select filename from public._migrations")).rows.map(
      (r) => r.filename,
    ),
  );

  const files = readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith(".sql"))
    .sort();

  if (files.length === 0) {
    console.log("No migration files found in supabase/migrations/");
    return;
  }

  if (statusOnly) {
    console.log("Migration status:");
    for (const f of files) {
      console.log(`  ${applied.has(f) ? "[applied]" : "[pending]"} ${f}`);
    }
    return;
  }

  const pending = files.filter((f) => !applied.has(f));
  if (pending.length === 0) {
    console.log("All migrations already applied.");
    return;
  }

  for (const filename of pending) {
    const sql = readFileSync(join(MIGRATIONS_DIR, filename), "utf8");
    process.stdout.write(`Applying ${filename}... `);
    try {
      await client.query("begin");
      await client.query(sql);
      await client.query(
        "insert into public._migrations (filename) values ($1)",
        [filename],
      );
      await client.query("commit");
      console.log("ok");
    } catch (err) {
      await client.query("rollback");
      console.log("FAILED");
      console.error(err);
      process.exitCode = 1;
      return;
    }
  }

  console.log(`Applied ${pending.length} migration(s).`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => client.end());
