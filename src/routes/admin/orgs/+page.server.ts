// /admin/orgs: manage verified theatre organization applications.
// Approve grants verified status (posts go live without per-post review).
// Revoke removes it. Soft-delete moves to hidden.

import { fail } from "@sveltejs/kit";
import type { Actions, PageServerLoad } from "./$types";
import { PUBLIC_SITE_URL } from "$env/static/public";
import { supabaseAdmin } from "$lib/server/supabase";
import { sendEmail } from "$lib/server/email";

export const load: PageServerLoad = async ({ url }) => {
  const q = (url.searchParams.get("q") ?? "").trim();
  const verifiedFilter = url.searchParams.get("verified") ?? "";

  let query = supabaseAdmin
    .from("verified_orgs")
    .select("id, name, contact_email, website_url, description, verified, created_at", {
      count: "exact",
    })
    .is("deleted_at", null);

  if (q) {
    query = query.or(`name.ilike.%${q}%,contact_email.ilike.%${q}%`);
  }
  if (verifiedFilter === "1") {
    query = query.eq("verified", true);
  } else if (verifiedFilter === "0") {
    query = query.eq("verified", false);
  }

  query = query.order("created_at", { ascending: false });

  const { data, count, error } = await query;
  if (error) throw error;

  return {
    orgs: data ?? [],
    total: count ?? 0,
    q,
    verifiedFilter,
  };
};

export const actions: Actions = {
  approve: async ({ request }) => {
    const data = await request.formData();
    const ids = data.getAll("id").map(String).filter(Boolean);
    if (ids.length === 0) return fail(400, { error: "Nothing selected." });

    for (const id of ids) {
      const { data: org } = await supabaseAdmin
        .from("verified_orgs")
        .select("name, contact_email")
        .eq("id", id)
        .maybeSingle();
      if (!org) continue;

      await supabaseAdmin
        .from("verified_orgs")
        .update({ verified: true })
        .eq("id", id);

      await sendEmail({
        to: org.contact_email,
        templateSlug: "org_approved",
        vars: {
          name: org.name,
          org_name: org.name,
          callboard_url: `${PUBLIC_SITE_URL}/callboard`,
          calendar_url: `${PUBLIC_SITE_URL}/calendar`,
        },
      });
    }

    return { approved: ids.length };
  },

  revoke: async ({ request }) => {
    const data = await request.formData();
    const ids = data.getAll("id").map(String).filter(Boolean);
    if (ids.length === 0) return fail(400, { error: "Nothing selected." });
    const { error } = await supabaseAdmin
      .from("verified_orgs")
      .update({ verified: false })
      .in("id", ids);
    if (error) return fail(500, { error: "Could not revoke." });
    return { revoked: ids.length };
  },

  softDelete: async ({ request }) => {
    const data = await request.formData();
    const ids = data.getAll("id").map(String).filter(Boolean);
    if (ids.length === 0) return fail(400, { error: "Nothing selected." });
    const { error } = await supabaseAdmin
      .from("verified_orgs")
      .update({ deleted_at: new Date().toISOString(), verified: false })
      .in("id", ids);
    if (error) return fail(500, { error: "Could not delete." });
    return { deleted: ids.length };
  },
};
