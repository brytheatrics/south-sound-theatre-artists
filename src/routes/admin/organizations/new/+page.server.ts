// /admin/organizations/new
//
// Admin-side "add a theatre we know exists but isn't in the system."
// Defaults to adapter='manual' so the cron leaves it alone - admin can
// promote it to 'ai-generic' from /admin/organizations once Blake has
// checked whether the org's source page is scrapeable. Logo + finer
// metadata are filled in via the per-row publicEdit disclosure on the
// list page after create.

import { fail, redirect } from "@sveltejs/kit";
import type { Actions, PageServerLoad } from "./$types";
import { supabaseAdmin } from "$lib/server/supabase";

export const load: PageServerLoad = async () => {
  const { data: areas } = await supabaseAdmin
    .from("areas")
    .select("id, name, sort_order")
    .order("sort_order");
  return { areas: areas ?? [] };
};

function looksLikeUrl(s: string): boolean {
  return /^https?:\/\//i.test(s);
}

export const actions: Actions = {
  create: async ({ request }) => {
    const fd = await request.formData();

    const name = String(fd.get("name") ?? "").trim();
    const slug = String(fd.get("slug") ?? "").trim().toLowerCase();
    const area_id = String(fd.get("area_id") ?? "").trim() || null;
    const description = String(fd.get("description") ?? "").trim();
    const homepage_url = String(fd.get("homepage_url") ?? "").trim();
    const source_url = String(fd.get("source_url") ?? "").trim();
    const notes = String(fd.get("notes") ?? "").trim();
    const logo_url = String(fd.get("logo_url") ?? "").trim();
    const logo_bg = String(fd.get("logo_bg") ?? "paper").trim();

    const errors: Record<string, string> = {};
    if (!name) errors.name = "Required.";

    // Slug: required, lowercase ascii + dashes, 2-60 chars, unique.
    if (!slug) {
      errors.slug = "Required.";
    } else if (!/^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/.test(slug) || slug.length > 60) {
      errors.slug =
        "Use 2-60 lowercase letters, numbers, and dashes only. No leading/trailing dash.";
    } else {
      const { data: clash } = await supabaseAdmin
        .from("organizations")
        .select("id")
        .eq("slug", slug)
        .maybeSingle();
      if (clash) {
        errors.slug = `"${slug}" is already in use - pick something else.`;
      }
    }

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
    if (homepage_url && !looksLikeUrl(homepage_url)) {
      errors.homepage_url = "Must start with http:// or https://";
    }
    if (source_url && !looksLikeUrl(source_url)) {
      errors.source_url = "Must start with http:// or https://";
    }
    if (description.length > 500) {
      errors.description = "Keep under 500 characters.";
    }
    if (logo_url && !looksLikeUrl(logo_url)) {
      errors.logo_url = "Must start with http:// or https://";
    }
    const validBgs = ["paper", "paper-2", "bg-raised", "ink", "accent"];
    if (!validBgs.includes(logo_bg)) {
      errors.logo_bg = "Pick a valid logo background.";
    }

    const allValues = { name, slug, area_id, description, homepage_url, source_url, notes, logo_url, logo_bg };

    if (Object.keys(errors).length > 0) {
      return fail(400, { errors, values: allValues });
    }

    const { data: row, error: insErr } = await supabaseAdmin
      .from("organizations")
      .insert({
        slug,
        name,
        area_id,
        description: description || null,
        homepage_url: homepage_url || null,
        source_url: source_url || null,
        notes: notes || null,
        logo_url: logo_url || null,
        logo_bg,
        adapter: "manual",
        active: true,
        verified: false,
      })
      .select("id, slug")
      .single();

    if (insErr || !row) {
      console.error("organizations insert failed", insErr);
      return fail(500, {
        errors: { _form: "Could not save: " + (insErr?.message ?? "unknown") },
        values: allValues,
      });
    }

    throw redirect(303, `/admin/organizations?created=${row.slug}`);
  },
};
