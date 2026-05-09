// /digest: public preview of what the weekly digest email will contain.
// Mirrors the unfiltered "firehose" view of the cron at
// scripts/callboard-weekly-digest.mjs - someone who subscribed without
// narrowing down their preferences would get exactly this content,
// bucketed into the same sub-sections (Opening this week, Currently
// running, etc.) so the page and the email read as the same thing.
//
// Cron now runs Sunday 11:59 PM PT (06:59 UTC Mon). This page uses the
// same windows it does so what's shown here is what subscribers will
// see in their inbox.

import type { PageServerLoad } from "./$types";
import { supabaseAdmin } from "$lib/server/supabase";

type Production = {
  id: string;
  title: string;
  organization_name: string;
  run_start: string | null;
  run_end: string | null;
};

type CallboardPost = {
  id: string;
  post_type: string;
  title: string;
  organization_name: string;
  deadline_text: string | null;
  location: string | null;
  expires_at: string | null;
  created_at: string;
};

export const load: PageServerLoad = async () => {
  const today = new Date().toISOString().slice(0, 10);
  const weekHorizon = new Date(Date.now() + 7 * 86_400_000)
    .toISOString()
    .slice(0, 10);
  const twoWeekHorizon = new Date(Date.now() + 14 * 86_400_000)
    .toISOString()
    .slice(0, 10);
  const sevenDaysAgo = new Date(Date.now() - 7 * 86_400_000).toISOString();

  const [newPostsRes, closingPostsRes, productionsRes, postTypeLabelsRes] =
    await Promise.all([
      // Callboard "new this week" - posts created in the last 7 days.
      supabaseAdmin
        .from("callboard_posts")
        .select(
          "id, post_type, title, organization_name, deadline_text, location, expires_at, created_at",
        )
        .eq("status", "approved")
        .eq("published", true)
        .is("deleted_at", null)
        .gte("created_at", sevenDaysAgo)
        .order("is_ssta_event", { ascending: false })
        .order("created_at", { ascending: false })
        .limit(60),
      // Callboard "closing this week" - posts whose expires_at is within
      // the next 7 days, regardless of when they were posted. Dedup
      // against the new list at render time so a post created yesterday
      // and closing Friday lives only in Closing.
      supabaseAdmin
        .from("callboard_posts")
        .select(
          "id, post_type, title, organization_name, deadline_text, location, expires_at, created_at",
        )
        .eq("status", "approved")
        .eq("published", true)
        .is("deleted_at", null)
        .not("expires_at", "is", null)
        .gte("expires_at", today)
        .lte("expires_at", weekHorizon)
        .order("is_ssta_event", { ascending: false })
        .order("expires_at", { ascending: true })
        .limit(40),
      // Calendar - pull everything that could conceivably surface in any
      // bucket: starts within 14 days OR is currently running. The JS
      // filter below trims to non-closed + buckets each row.
      supabaseAdmin
        .from("productions")
        .select("id, title, organization_name, run_start, run_end")
        .eq("status", "approved")
        .is("deleted_at", null)
        .is("hidden_at", null)
        .not("run_start", "is", null)
        .lte("run_start", twoWeekHorizon)
        .order("run_start", { ascending: true })
        .limit(120),
      supabaseAdmin.from("callboard_post_types").select("slug, label"),
    ]);

  if (newPostsRes.error) throw newPostsRes.error;
  if (closingPostsRes.error) throw closingPostsRes.error;
  if (productionsRes.error) throw productionsRes.error;
  if (postTypeLabelsRes.error) throw postTypeLabelsRes.error;

  const closingIds = new Set((closingPostsRes.data ?? []).map((p) => p.id));
  const postsNew = (newPostsRes.data ?? []).filter(
    (p) => !closingIds.has(p.id),
  ) as CallboardPost[];
  const postsClosing = (closingPostsRes.data ?? []) as CallboardPost[];

  // Bucket productions exactly the way digest-build.ts does. Keep the
  // logic tight - this is the spot most likely to drift from the email
  // version, so the comparison is intentionally line-for-line readable.
  const prods = (productionsRes.data ?? []).filter((p) => {
    if (!p.run_start) return false;
    const end = p.run_end ?? p.run_start;
    return end >= today;
  }) as Production[];

  const prodsOpeningThisWeek: Production[] = [];
  const prodsOpeningNextWeek: Production[] = [];
  const prodsCurrentlyRunning: Production[] = [];
  const prodsClosingThisWeek: Production[] = [];
  for (const p of prods) {
    const start = p.run_start as string;
    const end = (p.run_end ?? p.run_start) as string;
    if (start >= today && start <= weekHorizon) {
      prodsOpeningThisWeek.push(p);
    } else if (start > weekHorizon && start <= twoWeekHorizon) {
      prodsOpeningNextWeek.push(p);
    } else if (start < today && end >= today) {
      if (end <= weekHorizon) prodsClosingThisWeek.push(p);
      else prodsCurrentlyRunning.push(p);
    }
  }

  const postTypeLabels = Object.fromEntries(
    (postTypeLabelsRes.data ?? []).map((r) => [r.slug, r.label]),
  ) as Record<string, string>;

  // Date the next digest will be sent. Cron runs Sunday 11:59 PM PT
  // (06:59 UTC Mon). Find the next Sunday for display.
  const now = new Date();
  const nextSunday = new Date(now);
  const daysUntilSunday = (7 - now.getUTCDay()) % 7 || 7;
  nextSunday.setUTCDate(now.getUTCDate() + daysUntilSunday);
  nextSunday.setUTCHours(0, 0, 0, 0);

  return {
    postsNew,
    postsClosing,
    prodsOpeningThisWeek,
    prodsOpeningNextWeek,
    prodsCurrentlyRunning,
    prodsClosingThisWeek,
    postTypeLabels,
    nextDigestAt: nextSunday.toISOString(),
  };
};
