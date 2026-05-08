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
    // Optional scheduled-publish datetime in the admin's local time
    // ("YYYY-MM-DDTHH:MM"). If provided AND in the future, the post
    // becomes visible automatically when the time arrives - the
    // public-side query filters published_at <= now(). If unset and
    // publish=true, we stamp published_at = now() like before.
    const scheduleAtRaw = ((fd.get("scheduled_at") as string) ?? "").trim();

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

    let publishedAt: string | null;
    if (!publish) {
      // Draft: keep any existing published_at as a memo, but the
      // public query gates on `published=true` anyway so it stays
      // hidden either way.
      publishedAt = existing?.published_at ?? null;
    } else if (scheduleAtRaw) {
      // The datetime-local input gives a "YYYY-MM-DDTHH:MM" string in
      // the admin's local time. JS Date constructor interprets it as
      // local; toISOString() converts to UTC for storage.
      const parsed = new Date(scheduleAtRaw);
      if (Number.isNaN(parsed.getTime())) {
        return fail(400, { error: "Couldn't parse the schedule time." });
      }
      publishedAt = parsed.toISOString();
    } else {
      // Publish-now: stamp published_at if it wasn't already set.
      publishedAt = existing?.published_at ?? new Date().toISOString();
    }

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
