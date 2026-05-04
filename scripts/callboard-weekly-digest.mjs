// scripts/callboard-weekly-digest.mjs
//
// Runs Sunday evening. For every confirmed callboard subscription,
// finds new approved+published posts since the last digest (or since
// the subscription was confirmed on a first run) that match the
// subscriber's per-dimension filter arrays AND new approved
// productions opening in the next two weeks. Sends one digest email
// if there's anything to share.
//
// Filter dimensions (post mig 071):
//   - post_types               (callboard slice)
//   - callboard_area_ids       (callboard slice)
//   - calendar_category_ids    (calendar slice)
//   - calendar_area_ids        (calendar slice)
//   - disciplines              (callboard slice, legacy - never UI'd)
//
// Each array stored on the subscription uses the "empty = no filter /
// give them everything, including future admin-added options" sentinel.
// That keeps firehose subscribers' digests current without forcing
// them to revisit the manage page every time admin adds an option.
//
// Footer notice: any admin-table row created since the subscriber's
// preferences_updated_at AND missing from their (non-empty) array gets
// summarised as "new options have been added since you last edited"
// + a manage link. Only narrowed subscribers see this; firehose
// subscribers (empty arrays) get the new options for free anyway.

import { getDb, sendCronEmail, exitOk, exitFail } from "./_lib/cron.mjs";

const POST_TYPE_LABEL_FALLBACK = {
  audition: "Audition",
  designer: "Designer call",
  crew: "Crew call",
  production: "Now playing",
  general: "Opportunity",
};

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
      `select id, subscriber_email, disciplines, post_types,
              callboard_area_ids, calendar_category_ids, calendar_area_ids,
              last_digest_at, confirmed_at, created_at,
              preferences_updated_at, unsubscribe_token
       from callboard_subscriptions
       where unsubscribed_at is null
         and confirmed_at is not null`,
    );

    // Live label maps for prose rendering. Per-cron-run fetch is fine -
    // these tables have ~5-15 rows.
    const typeLabelRes = await db.query(
      `select slug, label, plural_label, created_at
         from callboard_post_types`,
    );
    const postTypeLabels = new Map(
      typeLabelRes.rows.map((r) => [r.slug, r.label]),
    );
    const labelFor = (slug) =>
      postTypeLabels.get(slug) ??
      POST_TYPE_LABEL_FALLBACK[slug] ??
      "Opportunity";

    // For the "new options added" footer notice we need each option
    // table's row identity + when it was added.
    const areasRes = await db.query(
      `select id, name, created_at from areas`,
    );
    const eventCatsRes = await db.query(
      `select id, name, created_at from event_categories`,
    );
    const areaById = new Map(areasRes.rows.map((r) => [r.id, r]));
    const eventCatById = new Map(eventCatsRes.rows.map((r) => [r.id, r]));

    // Calendar slice: productions opening (run_start >= today) in the
    // next 14 days. Pulled once globally; per-subscriber filtering by
    // category_id + area_id happens in JS. category_id and area_id are
    // both included in the select for that filter.
    const today = new Date().toISOString().slice(0, 10);
    const horizon = new Date(Date.now() + 14 * 86_400_000)
      .toISOString()
      .slice(0, 10);
    const upcomingProdRes = await db.query(
      `select id, title, organization_name, run_start, run_end,
              area_id, category_id
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

    function buildProductionsBlock(categoryIds, areaIds) {
      // Both arrays use the empty = "no filter" sentinel.
      const filtered = allUpcomingProds.filter((p) => {
        if (categoryIds && categoryIds.length > 0) {
          if (!p.category_id || !categoryIds.includes(p.category_id)) return false;
        }
        if (areaIds && areaIds.length > 0) {
          // Treat null area_id on a production as "fits every area" so
          // recently-tagged orgs don't silently disappear during catch-up.
          // Productions populated by the cron always have area_id set;
          // only manual entries can have null.
          if (p.area_id && !areaIds.includes(p.area_id)) return false;
        }
        return true;
      });
      if (filtered.length === 0) {
        return "_Nothing new on the calendar this week._";
      }
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

    // Detect "new options added since you last edited preferences".
    // Returns true if any of the subscriber's narrowed dimensions has
    // an admin-table row created after their preferences_updated_at
    // that isn't already in their array. Doesn't fire for empty-array
    // (firehose) dimensions since those subscribers get future
    // additions automatically.
    function hasNewSinceLastEdit(sub) {
      const since = new Date(sub.preferences_updated_at ?? sub.created_at);

      // post_types -> compare against callboard_post_types.created_at
      if (sub.post_types && sub.post_types.length > 0) {
        for (const row of typeLabelRes.rows) {
          if (new Date(row.created_at) > since && !sub.post_types.includes(row.slug)) {
            return true;
          }
        }
      }
      // callboard areas
      if (sub.callboard_area_ids && sub.callboard_area_ids.length > 0) {
        for (const row of areasRes.rows) {
          if (new Date(row.created_at) > since && !sub.callboard_area_ids.includes(row.id)) {
            return true;
          }
        }
      }
      // calendar areas (same areas table - same logic as above but
      // against the other dimension's array)
      if (sub.calendar_area_ids && sub.calendar_area_ids.length > 0) {
        for (const row of areasRes.rows) {
          if (new Date(row.created_at) > since && !sub.calendar_area_ids.includes(row.id)) {
            return true;
          }
        }
      }
      // calendar categories
      if (sub.calendar_category_ids && sub.calendar_category_ids.length > 0) {
        for (const row of eventCatsRes.rows) {
          if (new Date(row.created_at) > since && !sub.calendar_category_ids.includes(row.id)) {
            return true;
          }
        }
      }
      return false;
    }

    let sent = 0;
    let skipped = 0;
    let errored = 0;

    for (const sub of subsRes.rows) {
      const since = sub.last_digest_at ?? sub.confirmed_at ?? sub.created_at;

      // Per-subscriber callboard query: assemble WHERE conditionally so
      // empty-array dimensions skip their filter clause entirely.
      const params = [since];
      let where = `
        where status = 'approved'
          and published = true
          and deleted_at is null
          and created_at > $1`;

      if (sub.post_types && sub.post_types.length > 0) {
        params.push(sub.post_types);
        where += `\n          and post_type = any($${params.length}::text[])`;
      }

      if (sub.callboard_area_ids && sub.callboard_area_ids.length > 0) {
        // Treat null area_id on a callboard post as universal so old
        // pre-mig-071 posts aren't silently excluded during the
        // backfill catch-up. New posts post-mig-071 are required to
        // have area_id at submit time.
        params.push(sub.callboard_area_ids);
        const idx = params.length;
        where += `\n          and (area_id is null or area_id = any($${idx}::uuid[]))`;
      }

      if (sub.disciplines && sub.disciplines.length > 0) {
        params.push(sub.disciplines);
        const idx = params.length;
        where += `
          and (
            roles && $${idx}::text[]
            or exists (
              select 1 from unnest($${idx}::text[]) d
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

      const productionsBlock = buildProductionsBlock(
        sub.calendar_category_ids,
        sub.calendar_area_ids,
      );
      const hasProductions = !productionsBlock.startsWith("_Nothing");

      if (newPosts.rowCount === 0 && !hasProductions) {
        skipped++;
        continue;
      }

      const lines = newPosts.rows.map((p) => {
        const label = labelFor(p.post_type);
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

      const manageUrl = sub.unsubscribe_token
        ? `${siteUrl}/callboard/subscribe/manage/${sub.unsubscribe_token}`
        : `${siteUrl}/callboard/subscribe`;
      const unsubscribeUrl = sub.unsubscribe_token
        ? `${siteUrl}/callboard/unsubscribe/${sub.unsubscribe_token}`
        : `${siteUrl}/callboard`;

      // "New options have been added" notice - rendered into the
      // template's {{new_options_notice}} variable. Empty string when
      // nothing's been added since the subscriber last edited; a
      // markdown line otherwise (only this line + the manage link sit
      // in the conditional notice block).
      const newOptionsNotice = hasNewSinceLastEdit(sub)
        ? `We've added new options to the digest since you last edited.\n[Manage your preferences →](${manageUrl})`
        : "";

      const result = await sendCronEmail(db, {
        to: sub.subscriber_email,
        templateSlug: "callboard_weekly_digest",
        vars: {
          name: "there",
          posts: postsBlock,
          productions: productionsBlock,
          callboard_url: `${siteUrl}/callboard`,
          calendar_url: `${siteUrl}/calendar`,
          manage_url: manageUrl,
          unsubscribe_url: unsubscribeUrl,
          new_options_notice: newOptionsNotice,
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
