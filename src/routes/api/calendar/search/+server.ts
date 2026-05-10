// GET /api/calendar/search?q=...
// Powers the typeahead dropdown on /calendar. Returns up to 8 upcoming
// (or currently-running) productions whose title or organization_name
// matches the query case-insensitively. Public endpoint - same data
// the page-level search renders, just shaped for inline suggestions.

import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { supabaseAdmin } from "$lib/server/supabase";

const MAX = 8;

export const GET: RequestHandler = async ({ url }) => {
  const q = (url.searchParams.get("q") ?? "").trim();
  if (q.length < 2) return json({ matches: [] });

  // Same input sanitiser as the page-level search.
  const safe = q.replace(/[%_,]/g, "");
  if (!safe) return json({ matches: [] });

  const today = new Date().toISOString().slice(0, 10);

  const { data, error } = await supabaseAdmin
    .from("productions")
    .select("id, title, organization_name, run_start, run_end, is_ssta_event")
    .eq("status", "approved")
    .is("deleted_at", null)
    .is("hidden_at", null)
    .or(`run_end.is.null,run_end.gte.${today}`)
    .or(`title.ilike.%${safe}%,organization_name.ilike.%${safe}%`)
    .order("is_ssta_event", { ascending: false })
    .order("run_start", { ascending: true })
    .limit(MAX);

  if (error) {
    return json({ matches: [], error: error.message }, { status: 500 });
  }

  return json({
    matches: (data ?? []).map((p) => ({
      id: p.id,
      title: p.title,
      organization_name: p.organization_name,
      run_start: p.run_start,
      run_end: p.run_end,
      is_ssta_event: !!p.is_ssta_event,
    })),
  });
};
