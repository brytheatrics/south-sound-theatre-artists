// Site-wide layout data: the active announcement banner and the footer
// tagline (both editable from /admin/content via the site_content +
// announcement_banner tables). Returned on every public route so the
// layout can render them above the nav and in the footer.

import type { LayoutServerLoad } from "./$types";
import { supabaseAdmin } from "$lib/server/supabase";

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
      .select("body_markdown, starts_at, ends_at")
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

  return {
    banner: bannerRes.data?.body_markdown ?? null,
    footer: footerRes.data?.body_markdown ?? null,
    isAdmin,
  };
};
