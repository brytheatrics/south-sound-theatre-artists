// /digest: public preview of what the weekly digest email will contain.
// Mirrors the unfiltered "firehose" view of the cron at
// scripts/callboard-weekly-digest.mjs - someone who subscribed without
// narrowing down their preferences would get exactly this content.
//
// The cron runs Sunday-evening (01:00 UTC Mon = 17:00 PT Sun). This page
// uses the same windows so it lines up with what's about to land in
// inboxes:
//   - callboard posts created in the past 7 days
//   - productions with run_start in the next 14 days
//
// No per-subscriber filtering. The /callboard/subscribe form is the path
// to a personalised digest.

import type { PageServerLoad } from "./$types";
import { supabaseAdmin } from "$lib/server/supabase";

export const load: PageServerLoad = async () => {
  const sevenDaysAgo = new Date(Date.now() - 7 * 86_400_000).toISOString();
  const today = new Date().toISOString().slice(0, 10);
  const horizon = new Date(Date.now() + 14 * 86_400_000)
    .toISOString()
    .slice(0, 10);

  const [postsRes, productionsRes, postTypeLabelsRes] = await Promise.all([
    supabaseAdmin
      .from("callboard_posts")
      .select(
        "id, post_type, title, organization_name, deadline_text, location, created_at",
      )
      .eq("status", "approved")
      .eq("published", true)
      .is("deleted_at", null)
      .gte("created_at", sevenDaysAgo)
      .order("created_at", { ascending: false })
      .limit(60),
    supabaseAdmin
      .from("productions")
      .select("id, title, organization_name, run_start, run_end")
      .eq("status", "approved")
      .is("deleted_at", null)
      .not("run_start", "is", null)
      .gte("run_start", today)
      .lte("run_start", horizon)
      .order("run_start", { ascending: true })
      .limit(60),
    supabaseAdmin.from("callboard_post_types").select("slug, label"),
  ]);

  if (postsRes.error) throw postsRes.error;
  if (productionsRes.error) throw productionsRes.error;
  if (postTypeLabelsRes.error) throw postTypeLabelsRes.error;

  const postTypeLabels = Object.fromEntries(
    (postTypeLabelsRes.data ?? []).map((r) => [r.slug, r.label]),
  ) as Record<string, string>;

  // Date the next digest will be sent, so the page can say "next digest
  // sends [date]." Cron schedule: 01:00 UTC Monday = Sunday evening PT.
  // Find the next Sunday (or today if it's already Sunday past digest hour).
  const now = new Date();
  const nextSunday = new Date(now);
  const daysUntilSunday = (7 - now.getUTCDay()) % 7 || 7;
  nextSunday.setUTCDate(now.getUTCDate() + daysUntilSunday);
  // The cron runs at 01:00 UTC the following Monday, which is "Sunday
  // evening" PT. Approximate as Sunday for display.
  nextSunday.setUTCHours(0, 0, 0, 0);

  return {
    posts: postsRes.data ?? [],
    productions: productionsRes.data ?? [],
    postTypeLabels,
    nextDigestAt: nextSunday.toISOString(),
  };
};
