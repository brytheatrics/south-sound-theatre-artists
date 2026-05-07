// /admin/blog/[id]/edit: full editor for a single blog post.

import { error, fail } from "@sveltejs/kit";
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

export const load: PageServerLoad = async ({ params, locals }) => {
  if (!locals.admin) error(401, "Admin only.");
  const { data: post } = await supabaseAdmin
    .from("blog_posts")
    .select("*")
    .eq("id", params.id)
    .maybeSingle();
  if (!post) error(404, "Post not found.");
  return { post };
};

export const actions: Actions = {
  save: async ({ params, request, locals }) => {
    if (!locals.admin) error(401, "Admin only.");
    const fd = await request.formData();
    const title = ((fd.get("title") as string) ?? "").trim();
    const slugInput = ((fd.get("slug") as string) ?? "").trim();
    const body = ((fd.get("body") as string) ?? "").trim();
    const coverUrl = ((fd.get("cover_url") as string) ?? "").trim();
    const authorName = ((fd.get("author") as string) ?? "").trim() || "Lexi Barnett";
    const publish = fd.get("publish") === "on";

    if (!title) return fail(400, { error: "Title is required." });
    let slug = slugify(slugInput || title);
    if (!slug) slug = "post-" + Date.now();

    // Slug-collision check (excluding current post).
    const { data: dup } = await supabaseAdmin
      .from("blog_posts")
      .select("id")
      .eq("slug", slug)
      .is("deleted_at", null)
      .neq("id", params.id)
      .maybeSingle();
    if (dup) return fail(409, { error: `Slug "${slug}" is taken by another post.` });

    const { data: existing } = await supabaseAdmin
      .from("blog_posts")
      .select("published, published_at")
      .eq("id", params.id)
      .maybeSingle();
    const wasPublished = existing?.published === true;
    const publishedAt = publish
      ? existing?.published_at ?? new Date().toISOString()
      : existing?.published_at ?? null;

    const { error: updErr } = await supabaseAdmin
      .from("blog_posts")
      .update({
        title,
        slug,
        body_markdown: body,
        cover_url: coverUrl || null,
        author_display_name: authorName,
        published: publish,
        published_at: publishedAt,
      })
      .eq("id", params.id);
    if (updErr) return fail(500, { error: "Could not save: " + updErr.message });
    return {
      saved: true,
      justPublished: publish && !wasPublished,
      slug,
    };
  },
};
