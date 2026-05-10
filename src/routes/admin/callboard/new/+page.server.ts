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

// "volunteer" was dropped in favour of "none" - kept in this constant
// so callboard rows already in the DB with comp_type='volunteer' don't
// trigger validation errors when admin re-edits them. Form dropdown
// only offers paid / stipend / none for new entries.
const VALID_COMP_TYPES = ["paid", "stipend", "none"] as const;
const MAX_POST_DURATION_DAYS = 90;

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
    const publish_at_raw = String(fd.get("publish_at") ?? "").trim();
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

    if (!compensation_type) {
      errors.compensation_type = "Pick a compensation type.";
    } else if (!VALID_COMP_TYPES.includes(compensation_type as typeof VALID_COMP_TYPES[number])) {
      errors.compensation_type = "Invalid compensation type.";
    }
    if (!contact_info) {
      errors.contact_info = "Required - tell artists how to reach you or apply.";
    }
    if (ticket_url && !isValidUrl(ticket_url)) {
      errors.ticket_url = "Must be a valid URL.";
    }

    // Post date + expiration: required + 90-day cap, mirroring the
    // public submit form. Server-side compare on the YYYY-MM-DD string
    // so timezone math doesn't shift the boundary.
    const todayIso = new Date().toISOString().slice(0, 10);
    let publish_at: string | null = null;
    if (!publish_at_raw) {
      errors.publish_at = "Required.";
    } else {
      const d = new Date(`${publish_at_raw}T00:00:00Z`);
      if (isNaN(d.getTime())) {
        errors.publish_at = "Enter a valid date.";
      } else if (publish_at_raw < todayIso) {
        errors.publish_at = "Post date can't be in the past.";
      } else {
        publish_at = d.toISOString();
      }
    }

    let expires_at: string | null = null;
    if (!expires_at_raw) {
      errors.expires_at = "Required.";
    } else {
      const exp = new Date(`${expires_at_raw}T00:00:00Z`);
      if (isNaN(exp.getTime())) {
        errors.expires_at = "Enter a valid date.";
      } else if (publish_at) {
        if (expires_at_raw < publish_at_raw) {
          errors.expires_at = "Expiration must be on or after the post date.";
        } else {
          const maxExp = new Date(publish_at);
          maxExp.setUTCDate(maxExp.getUTCDate() + MAX_POST_DURATION_DAYS);
          if (exp > maxExp) {
            errors.expires_at = `Expiration can be at most ${MAX_POST_DURATION_DAYS} days after the post date.`;
          } else {
            expires_at = exp.toISOString();
          }
        }
      }
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
        // Detail only carries meaning for paid / stipend; null out
        // anything the form leaks for "none".
        compensation:
          compensation_type === "paid" || compensation_type === "stipend"
            ? compensation || null
            : null,
        contact_info: contact_info || null,
        publish_at,
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
