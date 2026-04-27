// Site-wide layout data: the active announcement banner if any. Returned
// to every route so the layout can render it above the nav.

import type { LayoutServerLoad } from "./$types";
import { supabaseAdmin } from "$lib/server/supabase";

export const load: LayoutServerLoad = async ({ url }) => {
  // Don't load on admin routes - they use their own layout chrome.
  if (url.pathname.startsWith("/admin")) return { banner: null };

  const now = new Date().toISOString();
  const { data } = await supabaseAdmin
    .from("announcement_banner")
    .select("body_markdown, starts_at, ends_at")
    .eq("enabled", true)
    .or(`starts_at.is.null,starts_at.lte.${now}`)
    .or(`ends_at.is.null,ends_at.gt.${now}`)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return { banner: data?.body_markdown ?? null };
};
