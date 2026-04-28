// scripts/email-volume-alert.mjs
//
// Resend Free tier ships 3000 emails / calendar month. This cron counts
// the rows in email_log for the current month and pings ADMIN_EMAIL
// once when usage crosses 70%, and again at 90%. Tracks the "already
// alerted this month" state by querying email_log itself for prior
// admin_volume_alert sends - no extra state table needed.
//
// At 100%+ Resend will start rejecting sends; the alert at 90% gives
// roughly a day of runway to fix it before that happens.

import { getDb, sendCronEmail, exitOk, exitFail } from "./_lib/cron.mjs";

const CAP = 3000;
const THRESHOLDS = [
  { pct: 70, label: "70" },
  { pct: 90, label: "90" },
];

async function main() {
  const adminEmail = process.env.ADMIN_EMAIL;
  if (!adminEmail) exitFail("ADMIN_EMAIL is not set");

  const db = getDb();
  await db.connect();
  try {
    // First of the current month, in UTC. The cron runs daily so this
    // is recomputed every time and rolls over cleanly.
    const monthStart = new Date();
    monthStart.setUTCDate(1);
    monthStart.setUTCHours(0, 0, 0, 0);
    const monthStartIso = monthStart.toISOString();

    // Total sent this month (any template). Skip 'admin_volume_alert'
    // itself so the alert doesn't bump its own counter.
    const sentRes = await db.query(
      `select count(*)::int as n
       from email_log
       where sent_at >= $1
         and email_type <> 'admin_volume_alert'`,
      [monthStartIso],
    );
    const sent = sentRes.rows[0].n;
    const percent = Math.floor((sent / CAP) * 100);

    // How many alerts have we already sent this month?
    const alertsRes = await db.query(
      `select count(*)::int as n
       from email_log
       where sent_at >= $1
         and email_type = 'admin_volume_alert'
         and status = 'sent'`,
      [monthStartIso],
    );
    const alertsSent = alertsRes.rows[0].n;

    // Pick the highest threshold we've crossed but not yet alerted on.
    // alertsSent === 0 -> consider the 70% bucket.
    // alertsSent === 1 -> consider the 90% bucket.
    // alertsSent >= 2  -> we're done for the month.
    const target = THRESHOLDS[alertsSent];
    if (!target) {
      exitOk(`Already sent both alerts this month (sent=${sent}/${CAP}, ${percent}%).`);
      return;
    }
    if (percent < target.pct) {
      exitOk(
        `Below ${target.pct}% threshold (sent=${sent}/${CAP}, ${percent}%). No alert.`,
      );
      return;
    }

    const result = await sendCronEmail(db, {
      to: adminEmail,
      templateSlug: "admin_volume_alert",
      vars: {
        sent: String(sent),
        cap: String(CAP),
        percent: target.label,
      },
    });
    if (!result.ok) exitFail(`Volume alert send failed: ${result.reason}`);
    exitOk(`Volume alert sent at ${target.label}% (sent=${sent}/${CAP}).`);
  } finally {
    await db.end();
  }
}

main().catch((err) => {
  console.error(err);
  exitFail("email-volume-alert crashed");
});
