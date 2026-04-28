// scripts/callboard-weekly-digest.mjs
//
// Runs Sunday evening. For every active callboard subscription, finds
// new approved+published posts since the last digest (or since the
// subscription was created on a first run) that match the subscriber's
// disciplines + post-type filters, and sends one digest email if there
// are any.
//
// Skips empty weeks per the build plan: no email goes out for a
// subscriber if there's nothing new for them.

import { getDb, sendCronEmail, exitOk, exitFail } from "./_lib/cron.mjs";

const POST_TYPE_LABEL = {
  audition: "Audition",
  designer: "Designer call",
  crew: "Crew call",
  production: "Now playing",
  general: "Opportunity",
};

async function main() {
  const siteUrl = process.env.PUBLIC_SITE_URL || "https://southsoundtheatreartists.com";

  const db = getDb();
  await db.connect();
  try {
    const subsRes = await db.query(
      `select id, subscriber_email, disciplines, post_types,
              last_digest_at, created_at, unsubscribe_token
       from callboard_subscriptions
       where unsubscribed_at is null`,
    );

    let sent = 0;
    let skipped = 0;
    let errored = 0;

    for (const sub of subsRes.rows) {
      const since = sub.last_digest_at ?? sub.created_at;

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

      if (newPosts.rowCount === 0) {
        skipped++;
        continue;
      }

      // Build a markdown-ish bullet list. Plain text email is fine; the
      // template body wraps these into prose.
      const lines = newPosts.rows.map((p) => {
        const label = POST_TYPE_LABEL[p.post_type] ?? "Opportunity";
        const tail = p.deadline_text
          ? ` (${p.deadline_text})`
          : p.location
          ? ` (${p.location})`
          : "";
        return `- ${label}: ${p.organization_name} - ${p.title}${tail}\n  ${siteUrl}/callboard/${p.id}`;
      });

      const result = await sendCronEmail(db, {
        to: sub.subscriber_email,
        templateSlug: "callboard_weekly_digest",
        vars: {
          name: "there", // we don't store names on subscriptions
          posts: lines.join("\n\n"),
          callboard_url: `${siteUrl}/callboard`,
          unsubscribe_url: sub.unsubscribe_token
            ? `${siteUrl}/callboard/unsubscribe/${sub.unsubscribe_token}`
            : `${siteUrl}/callboard`,
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
