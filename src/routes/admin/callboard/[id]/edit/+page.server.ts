// /admin/callboard/[id]/edit
//
// Lexi-facing fix-the-post page. Lets admin correct typos, swap the
// area chip, retype a deadline, etc. without dropping the row to
// trash and asking the original poster to resubmit.
//
// Scope: every column the public submit form writes, plus a couple of
// admin-only knobs (status, published, expires_at as a real date input).
// Doesn't touch submitter_email (identity), organization_id (set at
// submit time from email match), or the email-verification fields
// (which the verify endpoint owns).

import { error, fail, redirect } from "@sveltejs/kit";
import type { Actions, PageServerLoad } from "./$types";
import { supabaseAdmin } from "$lib/server/supabase";

const VALID_COMP_TYPES = ["paid", "stipend", "volunteer", "none"] as const;

function isValidUrl(s: string): boolean {
  try {
    const u = new URL(s.startsWith("http") ? s : `https://${s}`);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

// Cheap shape check so a malformed URL like /admin/callboard/foo/edit
// 404s cleanly instead of throwing a Postgres uuid-parse error.
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const load: PageServerLoad = async ({ params }) => {
  if (!params.id || !UUID_RE.test(params.id)) {
    throw error(404, "Post not found.");
  }

  const { data: post, error: postErr } = await supabaseAdmin
    .from("callboard_posts")
    .select(
      `id, post_type, title, organization_name, area_id, location,
       description, roles, compensation_type, compensation, contact_info,
       key_dates, deadline_text, expires_at, ticket_url, submitter_email,
       organization_id, status, published, created_at, updated_at,
       reviewed_at, deleted_at`,
    )
    .eq("id", params.id)
    .maybeSingle();

  if (postErr) {
    console.error("admin callboard edit load failed", postErr);
    throw error(500, "Could not load that post.");
  }
  if (!post) throw error(404, "Post not found.");

  const [areasRes, typesRes] = await Promise.all([
    supabaseAdmin.from("areas").select("id, name").order("sort_order"),
    supabaseAdmin
      .from("callboard_post_types")
      .select("slug, label, plural_label, sort_order")
      .order("sort_order"),
  ]);

  return {
    post,
    areas: areasRes.data ?? [],
    postTypes: typesRes.data ?? [],
  };
};

export const actions: Actions = {
  save: async ({ request, params }) => {
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
    const status = String(fd.get("status") ?? "").trim();
    const published = fd.get("published") === "on";

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

    // Validate post_type against the live admin-managed table.
    const { data: typeRow } = await supabaseAdmin
      .from("callboard_post_types")
      .select("slug")
      .eq("slug", post_type)
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

    if (!["pending_email", "pending_review", "approved", "rejected"].includes(status)) {
      errors.status = "Invalid status.";
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

    const { error: updErr } = await supabaseAdmin
      .from("callboard_posts")
      .update({
        title,
        organization_name,
        area_id,
        location: location || null,
        post_type,
        description,
        roles,
        compensation_type: compensation_type || null,
        compensation: compensation || null,
        contact_info: contact_info || null,
        deadline_text: deadline_text || null,
        expires_at,
        ticket_url: ticket_url || null,
        status,
        published,
      })
      .eq("id", params.id);

    if (updErr) {
      console.error("admin callboard save failed", updErr);
      return fail(500, { errors: { _form: "Could not save. " + updErr.message } });
    }

    throw redirect(303, `/admin/callboard/${params.id}/edit?saved=1`);
  },
};
