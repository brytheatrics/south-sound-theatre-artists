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
              include_blog,
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

    // Calendar slice: pull every production whose run window overlaps
    // [today, today+14d] OR closes within [today, today+7d]. Then per-
    // subscriber we filter by category/area and bucket each show into
    // exactly one of: opening this week, opening soon (8-14d),
    // currently running, closing this week. A show appears in only one
    // bucket per digest (decided by the most newsworthy bucket it
    // matches: opening > closing > running).
    const today = new Date().toISOString().slice(0, 10);
    const weekHorizon = new Date(Date.now() + 7 * 86_400_000)
      .toISOString()
      .slice(0, 10);
    const horizon = new Date(Date.now() + 14 * 86_400_000)
      .toISOString()
      .slice(0, 10);
    const calendarProdRes = await db.query(
      `select id, title, organization_name, run_start, run_end,
              area_id, category_id, is_ssta_event
         from productions
        where status = 'approved'
          and deleted_at is null
          and hidden_at is null
          and run_start is not null
          and (
            -- Opening within the next 14 days
            (run_start >= $1::date and run_start <= $2::date)
            -- Or already running and closing within 7 days
            or (run_start <= $1::date and run_end >= $1::date and run_end <= $3::date)
            -- Or currently running with no near-term close
            or (run_start <= $1::date and run_end >= $1::date)
          )
        order by is_ssta_event desc, run_start asc
        limit 120`,
      [today, horizon, weekHorizon],
    );
    const allCalendarProds = calendarProdRes.rows;

    // Blog posts published since each subscriber's last digest. Pulled
    // globally; per-subscriber filter is just the include_blog opt-in
    // boolean (no taxonomy on blog posts). The cron uses the same
    // since-cutoff calc as the callboard slice.
    const allRecentBlogRes = await db.query(
      `select slug, title, cover_url, published_at
         from blog_posts
        where published = true
          and published_at is not null
          and deleted_at is null
        order by published_at desc
        limit 30`,
    );
    const allRecentBlog = allRecentBlogRes.rows;

    function buildBlogBlock(includeBlog, sinceIso) {
      if (!includeBlog) return "";
      const since = new Date(sinceIso);
      const recent = allRecentBlog.filter(
        (p) => new Date(p.published_at) > since,
      );
      if (recent.length === 0) return "";
      const lines = recent.slice(0, 8).map((p) => {
        return `- [${p.title}](${siteUrl}/blog/${p.slug})`;
      });
      return `## New on the blog\n\n${lines.join("\n")}\n`;
    }

    // Bucket each show into exactly one section. Order of preference
    // from most-newsworthy to least: opening this week, opening soon,
    // closing this week (still in run), currently running.
    function bucketProduction(p, todayDate, weekFromNow, twoWeeksFromNow) {
      const start = p.run_start ? new Date(`${p.run_start}T12:00:00Z`) : null;
      const end = p.run_end ? new Date(`${p.run_end}T12:00:00Z`) : start;
      if (!start) return null;
      // Opening this week: run_start in [today, today+7d]
      if (start >= todayDate && start <= weekFromNow) return "openingThisWeek";
      // Opening soon: run_start in (today+7d, today+14d]
      if (start > weekFromNow && start <= twoWeeksFromNow) return "openingSoon";
      // Already running. Bucket on whether it's closing this week.
      if (start < todayDate && end >= todayDate) {
        if (end <= weekFromNow) return "closingThisWeek";
        return "currentlyRunning";
      }
      return null;
    }

    function renderProdLine(p) {
      const start = p.run_start ? formatRunDate(p.run_start) : "";
      const end =
        p.run_end && p.run_end !== p.run_start
          ? `-${formatRunDate(p.run_end)}`
          : "";
      // Glue spaces and the inner hyphen with NBSP + non-breaking
      // hyphen so email clients can't wrap a date range mid-chunk
      // ("(May 1-" / "May 17)" on different lines). Unicode chars
      // rather than &nbsp;/&#8209; entities because the plain-text
      // alternate uses raw markdown - entities would render literally.
      const range = `${start}${end}`
        .replace(/ /g, " ")
        .replace(/-/g, "‑");
      const window = start ? ` (${range})` : "";
      const tag = p.is_ssta_event ? " [SSTA]" : "";
      return `-${tag} ${p.organization_name} - ${p.title}${window}`;
    }

    // Build the entire calendar block (with sub-section headers) for one
    // subscriber's category/area filter. Returns "" when no productions
    // match in any sub-bucket - the caller treats that as "no calendar
    // content this week."
    function buildCalendarBlock(categoryIds, areaIds) {
      const todayDate = new Date(`${today}T12:00:00Z`);
      const weekFromNow = new Date(Date.now() + 7 * 86_400_000);
      const twoWeeksFromNow = new Date(Date.now() + 14 * 86_400_000);

      const filtered = allCalendarProds.filter((p) => {
        if (categoryIds && categoryIds.length > 0) {
          if (!p.category_id || !categoryIds.includes(p.category_id)) return false;
        }
        if (areaIds && areaIds.length > 0) {
          if (p.area_id && !areaIds.includes(p.area_id)) return false;
        }
        return true;
      });

      const buckets = {
        openingThisWeek: [],
        openingSoon: [],
        closingThisWeek: [],
        currentlyRunning: [],
      };
      for (const p of filtered) {
        const b = bucketProduction(p, todayDate, weekFromNow, twoWeeksFromNow);
        if (b) buckets[b].push(p);
      }
      // Cap each bucket to keep the email reasonable
      for (const k of Object.keys(buckets)) buckets[k] = buckets[k].slice(0, 20);

      const sections = [];
      if (buckets.openingThisWeek.length) {
        sections.push(
          `### Opening this week\n\n${buckets.openingThisWeek.map(renderProdLine).join("\n")}`,
        );
      }
      if (buckets.openingSoon.length) {
        sections.push(
          `### Opening next week\n\n${buckets.openingSoon.map(renderProdLine).join("\n")}`,
        );
      }
      if (buckets.currentlyRunning.length) {
        sections.push(
          `### Currently running\n\n${buckets.currentlyRunning.map(renderProdLine).join("\n")}`,
        );
      }
      if (buckets.closingThisWeek.length) {
        sections.push(
          `### Closing this week\n\n${buckets.closingThisWeek.map(renderProdLine).join("\n")}`,
        );
      }
      if (sections.length === 0) return "";
      return `## What's playing\n\n${sections.join("\n\n")}\n`;
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

    // Helper: build the WHERE+params shared between the two callboard
    // queries (new since last digest, closing this week). Both queries
    // need the same per-subscriber category/area/role filters.
    function callboardFilterClause(sub, baseParams) {
      const params = [...baseParams];
      let clause = "";
      if (sub.post_types && sub.post_types.length > 0) {
        params.push(sub.post_types);
        clause += `\n          and post_type = any($${params.length}::text[])`;
      }
      if (sub.callboard_area_ids && sub.callboard_area_ids.length > 0) {
        // Treat null area_id on a callboard post as universal so old
        // pre-mig-071 posts aren't silently excluded during the backfill
        // catch-up. New posts post-mig-071 are required to have area_id
        // at submit time.
        params.push(sub.callboard_area_ids);
        const idx = params.length;
        clause += `\n          and (area_id is null or area_id = any($${idx}::uuid[]))`;
      }
      if (sub.disciplines && sub.disciplines.length > 0) {
        params.push(sub.disciplines);
        const idx = params.length;
        clause += `
          and (
            roles && $${idx}::text[]
            or exists (
              select 1 from unnest($${idx}::text[]) d
              where lower(d) = post_type
            )
          )`;
      }
      return { clause, params };
    }

    function renderCallboardLine(p) {
      const label = labelFor(p.post_type);
      const tail = p.deadline_text
        ? ` (${p.deadline_text})`
        : p.location
        ? ` (${p.location})`
        : "";
      const tag = p.is_ssta_event ? " [SSTA]" : "";
      return `-${tag} ${label}: ${p.organization_name} - ${p.title}${tail}\n  ${siteUrl}/callboard/${p.id}`;
    }

    for (const sub of subsRes.rows) {
      const since = sub.last_digest_at ?? sub.confirmed_at ?? sub.created_at;
      const closingSoonCutoff = new Date(Date.now() + 7 * 86_400_000).toISOString();

      // Callboard "new this week": posts created since last digest,
      // matching the subscriber's filters.
      const newFilter = callboardFilterClause(sub, [since]);
      const newPosts = await db.query(
        `select id, post_type, title, organization_name, deadline_text,
                location, is_ssta_event, expires_at
           from callboard_posts
          where status = 'approved'
            and published = true
            and deleted_at is null
            and created_at > $1${newFilter.clause}
          order by is_ssta_event desc, created_at desc
          limit 30`,
        newFilter.params,
      );

      // Callboard "closing this week": posts whose expires_at is within
      // the next 7 days (regardless of when they were posted), matching
      // the same filters. We dedup against the New list at render time
      // so a job posted yesterday and closing Friday lives only in
      // Closing (more actionable framing).
      const closingFilter = callboardFilterClause(sub, [today, closingSoonCutoff]);
      const closingPosts = await db.query(
        `select id, post_type, title, organization_name, deadline_text,
                location, is_ssta_event, expires_at
           from callboard_posts
          where status = 'approved'
            and published = true
            and deleted_at is null
            and expires_at is not null
            and expires_at >= $1::date
            and expires_at <= $2::date${closingFilter.clause}
          order by is_ssta_event desc, expires_at asc
          limit 20`,
        closingFilter.params,
      );

      const closingIds = new Set(closingPosts.rows.map((p) => p.id));
      const newOnly = newPosts.rows.filter((p) => !closingIds.has(p.id));

      const callboardSections = [];
      if (newOnly.length > 0) {
        callboardSections.push(
          `### New this week\n\n${newOnly.map(renderCallboardLine).join("\n\n")}`,
        );
      }
      if (closingPosts.rowCount > 0) {
        callboardSections.push(
          `### Closing this week\n\n${closingPosts.rows.map(renderCallboardLine).join("\n\n")}`,
        );
      }
      const callboardBlock =
        callboardSections.length > 0
          ? `## Callboard\n\n${callboardSections.join("\n\n")}\n`
          : "";

      const calendarBlock = buildCalendarBlock(
        sub.calendar_category_ids,
        sub.calendar_area_ids,
      );

      const blogBlock = buildBlogBlock(sub.include_blog, since);

      // No-content guard: if all three sections came up empty, skip the
      // send entirely. The /callboard/subscribe page tells subscribers
      // we won't email them on weeks with nothing to report.
      if (!callboardBlock && !calendarBlock && !blogBlock) {
        skipped++;
        continue;
      }

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
          callboard: callboardBlock,
          calendar: calendarBlock,
          blog: blogBlock,
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
