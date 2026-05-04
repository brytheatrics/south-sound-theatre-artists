// scripts/callboard-weekly-digest.mjs
//
// Runs Sunday evening. For every confirmed callboard subscription,
// finds new approved+published posts since the last digest (or since
// the subscription was confirmed on a first run) that match the
// subscriber's disciplines + post-type filters AND new approved
// productions opening in the next two weeks. Sends one digest email
// if there's anything to share.
//
// Skips empty weeks per the build plan: no email goes out for a
// subscriber if there's nothing new for them.
//
// As of mig 069, only `confirmed_at IS NOT NULL` rows are considered;
// rows still awaiting double-opt-in confirmation are skipped.

import { getDb, sendCronEmail, exitOk, exitFail } from "./_lib/cron.mjs";

const POST_TYPE_LABEL = {
  audition: "Audition",
  designer: "Designer call",
  crew: "Crew call",
  production: "Now playing",
  general: "Opportunity",
};

// "2026-05-12" -> "May 12". Compact run-window formatting for the
// calendar slice of the digest.
function formatRunDate(isoDate) {
  if (!isoDate || typeof isoDate !== "string") return "";
  const [y, m, d] = isoDate.split("-").map(Number);
  if (!y || !m || !d) return "";
  const months = [
    "Jan", "Feb", "Mar", "Apr", "May", "Jun",
    "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
  ];
  return `${months[m - 1]} ${d}`;
}

async function main() {
  const siteUrl = process.env.PUBLIC_SITE_URL || "https://southsoundtheatreartists.org";

  const db = getDb();
  await db.connect();
  try {
    const subsRes = await db.query(
      `select id, subscriber_email, disciplines, post_types, area_ids,
              last_digest_at, confirmed_at, created_at, unsubscribe_token
       from callboard_subscriptions
       where unsubscribed_at is null
         and confirmed_at is not null`,
    );

    let sent = 0;
    let skipped = 0;
    let errored = 0;

    // Calendar slice: productions opening (run_start >= today) in the
    // next 14 days. Fetched once globally; we filter per-subscriber by
    // area_ids when assembling each digest. Includes area_id on the
    // select so the per-sub filter doesn't need a second roundtrip.
    const today = new Date().toISOString().slice(0, 10);
    const horizon = new Date(Date.now() + 14 * 86_400_000)
      .toISOString()
      .slice(0, 10);
    const upcomingProdRes = await db.query(
      `select id, title, organization_name, run_start, run_end, area_id
         from productions
        where status = 'approved'
          and deleted_at is null
          and run_start is not null
          and run_start >= $1::date
          and run_start <= $2::date
        order by run_start asc
        limit 60`,
      [today, horizon],
    );
    const allUpcomingProds = upcomingProdRes.rows;

    function buildProductionsBlock(areaIds) {
      // Empty area_ids = no filter, include everything.
      const filtered =
        areaIds && areaIds.length > 0
          ? allUpcomingProds.filter((p) =>
              p.area_id ? areaIds.includes(p.area_id) : false,
            )
          : allUpcomingProds;
      if (filtered.length === 0) {
        return "_Nothing new on the calendar this week._";
      }
      // Cap at 30 lines to keep the email a reasonable length even when
      // a region has a busy two weeks ahead.
      return filtered
        .slice(0, 30)
        .map((p) => {
          const start = p.run_start ? formatRunDate(p.run_start) : "";
          const end =
            p.run_end && p.run_end !== p.run_start
              ? `-${formatRunDate(p.run_end)}`
              : "";
          const window = start ? ` (${start}${end})` : "";
          return `- ${p.organization_name} - ${p.title}${window}`;
        })
        .join("\n");
    }

    for (const sub of subsRes.rows) {
      // Use confirmed_at (when admin first activated this row) as the
      // floor for "new since you signed up" - prevents the first digest
      // from including everything in the table.
      const since = sub.last_digest_at ?? sub.confirmed_at ?? sub.created_at;

      // Pull approved + published posts created since the cutoff that
      // match the subscriber's filters. Disciplines are matched against
      // post.roles via array overlap; an empty disciplines array means
      // "any". post_types defaults to all five.
      const params = [since, sub.post_types];
      let where = `
        where status = 'approved'
          and published = true
          and deleted_at is null
          and created_at > $1
          and post_type = any($2::text[])`;
      if (sub.disciplines && sub.disciplines.length > 0) {
        // Disciplines are matched against the roles array OR the post
        // type label (so e.g. a 'designer' post matches a 'Designer'
        // discipline filter). Loose intentionally - false positives are
        // tolerable for a weekly digest, false negatives are not.
        params.push(sub.disciplines);
        where += `
          and (
            roles && $3::text[]
            or exists (
              select 1 from unnest($3::text[]) d
              where lower(d) = post_type
            )
          )`;
      }

      const newPosts = await db.query(
        `select id, post_type, title, organization_name, deadline_text,
                location
         from callboard_posts
         ${where}
         order by created_at desc
         limit 30`,
        params,
      );

      // Per-subscriber productions slice (filtered by their area_ids).
      const productionsBlock = buildProductionsBlock(sub.area_ids);
      const hasProductions = !productionsBlock.startsWith("_Nothing");

      // Skip the send only when BOTH halves are empty - if there are
      // new shows opening but no callboard hits, we still want to
      // surface the calendar slice. The template renders both
      // sections; an empty slice is a placeholder line so the section
      // doesn't look broken.
      if (newPosts.rowCount === 0 && !hasProductions) {
        skipped++;
        continue;
      }

      // Build a markdown bullet list for the callboard section.
      const lines = newPosts.rows.map((p) => {
        const label = POST_TYPE_LABEL[p.post_type] ?? "Opportunity";
        const tail = p.deadline_text
          ? ` (${p.deadline_text})`
          : p.location
          ? ` (${p.location})`
          : "";
        return `- ${label}: ${p.organization_name} - ${p.title}${tail}\n  ${siteUrl}/callboard/${p.id}`;
      });
      const postsBlock =
        lines.length > 0
          ? lines.join("\n\n")
          : "_Nothing new on the callboard this week._";

      const result = await sendCronEmail(db, {
        to: sub.subscriber_email,
        templateSlug: "callboard_weekly_digest",
        vars: {
          name: "there", // we don't store names on subscriptions
          posts: postsBlock,
          productions: productionsBlock,
          callboard_url: `${siteUrl}/callboard`,
          calendar_url: `${siteUrl}/calendar`,
          unsubscribe_url: sub.unsubscribe_token
            ? `${siteUrl}/callboard/unsubscribe/${sub.unsubscribe_token}`
            : `${siteUrl}/callboard`,
          // Subscribe URL for re-confirmation if they ever want to
          // tweak their filter set; the form supports updating an
          // existing email's filters by re-submitting.
          subscribe_url: `${siteUrl}/callboard/subscribe`,
        },
      });

      if (result.ok) {
        await db.query(
          `update callboard_subscriptions set last_digest_at = now() where id = $1`,
          [sub.id],
        );
        sent++;
      } else {
        console.warn(
          `digest failed for ${sub.subscriber_email}: ${result.reason}`,
        );
        errored++;
      }
    }

    exitOk(
      `weekly digest done: subs=${subsRes.rowCount}, sent=${sent}, ` +
        `skipped_empty=${skipped}, errored=${errored}`,
    );
  } finally {
    await db.end();
  }
}

main().catch((err) => {
  console.error(err);
  exitFail("callboard-weekly-digest crashed");
});
