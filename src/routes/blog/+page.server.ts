// /blog: public list of published posts.

import type { PageServerLoad } from "./$types";
import { supabaseAdmin } from "$lib/server/supabase";
import { CACHE_MEDIUM } from "$lib/server/cache-headers";

export const load: PageServerLoad = async ({ setHeaders }) => {
  setHeaders({ "cache-control": CACHE_MEDIUM });
  const [postsRes, lederes] = await Promise.all([
    supabaseAdmin
      .from("blog_posts")
      .select("slug, title, body_markdown, cover_url, author_display_name, published_at")
      .eq("published", true)
      .lte("published_at", new Date().toISOString())
      .is("deleted_at", null)
      .order("published_at", { ascending: false }),
    supabaseAdmin
      .from("site_content")
      .select("slug, body_markdown")
      .in("slug", ["blog_lede", "blog_empty"]),
  ]);
  const content: Record<string, string> = {};
  for (const r of lederes.data ?? []) {
    content[r.slug] = r.body_markdown ?? "";
  }
  return {
    posts: postsRes.data ?? [],
    lede: content["blog_lede"] ?? "",
    emptyState: content["blog_empty"] ?? "No posts yet.",
  };
};
