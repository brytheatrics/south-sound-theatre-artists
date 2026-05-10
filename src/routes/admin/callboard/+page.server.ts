// /admin/callboard: searchable list of all callboard posts with
// approve / reject / soft-delete actions. Mirrors /admin/profiles.

import { fail } from "@sveltejs/kit";
import type { Actions, PageServerLoad } from "./$types";
import { PUBLIC_SITE_URL } from "$env/static/public";
import { supabaseAdmin } from "$lib/server/supabase";
import { sendEmail } from "$lib/server/email";
import { loadVerifiedOrgIds } from "$lib/server/verifiedOrgs";

const PAGE_SIZE = 50;

export const load: PageServerLoad = async ({ url }) => {
  const q = (url.searchParams.get("q") ?? "").trim();
  const statusFilter = (url.searchParams.get("status") ?? "").trim();
  const typeFilter = (url.searchParams.get("type") ?? "").trim();
  const pageParam = url.searchParams.get("page") ?? "";
  const page =
    /^\d+$/.test(pageParam) && Number(pageParam) > 0 ? Number(pageParam) : 1;

  let query = supabaseAdmin
    .from("callboard_posts")
    .select(
      `id, post_type, title, organization_name, location, area_id, submitter_email,
       status, published, organization_id, expires_at, created_at, reviewed_at,
       rejection_reason`,
      { count: "exact" },
    )
    .is("deleted_at", null);

  if (q) {
    query = query.or(
      `title.ilike.%${q}%,organization_name.ilike.%${q}%,submitter_email.ilike.%${q}%`,
    );
  }
  const validStatuses = ["pending_email", "pending_review", "approved", "rejected"];
  if (statusFilter && validStatuses.includes(statusFilter)) {
    query = query.eq("status", statusFilter);
  }
  // Active + inactive post types - admin should be able to filter by
  // any type that has posts, even if it's been deactivated.
  const { data: postTypes } = await supabaseAdmin
    .from("callboard_post_types")
    .select("slug, label")
    .order("sort_order");
  const validTypeSlugs = (postTypes ?? []).map((t) => t.slug);
  if (typeFilter && validTypeSlugs.includes(typeFilter)) {
    query = query.eq("post_type", typeFilter);
  }

  query = query
    .order("created_at", { ascending: false })
    .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);

  const { data, count, error } = await query;
  if (error) throw error;

  const { count: trashCount } = await supabaseAdmin
    .from("callboard_posts")
    .select("*", { count: "exact", head: true })
    .not("deleted_at", "is", null);

  const { count: pendingCount } = await supabaseAdmin
    .from("callboard_posts")
    .select("*", { count: "exact", head: true })
    .eq("status", "pending_review")
    .is("deleted_at", null);

  // Areas for resolving area_id -> name in the row display. Cheap and
  // small (~6 rows) - fine to refetch per page load.
  const { data: areaRows } = await supabaseAdmin
    .from("areas")
    .select("id, name");
  const areaNameById = new Map(
    (areaRows ?? []).map((a) => [a.id, a.name]),
  );
  // Resolve "verified" badges from the actual orgs.verified flag, not
  // from the presence of organization_id (admin-authored posts can
  // legitimately link to an unverified producing theatre and shouldn't
  // earn the verified badge).
  const verifiedOrgIds = await loadVerifiedOrgIds();
  const enrichedPosts = (data ?? []).map((p) => ({
    ...p,
    area_name: p.area_id ? areaNameById.get(p.area_id) ?? null : null,
    is_verified: !!p.organization_id && verifiedOrgIds.has(p.organization_id),
  }));

  return {
    posts: enrichedPosts,
    total: count ?? 0,
    trashCount: trashCount ?? 0,
    pendingCount: pendingCount ?? 0,
    postTypes: postTypes ?? [],
    page,
    pageSize: PAGE_SIZE,
    q,
    statusFilter,
    typeFilter,
  };
};

export const actions: Actions = {
  approve: async ({ request }) => {
    const data = await request.formData();
    const ids = data.getAll("id").map(String).filter(Boolean);
    if (ids.length === 0) return fail(400, { error: "Nothing selected." });

    for (const id of ids) {
      const { data: post } = await supabaseAdmin
        .from("callboard_posts")
        .select("id, title, organization_name, submitter_email, post_type, location, ticket_url")
        .eq("id", id)
        .maybeSingle();
      if (!post) continue;

      await supabaseAdmin
        .from("callboard_posts")
        .update({
          status: "approved",
          published: true,
          reviewed_at: new Date().toISOString(),
        })
        .eq("id", id);

      // Populate productions for audition / production posts.
      if (post.post_type === "audition" || post.post_type === "production") {
        const { count: existing } = await supabaseAdmin
          .from("productions")
          .select("*", { count: "exact", head: true })
          .eq("callboard_post_id", id);
        if (!existing) {
          await supabaseAdmin.from("productions").insert({
            callboard_post_id: id,
            title: post.title,
            organization_name: post.organization_name,
            location: post.location ?? null,
            ticket_url: post.ticket_url ?? null,
          });
        }
      }

      await sendEmail({
        to: post.submitter_email,
        templateSlug: "callboard_approved",
        vars: {
          name: post.organization_name,
          title: post.title,
          callboard_url: `${PUBLIC_SITE_URL}/callboard`,
        },
      });
    }

    return { approved: ids.length };
  },

  reject: async ({ request }) => {
    const data = await request.formData();
    const ids = data.getAll("id").map(String).filter(Boolean);
    const reason = ((data.get("reason") as string) ?? "").trim();
    if (ids.length === 0) return fail(400, { error: "Nothing selected." });
    if (!reason) {
      return fail(400, { error: "Include a reason - it goes in the email to the submitter." });
    }

    for (const id of ids) {
      const { data: post } = await supabaseAdmin
        .from("callboard_posts")
        .select("submitter_email, organization_name, title")
        .eq("id", id)
        .maybeSingle();
      if (!post) continue;

      await supabaseAdmin
        .from("callboard_posts")
        .update({
          status: "rejected",
          published: false,
          rejection_reason: reason,
          reviewed_at: new Date().toISOString(),
        })
        .eq("id", id);

      await sendEmail({
        to: post.submitter_email,
        templateSlug: "callboard_rejected",
        vars: {
          name: post.organization_name,
          title: post.title,
          reason,
        },
      });
    }

    return { rejected: ids.length };
  },

  softDelete: async ({ request }) => {
    const data = await request.formData();
    const ids = data.getAll("id").map(String).filter(Boolean);
    if (ids.length === 0) return fail(400, { error: "Nothing selected." });
    const { error } = await supabaseAdmin
      .from("callboard_posts")
      .update({ deleted_at: new Date().toISOString(), published: false })
      .in("id", ids);
    if (error) return fail(500, { error: "Could not delete." });
    return { deleted: ids.length };
  },
};
