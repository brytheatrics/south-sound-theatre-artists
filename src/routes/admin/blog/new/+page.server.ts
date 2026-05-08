// /admin/blog/new: create a fresh draft row and redirect to its edit page.

import { error, fail, redirect } from "@sveltejs/kit";
import type { Actions, PageServerLoad } from "./$types";
import { supabaseAdmin } from "$lib/server/supabase";

function slugify(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

export const load: PageServerLoad = async ({ locals }) => {
  if (!locals.admin) error(401, "Admin only.");
  return {};
};

// Look up the logged-in admin's display name to use as the post's
// default author byline. Falls back to email local-part, then to a
// generic "SSTA" if nothing's set.
async function defaultAuthorName(adminUserId: string | null): Promise<string> {
  if (!adminUserId) return "SSTA";
  const { data } = await supabaseAdmin
    .from("admin_users")
    .select("name, email")
    .eq("id", adminUserId)
    .maybeSingle();
  if (!data) return "SSTA";
  if (data.name && data.name.trim()) return data.name.trim();
  if (data.email) return data.email.split("@")[0];
  return "SSTA";
}

export const actions: Actions = {
  default: async ({ request, locals }) => {
    if (!locals.admin) error(401, "Admin only.");
    const fd = await request.formData();
    const title = ((fd.get("title") as string) ?? "").trim();
    if (!title) return fail(400, { error: "Title is required." });
    let slug = slugify(((fd.get("slug") as string) ?? title));
    if (!slug) slug = "post-" + Date.now();

    // Slug-collision: append -2, -3, etc.
    let candidate = slug;
    let n = 1;
    while (true) {
      const { data: existing } = await supabaseAdmin
        .from("blog_posts")
        .select("id")
        .eq("slug", candidate)
        .is("deleted_at", null)
        .maybeSingle();
      if (!existing) break;
      n += 1;
      candidate = `${slug}-${n}`;
    }

    const authorName = await defaultAuthorName(locals.admin?.admin_user_id ?? null);

    const { data: created, error: insertErr } = await supabaseAdmin
      .from("blog_posts")
      .insert({
        slug: candidate,
        title,
        body_markdown: "",
        author_admin_user_id: locals.admin?.admin_user_id ?? null,
        author_display_name: authorName,
      })
      .select("id")
      .single();
    if (insertErr || !created) {
      return fail(500, { error: "Could not create post." });
    }
    throw redirect(303, `/admin/blog/${created.id}/edit`);
  },
};
