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

// "volunteer" was dropped from the form vocabulary. Kept here in case
// any pre-mig-106 row in the DB still carries the legacy value - admin
// editing such a row shouldn't trip a validation error just because
// the type got renamed.
const VALID_COMP_TYPES = ["paid", "stipend", "none", "volunteer"] as const;
const MAX_POST_DURATION_DAYS = 90;

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
       key_dates, publish_at, expires_at, ticket_url, submitter_email,
       organization_id, status, published, is_ssta_event, created_at, updated_at,
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
    const publish_at_raw = String(fd.get("publish_at") ?? "").trim();
    const expires_at_raw = String(fd.get("expires_at") ?? "").trim();
    const ticket_url = String(fd.get("ticket_url") ?? "").trim();
    const status = String(fd.get("status") ?? "").trim();
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

    // Validate post_type against the live admin-managed table.
    const { data: typeRow } = await supabaseAdmin
      .from("callboard_post_types")
      .select("slug")
      .eq("slug", post_type)
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
    // public submit form. On edit we don't enforce publish_at >= today
    // because admin may be editing a post originally scheduled in the
    // past; the validator only cares about valid date + the
    // 90-days-after-publish ceiling for expires_at.
    let publish_at: string | null = null;
    if (!publish_at_raw) {
      errors.publish_at = "Required.";
    } else {
      const d = new Date(`${publish_at_raw}T00:00:00Z`);
      if (isNaN(d.getTime())) {
        errors.publish_at = "Enter a valid date.";
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
        compensation:
          compensation_type === "paid" || compensation_type === "stipend"
            ? compensation || null
            : null,
        contact_info: contact_info || null,
        publish_at,
        expires_at,
        ticket_url: ticket_url || null,
        status,
        published,
        is_ssta_event,
      })
      .eq("id", params.id);

    if (updErr) {
      console.error("admin callboard save failed", updErr);
      return fail(500, { errors: { _form: "Could not save. " + updErr.message } });
    }

    throw redirect(303, `/admin/callboard/${params.id}/edit?saved=1`);
  },
};
