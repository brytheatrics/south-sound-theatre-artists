// Site-wide layout data: the active announcement banner, footer
// tagline, and the editable nav labels (all from site_content +
// announcement_banner tables, all editable from /admin/content).
// Returned on every public route so the layout can render them above
// the nav and in the footer.

import type { LayoutServerLoad } from "./$types";
import { supabaseAdmin } from "$lib/server/supabase";

export type NavLabels = {
  directory: string;
  calendar: string;
  callboard: string;
  resources: string;
};

const NAV_LABEL_DEFAULTS: NavLabels = {
  directory: "Directory",
  calendar: "What's Playing",
  callboard: "Opportunities",
  resources: "Resources",
};

export const load: LayoutServerLoad = async ({ url, locals }) => {
  const isAdmin = !!locals.admin;

  // Don't load banner / footer on admin routes - they use their own layout
  // chrome. Still expose isAdmin so the nav shortcut renders everywhere,
  // and load nav labels (admin layout uses its own labels but we keep
  // the call lightweight either way).
  const navLabels = await loadNavLabels();

  if (url.pathname.startsWith("/admin")) {
    return { banner: null, footer: null, isAdmin, navLabels };
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
    navLabels,
  };
};

async function loadNavLabels(): Promise<NavLabels> {
  const { data } = await supabaseAdmin
    .from("site_content")
    .select("slug, title")
    .in("slug", ["nav.directory", "nav.calendar", "nav.callboard", "nav.resources"]);
  const out: NavLabels = { ...NAV_LABEL_DEFAULTS };
  for (const r of data ?? []) {
    const key = r.slug.replace(/^nav\./, "") as keyof NavLabels;
    if (r.title && key in out) out[key] = r.title;
  }
  return out;
}
