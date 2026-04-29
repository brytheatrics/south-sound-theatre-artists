// Homepage data: counts + featured pool + recently-added grid + the
// marquee items shown in the scrolling ticker below the spotlight.
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
  city: string | null;
  member_since: string;
  headshot_url: string | null;
};

export type MarqueeItem = {
  id: string;
  glyph: string;
  text: string;
  href: string;
};

// Glyphs come from callboard_post_types now (Lexi configures per type
// from /admin/callboard-types). The fallback to "✦" handles posts
// whose post_type slug was deleted from the types table - rare but
// possible if a slug was renamed without re-tagging existing posts.

export const load: PageServerLoad = async () => {
  const [countRes, curatedRes, fallbackRes, recentRes, homeRes, marqueeRes] = await Promise.all([
    supabaseAdmin
      .from("profiles")
      .select("*", { count: "exact", head: true })
      .eq("published", true)
      .is("deleted_at", null),
    // Admin-curated featured pool. Active rows only.
    supabaseAdmin
      .from("featured_profiles")
      .select(
        "profiles(slug, full_name, pronouns, disciplines, geographic_area, city, member_since, headshot_url)",
      )
      .eq("active", true)
      .order("sort_order"),
    supabaseAdmin
      .from("profiles")
      .select(
        "slug, full_name, pronouns, disciplines, geographic_area, city, member_since, headshot_url",
      )
      .eq("published", true)
      .is("deleted_at", null),
    supabaseAdmin
      .from("profiles")
      .select(
        "slug, full_name, pronouns, disciplines, geographic_area, city, member_since, headshot_url",
      )
      .eq("published", true)
      .is("deleted_at", null)
      .order("member_since", { ascending: false })
      .limit(4),
    supabaseAdmin
      .from("site_content")
      .select("body_markdown")
      .eq("slug", "home")
      .maybeSingle(),
    supabaseAdmin
      .from("marquee_settings")
      .select("enabled, include_all_callboard, include_callboard_post_ids")
      .eq("id", 1)
      .maybeSingle(),
  ]);

  if (curatedRes.error) throw curatedRes.error;
  if (fallbackRes.error) throw fallbackRes.error;
  if (recentRes.error) throw recentRes.error;

  // Marquee assembly: pull approved + published callboard posts based on
  // the admin's settings, project them into compact ticker strings.
  const marqueeSettings = marqueeRes.data;
  let marquee: MarqueeItem[] = [];
  if (marqueeSettings?.enabled) {
    const ids = (marqueeSettings.include_callboard_post_ids ?? []) as string[];
    const wantAll = marqueeSettings.include_all_callboard;
    if (wantAll || ids.length > 0) {
      let q = supabaseAdmin
        .from("callboard_posts")
        .select("id, post_type, title, organization_name, deadline_text, expires_at, location")
        .eq("status", "approved")
        .eq("published", true)
        .is("deleted_at", null)
        .order("expires_at", { ascending: true, nullsFirst: false });
      if (!wantAll) q = q.in("id", ids);
      const { data: posts } = await q.limit(30);

      // Pull glyph map from the post types table so admin-added types
      // get their configured marquee glyph automatically.
      const { data: typeRows } = await supabaseAdmin
        .from("callboard_post_types")
        .select("slug, glyph");
      const glyphBySlug = new Map<string, string>(
        (typeRows ?? []).map((t) => [t.slug, t.glyph ?? "✦"]),
      );

      marquee = (posts ?? []).map((p) => {
        // Format: "{Org} - {Title}{deadline or location}"
        const tail = p.deadline_text
          ? `, ${p.deadline_text}`
          : p.location
          ? `, ${p.location}`
          : "";
        return {
          id: p.id,
          glyph: glyphBySlug.get(p.post_type) ?? "✦",
          text: `${p.organization_name} - ${p.title}${tail}`,
          href: `/callboard/${p.id}`,
        };
      });
    }
  }

  // Curated rotation has priority. Fall back to a date-seeded shuffle of
  // all published profiles.
  const curated = (curatedRes.data ?? [])
    .map((r: { profiles: ProfileRow | ProfileRow[] | null }) => {
      // Supabase returns an array for many-relation joins; we want a
      // singleton row per featured entry.
      if (Array.isArray(r.profiles)) return r.profiles[0] ?? null;
      return r.profiles;
    })
    .filter((p): p is ProfileRow => !!p);

  let featured: ProfileRow[];
  if (curated.length >= 4) {
    const today = new Date().toISOString().slice(0, 10);
    featured = pickDailyFeatured(curated, today, 4);
  } else if (curated.length > 0) {
    featured = curated;
  } else {
    const all = (fallbackRes.data ?? []) as ProfileRow[];
    const today = new Date().toISOString().slice(0, 10);
    featured = pickDailyFeatured(all, today, 4);
  }

  return {
    artistCount: countRes.count ?? 0,
    featured,
    recent: (recentRes.data ?? []) as ProfileRow[],
    homeBody: homeRes.data?.body_markdown ?? "",
    marquee,
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
