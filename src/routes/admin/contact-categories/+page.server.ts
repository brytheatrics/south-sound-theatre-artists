// /admin/contact-categories: edit per-category routing for the public
// /contact form. Slugs are immutable (linked to contact_submissions);
// label, description, primary_email, and cc_emails are editable.

import { fail } from "@sveltejs/kit";
import type { Actions, PageServerLoad } from "./$types";
import { supabaseAdmin } from "$lib/server/supabase";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const load: PageServerLoad = async () => {
  const { data, error } = await supabaseAdmin
    .from("contact_categories")
    .select("*")
    .order("sort_order");
  if (error) throw error;
  return { categories: data ?? [] };
};

export const actions: Actions = {
  save: async ({ request }) => {
    const data = await request.formData();
    const slug = ((data.get("slug") as string) ?? "").trim();
    const label = ((data.get("label") as string) ?? "").trim();
    const description = ((data.get("description") as string) ?? "").trim();
    const primary_email = ((data.get("primary_email") as string) ?? "").trim().toLowerCase();
    const ccRaw = ((data.get("cc_emails") as string) ?? "").trim();
    const cc_emails = ccRaw
      .split(/[,\n]/)
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean);

    if (!slug || !label || !primary_email) {
      return fail(400, { error: "slug, label, and primary email are required." });
    }
    if (!EMAIL_RE.test(primary_email)) {
      return fail(400, { error: "Primary email isn't a valid address." });
    }
    for (const e of cc_emails) {
      if (!EMAIL_RE.test(e)) {
        return fail(400, { error: `CC "${e}" isn't a valid address.` });
      }
    }

    const { error } = await supabaseAdmin
      .from("contact_categories")
      .update({
        label,
        description: description || null,
        primary_email,
        cc_emails,
        updated_at: new Date().toISOString(),
      })
      .eq("slug", slug);
    if (error) {
      console.error("contact_categories update failed", error);
      return fail(500, { error: "Could not save." });
    }
    return { savedSlug: slug };
  },
};
