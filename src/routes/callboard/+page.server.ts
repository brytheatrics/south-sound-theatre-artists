// Public callboard: filterable list of approved posts. Filter state
// lives in URL params so views are shareable. Auto-expires stale posts
// on each page load so the board stays current without a cron.

import type { PageServerLoad } from "./$types";
import { supabaseAdmin } from "$lib/server/supabase";
import { loadVerifiedOrgIds } from "$lib/server/verifiedOrgs";

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
  organization_id: string | null;
  is_verified: boolean;
  is_ssta_event: boolean;
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
       expires_at, ticket_url, organization_id, is_ssta_event, created_at`,
      { count: "exact" },
    )
    .eq("published", true)
    .eq("status", "approved")
    .is("deleted_at", null)
    .lte("publish_at", now);

  // Filter to only the requested types that actually exist + are active.
  // Empty list = no filter, show all.
  const activeTypes = requestedTypes.filter((t) => validTypes.includes(t));
  if (activeTypes.length === 1) {
    query = query.eq("post_type", activeTypes[0]);
  } else if (activeTypes.length > 1) {
    query = query.in("post_type", activeTypes);
  }
  // Pull the set of *actually verified* org IDs up front so we can
  // both filter the verifiedOnly view and enrich each row's
  // is_verified flag from one source of truth. Linked-but-unverified
  // orgs (admin-authored posts attached to a producing theatre that
  // never went through the verified-application flow) used to falsely
  // earn the badge here - mig-pre fix bug.
  const verifiedOrgIds = await loadVerifiedOrgIds();
  const verifiedIdsArray = [...verifiedOrgIds];
  if (verifiedOnly) {
    if (verifiedIdsArray.length === 0) {
      // No verified orgs at all: short-circuit to "no rows" semantics.
      // .in([]) returns nothing in PostgREST, but skipping the query
      // entirely saves a round-trip.
      query = query.eq("id", "00000000-0000-0000-0000-000000000000");
    } else {
      query = query.in("organization_id", verifiedIdsArray);
    }
  }
  // SSTA-tagged posts pin to the top within whatever sort the user
  // picked. Boolean DESC: true (1) sorts before false (0).
  query = query.order("is_ssta_event", { ascending: false });
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
    .lte("publish_at", now)
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
    .is("deleted_at", null)
    .lte("publish_at", now);

  // Masthead lede - editable from /admin/content row 'callboard'.
  const { data: contentRow } = await supabaseAdmin
    .from("site_content")
    .select("body_markdown")
    .eq("slug", "callboard")
    .maybeSingle();

  // Enrich each post with is_verified derived from the verifiedOrgIds
  // set. Means the renderer can gate the "Verified company" badge on
  // a single boolean instead of repeating the lookup logic.
  const posts: CallboardPost[] = (data ?? []).map((p) => ({
    ...(p as Omit<CallboardPost, "is_verified">),
    is_verified: !!p.organization_id && verifiedOrgIds.has(p.organization_id),
  }));

  return {
    posts,
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
