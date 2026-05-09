// scripts/stale-profile-cleanup.mjs
//
// Multi-stage profile lifecycle cron:
//
//   STALE PIPELINE (long-quiet artists)
//   1. Profiles whose updated_at is > 18 months old and have never been
//      pinged get the "still in the area?" email + a fresh 30-day edit
//      token. stale_pinged_at is stamped to now().
//   2. Profiles pinged more than 30 days ago whose updated_at hasn't
//      moved since the ping get soft-deleted (deleted_at = now()).
//
//   LAUNCH-GRACE PIPELINE (bulk-imported artists invited at launch)
//   A. Profiles where invited_at + 27 days has elapsed AND required
//      fields are still missing AND no warning has gone out yet:
//      send the "your profile will be hidden in 3 days" warning.
//   B. Profiles where invited_at + 30 days has elapsed AND required
//      fields are STILL missing: auto-hide (published=false +
//      auto_hidden_incomplete=true). Stays in the DB; the artist can
//      fill in fields later and the save handlers auto-republish.
//
//   TRASH PURGE
//   3. Anything in soft-delete state for more than 30 days gets
//      hard-deleted (excluding archived_stale=true rows from the stale
//      pipeline, which we keep indefinitely).
//
// Runs weekly. Logs counts at the end for the GitHub Actions log.

import { randomBytes, createHash } from "node:crypto";
import { getDb, sendCronEmail, exitOk, exitFail } from "./_lib/cron.mjs";

const PING_AFTER_MS = 18 * 30 * 24 * 60 * 60 * 1000; // ~18 months
const ARCHIVE_AFTER_MS = 30 * 24 * 60 * 60 * 1000; // 30 days post-ping
const TRASH_PURGE_MS = 30 * 24 * 60 * 60 * 1000; // 30 days post soft-delete
const PING_TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days
const LAUNCH_GRACE_DAYS = 30; // hide cliff
const LAUNCH_WARNING_DAYS = 27; // warning email goes out at T-3

// Required-field check mirrors src/lib/server/profile-completeness.ts.
// Inlined here because the cron is a Node-side script and importing
// from src/ would pull SvelteKit context. Keep both copies in sync
// when the required-field bar changes.
const REQUIRED_FIELD_LABELS = {
  full_name: "Full name",
  bio: "Bio",
  headshot: "Headshot photo + rights confirmation",
  disciplines: "At least one discipline",
  geographic_area: "Geographic area",
};
function missingRequiredFields(p) {
  const missing = [];
  if (!p.full_name || !String(p.full_name).trim()) missing.push("full_name");
  if (!p.bio || !String(p.bio).trim()) missing.push("bio");
  if (!p.headshot_url || !String(p.headshot_url).trim() || !p.headshot_consent) {
    missing.push("headshot");
  }
  if (!Array.isArray(p.disciplines) || p.disciplines.length === 0) {
    missing.push("disciplines");
  }
  if (!p.geographic_area || !String(p.geographic_area).trim()) {
    missing.push("geographic_area");
  }
  return missing;
}
function formatMissingForEmail(missing) {
  return missing.map((k) => `- ${REQUIRED_FIELD_LABELS[k] ?? k}`).join("\n");
}

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
    let launchWarned = 0;
    let launchHidden = 0;

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
          // Same raw token used for both URLs. The /still-active route
          // doesn't burn the token, so the artist can confirm AND edit
          // from the same email if they want.
          still_active_url: `${siteUrl}/still-active/${token}`,
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
    // Stamps archived_stale=true alongside deleted_at so the hard-purge
    // sweep below knows to skip these rows. Admin-clicked deletes go
    // through /admin/profiles/[id] (or /admin/profiles/trash) and
    // leave archived_stale=false, so they purge after 30 days as before.
    const archiveCutoff = new Date(Date.now() - ARCHIVE_AFTER_MS).toISOString();
    const todayIso = new Date().toISOString().slice(0, 10);
    const archiveRes = await db.query(
      // coalesce keeps any pre-existing admin_note intact (admin might
      // have left context that's still useful) - we only stamp the
      // auto-archive note when admin_note is null/empty.
      `update profiles
         set deleted_at = now(),
             published = false,
             archived_stale = true,
             admin_note = coalesce(nullif(admin_note, ''),
               'Auto-archived: 18-month inactivity ping, no response by ' || $2 || '.')
       where deleted_at is null
         and stale_pinged_at is not null
         and stale_pinged_at < $1
         and updated_at <= stale_pinged_at
       returning id`,
      [archiveCutoff, todayIso],
    );
    archived = archiveRes.rowCount ?? 0;

    // === Launch-grace A: warn 3 days before auto-hide ===
    // Profiles invited > 27 days ago that are still incomplete and
    // haven't been warned yet get the "fill these in or you'll be
    // hidden" email. Soft-cap at PUBLIC_SITE_URL so the link works
    // regardless of env.
    const warnCutoff = new Date(Date.now() - LAUNCH_WARNING_DAYS * 86_400_000).toISOString();
    const hideCutoff = new Date(Date.now() - LAUNCH_GRACE_DAYS * 86_400_000).toISOString();
    const hideDateLabel = new Date(Date.now() + (LAUNCH_GRACE_DAYS - LAUNCH_WARNING_DAYS) * 86_400_000)
      .toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });

    const launchCandidatesRes = await db.query(
      `select id, slug, email, full_name, bio, headshot_url, headshot_consent,
              disciplines, geographic_area, invited_at,
              completion_warning_sent_at
         from profiles
        where invited_at is not null
          and invited_at <= $1
          and deleted_at is null
          and published = true`,
      [warnCutoff],
    );

    for (const p of launchCandidatesRes.rows) {
      const missing = missingRequiredFields(p);
      if (missing.length === 0) continue; // complete; nothing to do
      if (p.completion_warning_sent_at) continue; // already warned
      if (!p.email) continue;

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
        templateSlug: "launch_completion_warning",
        vars: {
          name: p.full_name ?? "",
          missing_fields: formatMissingForEmail(missing),
          hide_date: hideDateLabel,
          edit_url: `${siteUrl}/edit/${token}`,
        },
      });
      if (sendResult.ok) {
        await db.query(
          `update profiles set completion_warning_sent_at = now() where id = $1`,
          [p.id],
        );
        launchWarned++;
      } else {
        console.warn(`launch warning skipped for ${p.slug}: ${sendResult.reason}`);
      }
    }

    // === Launch-grace B: auto-hide profiles past the 30-day cliff ===
    // Same query shape but a different cutoff. Sets published=false +
    // auto_hidden_incomplete=true + admin_note describing why. The
    // save handlers on /edit/[token] and /admin/profiles/[id]/edit
    // auto-republish if the artist later completes the missing fields.
    const launchHideRes = await db.query(
      `select id, slug, full_name, bio, headshot_url, headshot_consent,
              disciplines, geographic_area
         from profiles
        where invited_at is not null
          and invited_at <= $1
          and deleted_at is null
          and published = true
          and auto_hidden_incomplete = false`,
      [hideCutoff],
    );
    const todayIso = new Date().toISOString().slice(0, 10);
    for (const p of launchHideRes.rows) {
      const missing = missingRequiredFields(p);
      if (missing.length === 0) continue; // complete; leave published
      const note = `Auto-hidden ${todayIso} because the profile was still missing required fields 30+ days after the launch invitation went out: ${missing.map((k) => REQUIRED_FIELD_LABELS[k] ?? k).join(", ")}. Will auto-republish when the artist fills these in.`;
      await db.query(
        `update profiles
            set published = false,
                auto_hidden_incomplete = true,
                admin_note = coalesce(nullif(admin_note, ''), $2)
          where id = $1`,
        [p.id, note],
      );
      launchHidden++;
    }

    // === Stage 3: hard-purge the long-soft-deleted ===
    // archived_stale=true rows are excluded - those are auto-archived
    // stale profiles that admin should keep recoverable indefinitely
    // (the artist might return; we'd rather restore than make them
    // re-submit). Only admin-deleted profiles hard-purge.
    const purgeCutoff = new Date(Date.now() - TRASH_PURGE_MS).toISOString();
    const purgeRes = await db.query(
      `delete from profiles
       where deleted_at is not null
         and deleted_at < $1
         and archived_stale = false
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
        `launch_warned=${launchWarned}, launch_hidden=${launchHidden}, ` +
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
