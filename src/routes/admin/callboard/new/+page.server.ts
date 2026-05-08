// /admin/callboard/new
//
// Admin-side compose for a new callboard post. Bypasses the public
// submit + email-verify flow - admin authored = trusted, status starts
// at 'approved' and the post publishes immediately on save (admin can
// untick "Published" if they want it staged).
//
// Mirrors the edit page (/admin/callboard/[id]/edit) field by field
// via a shared form component; this server-side just owns the insert
// branch.

import { error, fail, redirect } from "@sveltejs/kit";
import type { Actions, PageServerLoad } from "./$types";
import { supabaseAdmin } from "$lib/server/supabase";
import { ADMIN_EMAIL } from "$env/static/private";

const VALID_COMP_TYPES = ["paid", "stipend", "volunteer", "none"] as const;

function isValidUrl(s: string): boolean {
  try {
    const u = new URL(s.startsWith("http") ? s : `https://${s}`);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

export const load: PageServerLoad = async () => {
  const [areasRes, typesRes] = await Promise.all([
    supabaseAdmin.from("areas").select("id, name").order("sort_order"),
    supabaseAdmin
      .from("callboard_post_types")
      .select("slug, label, plural_label, sort_order")
      .eq("active", true)
      .order("sort_order"),
  ]);
  return {
    areas: areasRes.data ?? [],
    postTypes: typesRes.data ?? [],
  };
};

export const actions: Actions = {
  create: async ({ request }) => {
    const fd = await request.formData();

    const title = String(fd.get("title") ?? "").trim();
    const organization_name = String(fd.get("organization_name") ?? "").trim();
    const area_id = String(fd.get("area_id") ?? "").trim() || null;
    const location = String(fd.get("location") ?? "").trim();
    const post_type = String(fd.get("post_type") ?? "").trim();
    const description = String(fd.get("description") ?? "").trim();
    const rolesRaw = String(fd.get("roles") ?? "").trim();
    const compensation_type = String(fd.get("compensation_type") ?? "").trim();
    const compensation = String(fd.get("compensation") ?? "").trim();
    const contact_info = String(fd.get("contact_info") ?? "").trim();
    const deadline_text = String(fd.get("deadline_text") ?? "").trim();
    const expires_at_raw = String(fd.get("expires_at") ?? "").trim();
    const ticket_url = String(fd.get("ticket_url") ?? "").trim();
    const published = fd.get("published") === "on";
    const is_ssta_event = fd.get("is_ssta_event") === "1";

    const errors: Record<string, string> = {};
    if (!title) errors.title = "Required.";
    if (!organization_name) errors.organization_name = "Required.";
    if (!description) errors.description = "Required.";
    if (!area_id) {
      errors.area_id = "Pick an area.";
    } else {
      const { data: areaRow } = await supabaseAdmin
        .from("areas")
        .select("id")
        .eq("id", area_id)
        .maybeSingle();
      if (!areaRow) errors.area_id = "That area isn't recognised.";
    }

    const { data: typeRow } = await supabaseAdmin
      .from("callboard_post_types")
      .select("slug")
      .eq("slug", post_type)
      .eq("active", true)
      .maybeSingle();
    if (!typeRow) errors.post_type = "Pick a post type.";

    if (
      compensation_type &&
      !VALID_COMP_TYPES.includes(compensation_type as typeof VALID_COMP_TYPES[number])
    ) {
      errors.compensation_type = "Invalid compensation type.";
    }
    if (ticket_url && !isValidUrl(ticket_url)) {
      errors.ticket_url = "Must be a valid URL.";
    }

    let expires_at: string | null = null;
    if (expires_at_raw) {
      const d = new Date(expires_at_raw);
      if (isNaN(d.getTime())) errors.expires_at = "Enter a valid date.";
      else expires_at = d.toISOString();
    }

    if (Object.keys(errors).length > 0) {
      return fail(400, { errors });
    }

    const roles = rolesRaw
      ? rolesRaw
          .split(/[\n,]/)
          .map((r) => r.trim())
          .filter(Boolean)
          .slice(0, 20)
      : [];

    const { data: post, error: insErr } = await supabaseAdmin
      .from("callboard_posts")
      .insert({
        post_type,
        title,
        organization_name,
        area_id,
        location: location || null,
        description,
        roles,
        compensation_type: compensation_type || null,
        compensation: compensation || null,
        contact_info: contact_info || null,
        deadline_text: deadline_text || null,
        expires_at,
        ticket_url: ticket_url || null,
        // Admin-authored: stamp the admin email + auto-approve. The
        // submitter_email column has a NOT NULL constraint, so we use
        // ADMIN_EMAIL rather than nulling it. This also makes admin-
        // authored posts identifiable in the email log later.
        submitter_email: ADMIN_EMAIL.toLowerCase(),
        status: "approved",
        published,
        is_ssta_event,
        reviewed_at: new Date().toISOString(),
      })
      .select("id")
      .single();

    if (insErr || !post) {
      console.error("admin callboard insert failed", insErr);
      return fail(500, { errors: { _form: "Could not save: " + (insErr?.message ?? "unknown") } });
    }

    throw redirect(303, `/admin/callboard/${post.id}/edit?created=1`);
  },
};
