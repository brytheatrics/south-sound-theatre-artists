// Public callboard: filterable list of approved posts. Filter state
// lives in URL params so views are shareable. Auto-expires stale posts
// on each page load so the board stays current without a cron.

import type { PageServerLoad } from "./$types";
import { supabaseAdmin } from "$lib/server/supabase";

const PAGE_SIZE = 20;
const CLOSING_SOON_MS = 7 * 24 * 60 * 60 * 1000;

export type CallboardPost = {
  id: string;
  post_type: string;
  title: string;
  organization_name: string;
  location: string | null;
  description: string | null;
  roles: string[];
  compensation_type: string | null;
  compensation: string | null;
  key_dates: [string, string][];
  deadline_text: string | null;
  expires_at: string | null;
  ticket_url: string | null;
  verified_org_id: string | null;
  created_at: string;
};

export const load: PageServerLoad = async ({ url }) => {
  const params = url.searchParams;
  // Multi-select filter: ?types=audition,designer (comma-separated).
  // Backwards-compatible with the older single-value ?type= param.
  const typesParam = (params.get("types") ?? params.get("type") ?? "").trim();
  const requestedTypes = typesParam
    ? typesParam.split(",").map((s) => s.trim()).filter(Boolean)
    : [];
  const verifiedOnly = params.get("verified") === "1";
  const sort = params.get("sort") === "newest" ? "newest" : "deadline";
  const view = params.get("view") === "cards" ? "cards" : "list";
  const pageParam = params.get("page") ?? "";
  const page =
    /^\d+$/.test(pageParam) && Number(pageParam) > 0 ? Number(pageParam) : 1;

  const now = new Date().toISOString();

  // Auto-expire published posts whose cutoff has passed.
  await supabaseAdmin
    .from("callboard_posts")
    .update({ published: false })
    .eq("published", true)
    .not("expires_at", "is", null)
    .lt("expires_at", now)
    .is("deleted_at", null);

  // Active post types for the filter strip + slug validation. Comes
  // from the admin-editable callboard_post_types table.
  const { data: typesData } = await supabaseAdmin
    .from("callboard_post_types")
    .select("slug, label, plural_label, sort_order")
    .eq("active", true)
    .order("sort_order");
  const postTypes = typesData ?? [];
  const validTypes = postTypes.map((t) => t.slug);

  let query = supabaseAdmin
    .from("callboard_posts")
    .select(
      `id, post_type, title, organization_name, location, description,
       roles, compensation_type, compensation, key_dates, deadline_text,
       expires_at, ticket_url, verified_org_id, created_at`,
      { count: "exact" },
    )
    .eq("published", true)
    .eq("status", "approved")
    .is("deleted_at", null);

  // Filter to only the requested types that actually exist + are active.
  // Empty list = no filter, show all.
  const activeTypes = requestedTypes.filter((t) => validTypes.includes(t));
  if (activeTypes.length === 1) {
    query = query.eq("post_type", activeTypes[0]);
  } else if (activeTypes.length > 1) {
    query = query.in("post_type", activeTypes);
  }
  if (verifiedOnly) {
    query = query.not("verified_org_id", "is", null);
  }
  if (sort === "deadline") {
    query = query.order("expires_at", { ascending: true, nullsFirst: false });
  } else {
    query = query.order("created_at", { ascending: false });
  }
  query = query.range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);

  const { data, count, error } = await query;
  if (error) throw error;

  // Closing-soon strip: posts expiring within 7 days.
  const soonCutoff = new Date(Date.now() + CLOSING_SOON_MS).toISOString();
  const { data: closingSoon } = await supabaseAdmin
    .from("callboard_posts")
    .select("id, title, deadline_text, expires_at")
    .eq("published", true)
    .eq("status", "approved")
    .is("deleted_at", null)
    .not("expires_at", "is", null)
    .gte("expires_at", now)
    .lte("expires_at", soonCutoff)
    .order("expires_at", { ascending: true })
    .limit(5);

  // Total active count for the masthead (unfiltered).
  const { count: totalActive } = await supabaseAdmin
    .from("callboard_posts")
    .select("*", { count: "exact", head: true })
    .eq("published", true)
    .eq("status", "approved")
    .is("deleted_at", null);

  // Masthead lede - editable from /admin/content row 'callboard'.
  const { data: contentRow } = await supabaseAdmin
    .from("site_content")
    .select("body_markdown")
    .eq("slug", "callboard")
    .maybeSingle();

  return {
    posts: (data ?? []) as CallboardPost[],
    total: count ?? 0,
    totalActive: totalActive ?? 0,
    lede: contentRow?.body_markdown ?? "",
    closingSoon: (closingSoon ?? []) as Array<{
      id: string;
      title: string;
      deadline_text: string | null;
      expires_at: string;
    }>,
    postTypes,
    page,
    pageSize: PAGE_SIZE,
    activeTypes,
    verifiedOnly,
    sort,
    view,
  };
};
