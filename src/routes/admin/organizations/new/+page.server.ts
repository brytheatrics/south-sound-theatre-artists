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

function slugify(name: string): string {
  const base = name
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^\w\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .slice(0, 60);
  return base || "org";
}

export const actions: Actions = {
  create: async ({ request }) => {
    const fd = await request.formData();

    const name = String(fd.get("name") ?? "").trim();
    const area_id = String(fd.get("area_id") ?? "").trim() || null;
    const description = String(fd.get("description") ?? "").trim();
    const homepage_url = String(fd.get("homepage_url") ?? "").trim();
    const source_url = String(fd.get("source_url") ?? "").trim();
    const notes = String(fd.get("notes") ?? "").trim();

    const errors: Record<string, string> = {};
    if (!name) errors.name = "Required.";
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

    if (Object.keys(errors).length > 0) {
      return fail(400, {
        errors,
        values: { name, area_id, description, homepage_url, source_url, notes },
      });
    }

    // Slug: derived from name, with a 4-char random suffix on collision.
    // Admin only sees the slug indirectly (it shows on the list page);
    // collision-suffixing is fine since it's not part of any URL.
    const baseSlug = slugify(name);
    let slug = baseSlug;
    const { data: clash } = await supabaseAdmin
      .from("organizations")
      .select("id")
      .eq("slug", baseSlug)
      .maybeSingle();
    if (clash) {
      slug = `${baseSlug}-${Math.random().toString(36).slice(2, 6)}`;
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
        values: { name, area_id, description, homepage_url, source_url, notes },
      });
    }

    throw redirect(303, `/admin/organizations?created=${row.slug}`);
  },
};
