// scripts/stale-profile-cleanup.mjs
//
// Three-stage stale-profile pipeline + a trash purge:
//
//   1. Profiles whose updated_at is > 18 months old and have never been
//      pinged get the "still in the area?" email + a fresh 30-day edit
//      token. stale_pinged_at is stamped to now().
//   2. Profiles pinged more than 30 days ago whose updated_at hasn't
//      moved since the ping get soft-deleted (deleted_at = now()).
//   3. Anything in soft-delete state for more than 30 days gets
//      hard-deleted - the same 30-day retention policy used elsewhere.
//
// Runs weekly. Logs counts at the end for the GitHub Actions log.

import { randomBytes, createHash } from "node:crypto";
import { getDb, sendCronEmail, exitOk, exitFail } from "./_lib/cron.mjs";

const PING_AFTER_MS = 18 * 30 * 24 * 60 * 60 * 1000; // ~18 months
const ARCHIVE_AFTER_MS = 30 * 24 * 60 * 60 * 1000; // 30 days post-ping
const TRASH_PURGE_MS = 30 * 24 * 60 * 60 * 1000; // 30 days post soft-delete
const PING_TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

function generateToken() {
  return randomBytes(32).toString("base64url");
}
function hashToken(t) {
  return createHash("sha256").update(t).digest("hex");
}

async function main() {
  const siteUrl = process.env.PUBLIC_SITE_URL || "https://southsoundtheatreartists.org";

  const db = getDb();
  await db.connect();
  try {
    let pinged = 0;
    let archived = 0;
    let purged = 0;

    // === Stage 1: ping the long-quiet ===
    const pingCutoff = new Date(Date.now() - PING_AFTER_MS).toISOString();
    const candidates = await db.query(
      `select id, full_name, email, slug
       from profiles
       where deleted_at is null
         and published = true
         and updated_at < $1
         and stale_pinged_at is null
         and email is not null
       limit 50`,
      [pingCutoff],
    );

    for (const p of candidates.rows) {
      const token = generateToken();
      const tokenHash = hashToken(token);
      const expires = new Date(Date.now() + PING_TOKEN_TTL_MS).toISOString();

      await db.query(
        `insert into magic_link_tokens
           (token_hash, email, purpose, target_id, expires_at)
         values ($1, $2, 'edit_profile', $3, $4)`,
        [tokenHash, p.email.toLowerCase(), p.id, expires],
      );

      const sendResult = await sendCronEmail(db, {
        to: p.email,
        templateSlug: "stale_profile_ping",
        vars: {
          name: p.full_name,
          edit_url: `${siteUrl}/edit/${token}`,
        },
      });

      if (sendResult.ok) {
        await db.query(
          `update profiles set stale_pinged_at = now() where id = $1`,
          [p.id],
        );
        pinged++;
      } else {
        console.warn(`stale ping skipped for ${p.slug}: ${sendResult.reason}`);
      }
    }

    // === Stage 2: archive non-responders ===
    const archiveCutoff = new Date(Date.now() - ARCHIVE_AFTER_MS).toISOString();
    const archiveRes = await db.query(
      `update profiles
         set deleted_at = now(),
             published = false
       where deleted_at is null
         and stale_pinged_at is not null
         and stale_pinged_at < $1
         and updated_at <= stale_pinged_at
       returning id`,
      [archiveCutoff],
    );
    archived = archiveRes.rowCount ?? 0;

    // === Stage 3: hard-purge the long-soft-deleted ===
    const purgeCutoff = new Date(Date.now() - TRASH_PURGE_MS).toISOString();
    const purgeRes = await db.query(
      `delete from profiles
       where deleted_at is not null
         and deleted_at < $1
       returning id`,
      [purgeCutoff],
    );
    purged = purgeRes.rowCount ?? 0;

    // Also purge other soft-deleted surfaces past 30 days so trash
    // retention is consistent across the site. Reports use a status
    // field (open/resolved/dismissed) instead of deleted_at, so they
    // aren't part of this sweep.
    const cbPurge = await db.query(
      `delete from callboard_posts
       where deleted_at is not null and deleted_at < $1
       returning id`,
      [purgeCutoff],
    );
    // Only purge organizations rows that originated as verification
    // applications (contact_email set). Calendar-source rows are kept
    // around indefinitely - the cron uses deleted_at as the "don't
    // re-pull this" sentinel, same pattern as productions.
    const orgPurge = await db.query(
      `delete from organizations
       where deleted_at is not null and deleted_at < $1
         and contact_email is not null
       returning id`,
      [purgeCutoff],
    );

    exitOk(
      `stale-cleanup done: pinged=${pinged}, archived=${archived}, ` +
        `purged_profiles=${purged}, purged_callboard=${cbPurge.rowCount ?? 0}, ` +
        `purged_orgs=${orgPurge.rowCount ?? 0}`,
    );
  } finally {
    await db.end();
  }
}

main().catch((err) => {
  console.error(err);
  exitFail("stale-profile-cleanup crashed");
});
