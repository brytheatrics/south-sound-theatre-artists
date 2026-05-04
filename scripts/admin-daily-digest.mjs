// scripts/admin-daily-digest.mjs
//
// Runs every morning. Counts open items across the admin queues
// (pending submissions, flagged edits, reports, callboard, orgs) and,
// if anything's non-empty, emails ADMIN_EMAIL a digest. Mirrors the
// counts the sidebar badges use so admin and email always agree.
//
// Skips entirely on quiet mornings - "no email when nothing's broken"
// is a feature, not a bug.

import { getDb, sendCronEmail, exitOk, exitFail } from "./_lib/cron.mjs";

async function main() {
  const adminEmail = process.env.ADMIN_EMAIL;
  const siteUrl = process.env.PUBLIC_SITE_URL || "https://southsoundtheatreartists.org";
  if (!adminEmail) exitFail("ADMIN_EMAIL is not set");

  const db = getDb();
  await db.connect();
  try {
    const queries = await Promise.all([
      db.query(
        `select count(*)::int as n from pending_submissions
         where status = 'pending_review' and email_verified = true`,
      ),
      db.query(
        `select count(*)::int as n from flagged_edits where status = 'pending'`,
      ),
      db.query(
        `select count(*)::int as n from reports where status = 'open'`,
      ),
      db.query(
        `select count(*)::int as n from callboard_posts
         where status = 'pending_review' and deleted_at is null`,
      ),
      // Pending verification: applied via apply-verified (contact_email
      // set) but not yet verified. Filtering on contact_email NOT null
      // keeps the imported calendar-source rows out of the count.
      db.query(
        `select count(*)::int as n from organizations
         where verified = false and contact_email is not null
           and deleted_at is null`,
      ),
    ]);

    const counts = {
      pending: queries[0].rows[0].n,
      flaggedEdits: queries[1].rows[0].n,
      reports: queries[2].rows[0].n,
      callboard: queries[3].rows[0].n,
      orgs: queries[4].rows[0].n,
    };
    const total =
      counts.pending +
      counts.flaggedEdits +
      counts.reports +
      counts.callboard +
      counts.orgs;

    if (total === 0) {
      exitOk("Admin queues are empty - no digest sent.");
      return;
    }

    // Build a markdown bullet list of what's outstanding.
    const lines = [];
    if (counts.pending) lines.push(`- ${counts.pending} new profile submission${counts.pending === 1 ? "" : "s"}`);
    if (counts.flaggedEdits) lines.push(`- ${counts.flaggedEdits} flagged edit${counts.flaggedEdits === 1 ? "" : "s"} to review`);
    if (counts.reports) lines.push(`- ${counts.reports} open report${counts.reports === 1 ? "" : "s"}`);
    if (counts.callboard) lines.push(`- ${counts.callboard} callboard post${counts.callboard === 1 ? "" : "s"} pending review`);
    if (counts.orgs) lines.push(`- ${counts.orgs} verified-org application${counts.orgs === 1 ? "" : "s"}`);
    const breakdown = lines.join("\n");

    const result = await sendCronEmail(db, {
      to: adminEmail,
      templateSlug: "admin_daily_digest",
      vars: {
        total: String(total),
        plural: total === 1 ? "" : "s",
        verb: total === 1 ? "is" : "are",
        breakdown,
        admin_url: `${siteUrl}/admin`,
      },
    });

    if (!result.ok) {
      exitFail(`Digest send failed: ${result.reason}`);
    }
    exitOk(`Digest sent (total=${total}, ${JSON.stringify(counts)})`);
  } finally {
    await db.end();
  }
}

main().catch((err) => {
  console.error(err);
  exitFail("admin-daily-digest crashed");
});
