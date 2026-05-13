// /blog/[slug]: public detail page for a single post.

import { error } from "@sveltejs/kit";
import type { PageServerLoad } from "./$types";
import { supabaseAdmin } from "$lib/server/supabase";
import { CACHE_MEDIUM } from "$lib/server/cache-headers";

export const load: PageServerLoad = async ({ params, locals, setHeaders }) => {
  const isAdmin = !!locals.admin;
  if (!isAdmin) setHeaders({ "cache-control": CACHE_MEDIUM });
  let query = supabaseAdmin
    .from("blog_posts")
    .select("slug, title, body_markdown, cover_url, author_display_name, published, published_at")
    .eq("slug", params.slug)
    .is("deleted_at", null);
  if (!isAdmin) {
    query = query.eq("published", true).lte("published_at", new Date().toISOString());
  }
  const { data } = await query.maybeSingle();
  if (!data) error(404, "Post not found.");
  return { post: data };
};
