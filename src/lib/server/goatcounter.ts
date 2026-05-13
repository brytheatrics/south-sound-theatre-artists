// Server-side GoatCounter API helper. Used by /admin/invitations to
// show per-profile view counts so admin can see who's looked at their
// public page even if they haven't clicked their edit-link yet.
//
// API token comes from GOATCOUNTER_API_TOKEN (needs "Read statistics"
// only). Site comes from GOATCOUNTER_SITE_CODE - same value used by
// the public widget (PUBLIC_GOATCOUNTER_CODE) but exposed here as a
// private env var so the server doesn't have to read PUBLIC_*.

import { env as privateEnv } from "$env/dynamic/private";

const TOKEN = privateEnv.GOATCOUNTER_API_TOKEN ?? "";
const SITE = privateEnv.GOATCOUNTER_SITE_CODE ?? "";
const BASE = SITE ? `https://${SITE}.goatcounter.com/api/v0` : "";

// In-memory cache so repeated admin refreshes of /admin/invitations
// don't re-hit GoatCounter every time. View counts barely change from
// minute to minute; a 5-minute TTL is plenty fresh. Cache lives in the
// Netlify function instance memory - cold starts lose it, which is
// fine (no correctness issue, just a single fresh fetch on next call).
const TTL_MS = 5 * 60 * 1000;
const cache = new Map<string, { at: number; value: unknown }>();

async function apiGet(path: string): Promise<unknown> {
  if (!TOKEN || !BASE) throw new Error("GoatCounter env missing");
  const cached = cache.get(path);
  if (cached && Date.now() - cached.at < TTL_MS) {
    return cached.value;
  }
  const resp = await fetch(`${BASE}${path}`, {
    headers: { Authorization: `Bearer ${TOKEN}`, Accept: "application/json" },
  });
  if (!resp.ok) {
    throw new Error(`goatcounter ${path} -> ${resp.status}`);
  }
  const value = await resp.json();
  cache.set(path, { at: Date.now(), value });
  return value;
}

/**
 * For each `{ slug, sinceIso }` pair, return the total profile-page
 * view count from `sinceIso` (typically the artist's invited_at)
 * through today. Pre-invitation views are excluded so we don't
 * conflate launch-period engagement with admin testing earlier.
 *
 * Two API hits: one to map slug -> path_id, one for the daily-hit
 * breakdown across all path IDs at once. Per-profile filter happens
 * client-side against each slug's `since`. Slugs that GoatCounter
 * has no record of (never visited) come back as 0.
 */
export async function fetchProfileViewCounts(
  targets: Array<{ slug: string; sinceIso: string | null }>,
): Promise<Map<string, number>> {
  const out = new Map<string, number>();
  if (!TOKEN || !BASE || targets.length === 0) return out;

  // Need a single API-range start that covers the earliest-since
  // across all targets; we filter per-profile in JS below.
  const earliest = targets.reduce<string | null>((acc, t) => {
    if (!t.sinceIso) return acc;
    return !acc || t.sinceIso < acc ? t.sinceIso : acc;
  }, null);
  const start = earliest
    ? earliest.slice(0, 10)
    : new Date(Date.now() - 90 * 86_400_000).toISOString().slice(0, 10);
  const end = new Date().toISOString().slice(0, 10);

  const sinceBySlug = new Map(targets.map((t) => [t.slug, t.sinceIso]));
  const wantPaths = new Set(targets.map((t) => `/artists/${t.slug}`));

  try {
    const pathsResp = (await apiGet(`/paths?limit=500`)) as {
      paths: Array<{ id: number; path: string }>;
    };
    const idToPath = new Map<number, string>();
    const idsForBulk: number[] = [];
    for (const p of pathsResp.paths) {
      if (wantPaths.has(p.path)) {
        idToPath.set(p.id, p.path);
        idsForBulk.push(p.id);
      }
    }
    if (idsForBulk.length === 0) return out;

    const params = new URLSearchParams({
      start,
      end,
      include_paths: idsForBulk.join(","),
    });
    const hitsResp = (await apiGet(`/stats/hits?${params.toString()}`)) as {
      hits: Array<{
        count: number;
        path: string;
        stats: Array<{ day: string; hourly: number[]; daily: number }>;
      }>;
    };

    for (const h of hitsResp.hits) {
      const slug = h.path.replace(/^\/artists\//, "");
      const since = sinceBySlug.get(slug);
      if (!since) {
        // No invited_at -> caller doesn't want a window. Sum everything.
        out.set(slug, h.count);
        continue;
      }
      // Filter to days >= the invite date. GoatCounter day strings
      // are YYYY-MM-DD lexicographically comparable. We don't try to
      // filter by hour within the invite day - GoatCounter's hourly
      // array is indexed in the site's configured timezone, not UTC,
      // and the alignment math wasn't worth the precision (a handful
      // of pre-invite admin clicks on launch day are negligible noise
      // compared to losing real post-invite engagement counts).
      const sinceDay = since.slice(0, 10);
      let total = 0;
      for (const day of h.stats) {
        if (day.day < sinceDay) continue;
        total += day.daily;
      }
      out.set(slug, total);
    }
  } catch (err) {
    console.error("goatcounter view-count fetch failed", err);
  }
  return out;
}
