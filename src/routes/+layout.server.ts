// Site-wide layout data: the active announcement banner and the footer
// tagline (both editable from /admin/content via the site_content +
// announcement_banner tables). Returned on every public route so the
// layout can render them above the nav and in the footer.
//
// The banner is now a list of items, not a single string - the active
// banner row may pull in callboard posts (either an explicit picked list
// or "all open posts") so the AnnouncementBanner component rotates
// through them.

import type { LayoutServerLoad } from "./$types";
import { supabaseAdmin } from "$lib/server/supabase";

export type BannerItem = {
  body: string;
  href: string | null;
};

export const load: LayoutServerLoad = async ({ url, locals }) => {
  const isAdmin = !!locals.admin;

  // Don't load banner / footer on admin routes - they use their own layout
  // chrome. Still expose isAdmin so the nav shortcut renders everywhere.
  if (url.pathname.startsWith("/admin")) {
    return { banner: null, footer: null, isAdmin };
  }

  const now = new Date().toISOString();
  const [bannerRes, footerRes] = await Promise.all([
    supabaseAdmin
      .from("announcement_banner")
      .select(
        `body_markdown, starts_at, ends_at,
         include_all_callboard, include_callboard_post_ids`,
      )
      .eq("enabled", true)
      .or(`starts_at.is.null,starts_at.lte.${now}`)
      .or(`ends_at.is.null,ends_at.gt.${now}`)
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabaseAdmin
      .from("site_content")
      .select("body_markdown")
      .eq("slug", "footer")
      .maybeSingle(),
  ]);

  const items: BannerItem[] = [];
  if (bannerRes.data) {
    const b = bannerRes.data;
    if (b.body_markdown?.trim()) {
      items.push({ body: b.body_markdown.trim(), href: null });
    }

    // Callboard posts - either everything currently open, or the picked
    // subset the admin selected.
    const ids = (b.include_callboard_post_ids ?? []) as string[];
    if (b.include_all_callboard || ids.length > 0) {
      let q = supabaseAdmin
        .from("callboard_posts")
        .select("id, title, organization_name, deadline_text, expires_at")
        .eq("status", "approved")
        .eq("published", true)
        .is("deleted_at", null)
        .order("expires_at", { ascending: true, nullsFirst: false });
      if (!b.include_all_callboard) {
        q = q.in("id", ids);
      }
      const { data: posts } = await q.limit(20);
      for (const p of posts ?? []) {
        // Compact form: "{Org}: {Title} - {deadline}"
        const tail = p.deadline_text ? ` - ${p.deadline_text}` : "";
        items.push({
          body: `${p.organization_name}: ${p.title}${tail}`,
          href: `/callboard/${p.id}`,
        });
      }
    }
  }

  return {
    banner: items.length > 0 ? items : null,
    footer: footerRes.data?.body_markdown ?? null,
    isAdmin,
  };
};
