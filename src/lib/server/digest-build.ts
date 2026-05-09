// Live digest builder — used by /admin/email-test to render a real
// preview of what a given subscriber will receive on Sunday. Mirrors
// the logic in scripts/callboard-weekly-digest.mjs but uses
// supabase-js so it's safe to call from a SvelteKit server action.
//
// Keep this in sync with scripts/callboard-weekly-digest.mjs - the
// two compute the same blocks, just from different DB clients. If the
// cron's section structure changes, this needs to follow.
//
// `subscriptionId` is the callboard_subscriptions row to render for.
// `sinceOverride` is optional; without it we use the same
// last_digest_at ?? confirmed_at ?? created_at fallback the cron uses.
// The test panel passes a 7-day override so a freshly-created test
// subscription still surfaces a realistic week of content.

import { PUBLIC_SITE_URL } from "$env/static/public";
import { supabaseAdmin } from "./supabase";

const POST_TYPE_LABEL_FALLBACK: Record<string, string> = {
  audition: "Audition",
  designer: "Designer call",
  crew: "Crew call",
  production: "Now playing",
  general: "Opportunity",
};

function formatRunDate(isoDate: string | null | undefined): string {
  if (!isoDate || typeof isoDate !== "string") return "";
  const [y, m, d] = isoDate.split("-").map(Number);
  if (!y || !m || !d) return "";
  const months = [
    "Jan", "Feb", "Mar", "Apr", "May", "Jun",
    "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
  ];
  return `${months[m - 1]} ${d}`;
}

type Sub = {
  id: string;
  subscriber_email: string;
  post_types: string[] | null;
  callboard_area_ids: string[] | null;
  calendar_category_ids: string[] | null;
  calendar_area_ids: string[] | null;
  disciplines: string[] | null;
  include_blog: boolean | null;
  last_digest_at: string | null;
  confirmed_at: string | null;
  created_at: string;
  preferences_updated_at: string | null;
  unsubscribe_token: string | null;
};

export type DigestVars = {
  name: string;
  callboard: string;
  calendar: string;
  blog: string;
  callboard_url: string;
  calendar_url: string;
  manage_url: string;
  unsubscribe_url: string;
  new_options_notice: string;
};

export type DigestResult = {
  vars: DigestVars;
  hasContent: boolean;
};

export async function buildDigestVars(
  subscriptionId: string,
  opts?: { sinceOverride?: string },
): Promise<DigestResult> {
  const today = new Date().toISOString().slice(0, 10);
  const weekHorizon = new Date(Date.now() + 7 * 86_400_000).toISOString().slice(0, 10);
  const twoWeekHorizon = new Date(Date.now() + 14 * 86_400_000).toISOString().slice(0, 10);
  const sevenDaysAgo = new Date(Date.now() - 7 * 86_400_000).toISOString();

  // 1. Load the subscription row.
  const { data: sub, error: subErr } = await supabaseAdmin
    .from("callboard_subscriptions")
    .select(
      `id, subscriber_email, post_types, callboard_area_ids,
       calendar_category_ids, calendar_area_ids, disciplines,
       include_blog, last_digest_at, confirmed_at, created_at,
       preferences_updated_at, unsubscribe_token`,
    )
    .eq("id", subscriptionId)
    .maybeSingle();
  if (subErr || !sub) throw new Error("Subscription not found.");
  const s = sub as unknown as Sub;

  const since =
    opts?.sinceOverride ??
    s.last_digest_at ??
    s.confirmed_at ??
    s.created_at;

  const callboardSinceCutoff = opts?.sinceOverride ?? since;
  const closingSoonCutoff = weekHorizon;

  // 2. Callboard - new this week.
  let newPostsQuery = supabaseAdmin
    .from("callboard_posts")
    .select(
      "id, post_type, title, organization_name, deadline_text, location, is_ssta_event, expires_at",
    )
    .eq("status", "approved")
    .eq("published", true)
    .is("deleted_at", null)
    .gt("created_at", callboardSinceCutoff);

  if (s.post_types && s.post_types.length > 0) {
    newPostsQuery = newPostsQuery.in("post_type", s.post_types);
  }
  if (s.callboard_area_ids && s.callboard_area_ids.length > 0) {
    // Treat null area_id as universal (matches cron behaviour for
    // pre-mig-071 backfill posts).
    newPostsQuery = newPostsQuery.or(
      `area_id.is.null,area_id.in.(${s.callboard_area_ids.join(",")})`,
    );
  }
  if (s.disciplines && s.disciplines.length > 0) {
    // Discipline-overlap filter: post.roles contains any of the picked
    // disciplines, or the post_type matches one of them. supabase-js
    // can express this with .or().
    const disciplineList = s.disciplines.map((d) => `"${d.replace(/"/g, '\\"')}"`).join(",");
    newPostsQuery = newPostsQuery.or(
      `roles.ov.{${disciplineList}},post_type.in.(${s.disciplines.map((d) => d.toLowerCase()).join(",")})`,
    );
  }
  newPostsQuery = newPostsQuery
    .order("is_ssta_event", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(30);

  const { data: newPostsData } = await newPostsQuery;
  const newPosts = newPostsData ?? [];

  // 3. Callboard - closing this week.
  let closingPostsQuery = supabaseAdmin
    .from("callboard_posts")
    .select(
      "id, post_type, title, organization_name, deadline_text, location, is_ssta_event, expires_at",
    )
    .eq("status", "approved")
    .eq("published", true)
    .is("deleted_at", null)
    .not("expires_at", "is", null)
    .gte("expires_at", today)
    .lte("expires_at", closingSoonCutoff);

  if (s.post_types && s.post_types.length > 0) {
    closingPostsQuery = closingPostsQuery.in("post_type", s.post_types);
  }
  if (s.callboard_area_ids && s.callboard_area_ids.length > 0) {
    closingPostsQuery = closingPostsQuery.or(
      `area_id.is.null,area_id.in.(${s.callboard_area_ids.join(",")})`,
    );
  }
  closingPostsQuery = closingPostsQuery
    .order("is_ssta_event", { ascending: false })
    .order("expires_at", { ascending: true })
    .limit(20);

  const { data: closingPostsData } = await closingPostsQuery;
  const closingPosts = closingPostsData ?? [];

  // 4. Load post type labels.
  const { data: typeRows } = await supabaseAdmin
    .from("callboard_post_types")
    .select("slug, label");
  const typeLabels = new Map(
    (typeRows ?? []).map((r) => [r.slug as string, r.label as string]),
  );
  const labelFor = (slug: string): string =>
    typeLabels.get(slug) ?? POST_TYPE_LABEL_FALLBACK[slug] ?? "Opportunity";

  function renderCallboardLine(p: typeof newPosts[number]): string {
    const label = labelFor(p.post_type);
    const tail = p.deadline_text
      ? ` (${p.deadline_text})`
      : p.location
      ? ` (${p.location})`
      : "";
    const tag = p.is_ssta_event ? " [SSTA]" : "";
    return `-${tag} ${label}: ${p.organization_name} - ${p.title}${tail}\n  ${PUBLIC_SITE_URL}/callboard/${p.id}`;
  }

  // Dedup: a post that's both new AND closing soon lives only in the
  // Closing block (more actionable framing).
  const closingIds = new Set(closingPosts.map((p) => p.id));
  const newOnly = newPosts.filter((p) => !closingIds.has(p.id));

  const callboardSections: string[] = [];
  if (newOnly.length > 0) {
    callboardSections.push(
      `### New this week\n\n${newOnly.map(renderCallboardLine).join("\n\n")}`,
    );
  }
  if (closingPosts.length > 0) {
    callboardSections.push(
      `### Closing this week\n\n${closingPosts.map(renderCallboardLine).join("\n\n")}`,
    );
  }
  const callboardBlock =
    callboardSections.length > 0
      ? `## Callboard\n\n${callboardSections.join("\n\n")}\n`
      : "";

  // 5. Calendar - bucket productions by run window position.
  const { data: prodData } = await supabaseAdmin
    .from("productions")
    .select(
      "id, title, organization_name, run_start, run_end, area_id, category_id, is_ssta_event",
    )
    .eq("status", "approved")
    .is("deleted_at", null)
    .is("hidden_at", null)
    .not("run_start", "is", null)
    .lte("run_start", twoWeekHorizon)
    .order("is_ssta_event", { ascending: false })
    .order("run_start", { ascending: true })
    .limit(120);

  const allCalendarProds = (prodData ?? []).filter((p) => {
    if (!p.run_start) return false;
    const end = p.run_end ?? p.run_start;
    if (end < today) return false; // already closed; never include
    return true;
  });

  function calendarPasses(p: typeof allCalendarProds[number]): boolean {
    if (s.calendar_category_ids && s.calendar_category_ids.length > 0) {
      if (!p.category_id || !s.calendar_category_ids.includes(p.category_id)) return false;
    }
    if (s.calendar_area_ids && s.calendar_area_ids.length > 0) {
      if (p.area_id && !s.calendar_area_ids.includes(p.area_id)) return false;
    }
    return true;
  }

  type Prod = typeof allCalendarProds[number];
  function bucketProduction(p: Prod): "openingThisWeek" | "openingSoon" | "closingThisWeek" | "currentlyRunning" | null {
    const start = p.run_start as string;
    const end = (p.run_end ?? p.run_start) as string;
    if (start >= today && start <= weekHorizon) return "openingThisWeek";
    if (start > weekHorizon && start <= twoWeekHorizon) return "openingSoon";
    if (start < today && end >= today) {
      if (end <= weekHorizon) return "closingThisWeek";
      return "currentlyRunning";
    }
    return null;
  }

  function renderProdLine(p: Prod): string {
    const start = p.run_start ? formatRunDate(p.run_start) : "";
    const end =
      p.run_end && p.run_end !== p.run_start
        ? `-${formatRunDate(p.run_end)}`
        : "";
    // Glue spaces and the inner hyphen with NBSP + non-breaking hyphen
    // so email clients can't wrap a date range mid-chunk
    // ("(May 1-" / "May 17)" on different lines). Unicode chars rather
    // than &nbsp;/&#8209; entities because the plain-text alternate
    // uses the raw markdown - entities would render literally there.
    const range = `${start}${end}`
      .replace(/ /g, " ")
      .replace(/-/g, "‑");
    const window = start ? ` (${range})` : "";
    const tag = p.is_ssta_event ? " [SSTA]" : "";
    return `-${tag} ${p.organization_name} - ${p.title}${window}`;
  }

  const filtered = allCalendarProds.filter(calendarPasses);
  const buckets: Record<string, Prod[]> = {
    openingThisWeek: [],
    openingSoon: [],
    closingThisWeek: [],
    currentlyRunning: [],
  };
  for (const p of filtered) {
    const b = bucketProduction(p);
    if (b) buckets[b].push(p);
  }
  for (const k of Object.keys(buckets)) buckets[k] = buckets[k].slice(0, 20);

  const calendarSections: string[] = [];
  if (buckets.openingThisWeek.length) {
    calendarSections.push(
      `### Opening this week\n\n${buckets.openingThisWeek.map(renderProdLine).join("\n")}`,
    );
  }
  if (buckets.openingSoon.length) {
    calendarSections.push(
      `### Opening next week\n\n${buckets.openingSoon.map(renderProdLine).join("\n")}`,
    );
  }
  if (buckets.currentlyRunning.length) {
    calendarSections.push(
      `### Currently running\n\n${buckets.currentlyRunning.map(renderProdLine).join("\n")}`,
    );
  }
  if (buckets.closingThisWeek.length) {
    calendarSections.push(
      `### Closing this week\n\n${buckets.closingThisWeek.map(renderProdLine).join("\n")}`,
    );
  }
  const calendarBlock =
    calendarSections.length > 0
      ? `## What's playing\n\n${calendarSections.join("\n\n")}\n`
      : "";

  // 6. Blog (only if opted in).
  let blogBlock = "";
  if (s.include_blog) {
    const sinceCutoff = opts?.sinceOverride ?? sevenDaysAgo;
    const { data: blogData } = await supabaseAdmin
      .from("blog_posts")
      .select("slug, title, published_at")
      .eq("published", true)
      .not("published_at", "is", null)
      .is("deleted_at", null)
      .gt("published_at", sinceCutoff)
      .order("published_at", { ascending: false })
      .limit(8);
    const blog = blogData ?? [];
    if (blog.length > 0) {
      const lines = blog.map((p) => `- [${p.title}](${PUBLIC_SITE_URL}/blog/${p.slug})`);
      blogBlock = `## New on the blog\n\n${lines.join("\n")}\n`;
    }
  }

  const manageUrl = s.unsubscribe_token
    ? `${PUBLIC_SITE_URL}/callboard/subscribe/manage/${s.unsubscribe_token}`
    : `${PUBLIC_SITE_URL}/callboard/subscribe`;
  const unsubscribeUrl = s.unsubscribe_token
    ? `${PUBLIC_SITE_URL}/callboard/unsubscribe/${s.unsubscribe_token}`
    : `${PUBLIC_SITE_URL}/callboard`;

  const hasContent = !!callboardBlock || !!calendarBlock || !!blogBlock;

  return {
    vars: {
      name: "there",
      callboard: callboardBlock,
      calendar: calendarBlock,
      blog: blogBlock,
      callboard_url: `${PUBLIC_SITE_URL}/callboard`,
      calendar_url: `${PUBLIC_SITE_URL}/calendar`,
      manage_url: manageUrl,
      unsubscribe_url: unsubscribeUrl,
      new_options_notice: "",
    },
    hasContent,
  };
}
