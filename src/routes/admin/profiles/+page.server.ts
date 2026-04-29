// /admin/profiles: searchable list of live profiles with publish toggle,
// soft-delete, and "send a fresh edit link" actions. Soft-deleted rows
// live in /admin/profiles/trash for 30 days.

import { fail } from "@sveltejs/kit";
import type { Actions, PageServerLoad } from "./$types";
import { PUBLIC_SITE_URL } from "$env/static/public";
import { supabaseAdmin } from "$lib/server/supabase";
import { sendEmail } from "$lib/server/email";
import { generateToken, hashToken } from "$lib/server/tokens";

const EDIT_TOKEN_TTL_MS = 24 * 60 * 60 * 1000;

const PAGE_SIZE = 50;

export const load: PageServerLoad = async ({ url }) => {
  const q = (url.searchParams.get("q") ?? "").trim();
  const sortParam = (url.searchParams.get("sort") ?? "").trim();
  const sort: "updated" | "newest" | "name" =
    sortParam === "newest" || sortParam === "name" ? sortParam : "updated";

  let query = supabaseAdmin
    .from("profiles")
    .select(
      "id, slug, full_name, email, geographic_area, disciplines, published, trusted, headshot_url, created_at, updated_at, member_since",
      { count: "exact" },
    )
    .is("deleted_at", null);
  if (q) query = query.or(`full_name.ilike.%${q}%,slug.ilike.%${q}%,email.ilike.%${q}%`);
  if (sort === "name") {
    query = query.order("last_name", { ascending: true });
  } else if (sort === "newest") {
    // member_since is day-resolution; tiebreak by created_at so the
    // most recently approved profile shows first within today's batch.
    query = query
      .order("member_since", { ascending: false })
      .order("created_at", { ascending: false });
  } else {
    query = query.order("updated_at", { ascending: false });
  }
  query = query.limit(PAGE_SIZE);
  const { data, count, error } = await query;
  if (error) throw error;

  const { count: trashCount } = await supabaseAdmin
    .from("profiles")
    .select("*", { count: "exact", head: true })
    .not("deleted_at", "is", null);

  return {
    profiles: data ?? [],
    total: count ?? 0,
    trashCount: trashCount ?? 0,
    q,
    sort,
  };
};

export const actions: Actions = {
  togglePublish: async ({ request }) => {
    const data = await request.formData();
    const id = (data.get("id") as string) ?? "";
    const publish = data.get("publish") === "true";
    if (!id) return fail(400, { error: "Missing id." });
    const { error } = await supabaseAdmin
      .from("profiles")
      .update({ published: publish })
      .eq("id", id);
    if (error) return fail(500, { error: "Could not update visibility." });
    return { ok: true };
  },

  toggleTrust: async ({ request }) => {
    const data = await request.formData();
    const id = (data.get("id") as string) ?? "";
    const trust = data.get("trust") === "true";
    if (!id) return fail(400, { error: "Missing id." });
    const { error } = await supabaseAdmin
      .from("profiles")
      .update({ trusted: trust })
      .eq("id", id);
    if (error) return fail(500, { error: "Could not update trust." });
    return { ok: true };
  },

  softDelete: async ({ request }) => {
    const data = await request.formData();
    const ids = data.getAll("id").map(String).filter(Boolean);
    if (ids.length === 0) return fail(400, { error: "Nothing selected." });
    const { error } = await supabaseAdmin
      .from("profiles")
      .update({ deleted_at: new Date().toISOString(), published: false })
      .in("id", ids);
    if (error) return fail(500, { error: "Could not delete." });
    return { deleted: ids.length };
  },

  sendEditLink: async ({ request }) => {
    const data = await request.formData();
    const id = (data.get("id") as string) ?? "";
    if (!id) return fail(400, { error: "Missing id." });
    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("id, email, full_name")
      .eq("id", id)
      .maybeSingle();
    if (!profile) return fail(404, { error: "Profile not found." });

    const token = generateToken();
    const tokenHash = hashToken(token);
    const expires = new Date(Date.now() + EDIT_TOKEN_TTL_MS).toISOString();
    await supabaseAdmin.from("magic_link_tokens").insert({
      token_hash: tokenHash,
      email: profile.email.toLowerCase(),
      purpose: "edit_profile",
      target_id: profile.id,
      expires_at: expires,
    });
    const editUrl = `${PUBLIC_SITE_URL}/edit/${token}`;
    const result = await sendEmail({
      to: profile.email,
      templateSlug: "magic_link_resend",
      vars: { name: profile.full_name, edit_url: editUrl },
    });
    if (!result.ok) {
      return fail(500, {
        error: `Token generated but email failed: ${result.reason}`,
      });
    }
    return { linkSent: profile.email };
  },
};
