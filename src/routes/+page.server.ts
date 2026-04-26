// Homepage data: counts + featured pool + recently-added grid.
// Featured rotation is keyed by today's date so the same 4 artists show
// throughout a day and rotate the next morning.

import type { PageServerLoad } from "./$types";
import { supabaseAdmin } from "$lib/server/supabase";

type ProfileRow = {
  slug: string;
  full_name: string;
  pronouns: string | null;
  disciplines: string[];
  geographic_area: string | null;
  member_since: string;
  headshot_url: string | null;
};

export const load: PageServerLoad = async () => {
  const [countRes, featuredPoolRes, recentRes] = await Promise.all([
    supabaseAdmin
      .from("profiles")
      .select("*", { count: "exact", head: true })
      .eq("published", true)
      .is("deleted_at", null),
    supabaseAdmin
      .from("profiles")
      .select(
        "slug, full_name, pronouns, disciplines, geographic_area, member_since, headshot_url",
      )
      .eq("published", true)
      .is("deleted_at", null),
    supabaseAdmin
      .from("profiles")
      .select(
        "slug, full_name, pronouns, disciplines, geographic_area, member_since, headshot_url",
      )
      .eq("published", true)
      .is("deleted_at", null)
      .order("member_since", { ascending: false })
      .limit(4),
  ]);

  if (featuredPoolRes.error) throw featuredPoolRes.error;
  if (recentRes.error) throw recentRes.error;

  const all = (featuredPoolRes.data ?? []) as ProfileRow[];

  // Date-seeded shuffle so the day's pool stays stable across reloads.
  const today = new Date().toISOString().slice(0, 10);
  const featured = pickDailyFeatured(all, today, 4);

  return {
    artistCount: countRes.count ?? 0,
    featured,
    recent: (recentRes.data ?? []) as ProfileRow[],
  };
};

function pickDailyFeatured<T>(items: T[], seed: string, n: number): T[] {
  if (items.length <= n) return items;
  // Mulberry32-ish: hash the seed string into a 32-bit int, then a
  // deterministic Fisher-Yates over a copy. Same seed => same order.
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  let state = h >>> 0;
  const rand = () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const arr = items.slice();
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr.slice(0, n);
}
