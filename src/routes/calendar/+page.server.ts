// Public calendar ("What's Playing"). Filterable list of upcoming
// performances across South Sound theatre, populated by the cron-driven
// auto-extractor and any manually-added entries. Filter state lives in
// URL params so views are shareable. View toggle (grid vs list) is also
// in URL state; mobile auto-switches to list via CSS regardless.

import type { PageServerLoad } from "./$types";
import { supabaseAdmin } from "$lib/server/supabase";
import { CACHE_SHORT } from "$lib/server/cache-headers";

export type Performance = {
  id: string;
  performs_at: string;
  note: string | null;
  production: {
    id: string;
    title: string;
    organization_name: string;
    detail_url: string | null;
    run_start: string | null;
    run_end: string | null;
    category_slug: string | null;
    category_name: string | null;
    area_id: string | null;
    area_name: string | null;
    is_ssta_event: boolean;
  };
};

export type Category = {
  id: string;
  slug: string;
  name: string;
  default_visible: boolean;
  sort_order: number;
};

export type Area = {
  id: string;
  name: string;
  sort_order: number;
};

export const load: PageServerLoad = async ({ url, setHeaders }) => {
  setHeaders({ "cache-control": CACHE_SHORT });
  const params = url.searchParams;

  // ---- Month -------------------------------------------------------
  // Format: YYYY-MM. Default to current month in Pacific Time.
  const monthParam = params.get("month");
  const now = new Date();
  let monthStart: Date;
  if (monthParam && /^\d{4}-\d{2}$/.test(monthParam)) {
    const [y, m] = monthParam.split("-").map(Number);
    monthStart = new Date(Date.UTC(y, m - 1, 1, 8, 0, 0)); // ~midnight PT
  } else {
    monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1, 8, 0, 0));
  }
  const monthEnd = new Date(
    Date.UTC(monthStart.getUTCFullYear(), monthStart.getUTCMonth() + 1, 1, 8, 0, 0),
  );
  const prevMonth = new Date(
    Date.UTC(monthStart.getUTCFullYear(), monthStart.getUTCMonth() - 1, 1, 8, 0, 0),
  );
  const nextMonth = new Date(
    Date.UTC(monthStart.getUTCFullYear(), monthStart.getUTCMonth() + 1, 1, 8, 0, 0),
  );
  const monthIso = (d: Date) =>
    `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;

  // ---- Search ------------------------------------------------------
  // When q is set, the page widens the date window from "just this
  // month" to "today through 12 months out" so a search hits across
  // months. Productions are filtered server-side by ilike on title +
  // organization_name. The grid view doesn't make sense across a
  // multi-month range, so we force list view while a search is active.
  const q = (params.get("q") ?? "").trim();
  const isSearching = q.length > 0;

  // ---- View --------------------------------------------------------
  // List view is forced when searching; otherwise honour the URL.
  const view = isSearching || params.get("view") === "list" ? "list" : "grid";

  // ---- Categories --------------------------------------------------
  const { data: catData } = await supabaseAdmin
    .from("event_categories")
    .select("id, slug, name, default_visible, sort_order")
    .order("sort_order");
  const categories = (catData ?? []) as Category[];

  // Active filter set: explicit ?cats=slug1,slug2 if given, else empty
  // (no filter = show all). Mirrors /directory's "no chip clicked =
  // showing everything" model. The default_visible flag on
  // event_categories no longer drives initial chip state - it's kept
  // on the column for potential future use.
  const catParam = params.get("cats");
  const activeCats: string[] = catParam
    ? catParam.split(",").map((s) => s.trim()).filter(Boolean)
    : [];

  // ---- Areas -------------------------------------------------------
  const { data: areaData } = await supabaseAdmin
    .from("areas")
    .select("id, name, sort_order")
    .order("sort_order");
  const areas = (areaData ?? []) as Area[];

  // Active areas filter: explicit ?areas=name1,name2 if given (URL-decoded),
  // else null = "show all" (no filter applied).
  const areaParam = params.get("areas");
  const activeAreaNames: string[] | null = areaParam
    ? areaParam.split(",").map((s) => s.trim()).filter(Boolean)
    : null;
  const activeAreaIds: string[] | null = activeAreaNames
    ? areas.filter((a) => activeAreaNames.includes(a.name)).map((a) => a.id)
    : null;

  // ---- Performances ------------------------------------------------
  // Date window: just the current month for the regular calendar view,
  // or today -> 12 months out when a search is active so results hit
  // across months. Soft cap on row count keeps the response sane if the
  // search is broad.
  const perfStart = isSearching ? new Date() : monthStart;
  const perfEnd = isSearching
    ? new Date(Date.UTC(now.getUTCFullYear() + 1, now.getUTCMonth(), now.getUTCDate(), 8, 0, 0))
    : monthEnd;

  const { data: perfRows } = await supabaseAdmin
    .from("performances")
    .select("id, performs_at, note, production_id")
    .gte("performs_at", perfStart.toISOString())
    .lt("performs_at", perfEnd.toISOString())
    .eq("cancelled", false)
    .order("performs_at")
    .limit(isSearching ? 800 : 400);

  const perfs = perfRows ?? [];
  const productionIds = [...new Set(perfs.map((p) => p.production_id))];

  let productionsMap = new Map<string, any>();
  if (productionIds.length > 0) {
    let prodQuery = supabaseAdmin
      .from("productions")
      .select(
        `id, title, organization_name, detail_url, run_start, run_end,
         status, deleted_at, hidden_at, category_id, organization_id, area_id,
         is_ssta_event`,
      )
      .in("id", productionIds)
      .eq("status", "approved")
      .is("deleted_at", null)
      .is("hidden_at", null);

    if (isSearching) {
      // Escape the % wildcard meaning so user input doesn't accidentally
      // build broader patterns. Stick a regular % at start + end so the
      // match is "contains anywhere."
      const safe = q.replace(/[%_,]/g, "");
      prodQuery = prodQuery.or(
        `title.ilike.%${safe}%,organization_name.ilike.%${safe}%`,
      );
    }

    const { data: prodRows } = await prodQuery;
    productionsMap = new Map((prodRows ?? []).map((p) => [p.id, p]));
  }

  const categoriesById = new Map(categories.map((c) => [c.id, c]));
  const areasById = new Map(areas.map((a) => [a.id, a]));

  // organizations -> source_url mapping for the info-link fallback.
  // Productions without their own detail_url (e.g. ManeStage's per-show
  // pages aren't linked from /buy-tickets) fall back to the org's
  // source URL - that's where the schedule lives, so it's a sensible
  // "click here to learn more" target.
  const { data: srcRows } = await supabaseAdmin
    .from("organizations")
    .select("id, source_url");
  const sourceUrlById = new Map((srcRows ?? []).map((s) => [s.id, s.source_url]));

  // Stitch + filter
  const performances: Performance[] = perfs
    .map((p) => {
      const prod = productionsMap.get(p.production_id);
      if (!prod) return null;

      const cat = prod.category_id ? categoriesById.get(prod.category_id) : undefined;
      const slug = cat?.slug ?? null;
      // Category filter: empty active list = show all (no filter).
      // Some active = filter to those; uncategorised entries fall
      // through when "production" is among the active filters (since
      // most uncategorised auto-pop'd entries are productions).
      const passesCategory =
        activeCats.length === 0
          ? true
          : slug
            ? activeCats.includes(slug)
            : activeCats.includes("production");
      if (!passesCategory) return null;

      // Area is denormalised onto productions (mig 046). The cron keeps
      // auto-pop'd entries' area_id in sync with their source on every
      // upsert; manual entries set it directly via the admin form.
      const areaId = prod.area_id ?? null;
      if (activeAreaIds && (!areaId || !activeAreaIds.includes(areaId))) return null;
      const area = areaId ? areasById.get(areaId) : undefined;

      // detail_url fallback: when the per-show page wasn't extracted
      // (ManeStage-style consolidated /buy-tickets pages, etc.), link
      // out to the org's source URL instead. Better than no link at
      // all - users can still click through to learn more.
      const linkUrl =
        prod.detail_url ?? (prod.organization_id ? sourceUrlById.get(prod.organization_id) ?? null : null);

      return {
        id: p.id,
        performs_at: p.performs_at,
        note: p.note,
        production: {
          id: prod.id,
          title: prod.title,
          organization_name: prod.organization_name,
          detail_url: linkUrl,
          run_start: prod.run_start,
          run_end: prod.run_end,
          category_slug: slug,
          category_name: cat?.name ?? null,
          area_id: areaId ?? null,
          area_name: area?.name ?? null,
          is_ssta_event: !!prod.is_ssta_event,
        },
      };
    })
    .filter((p): p is Performance => p !== null);

  // Re-sort within each calendar day so SSTA-tagged events pin to the
  // top of the day. The original query already ordered by performs_at;
  // a stable sort here re-groups SSTA-true within each day cluster
  // without touching cross-day order. The performs_at sort key is the
  // ISO timestamp string, which sorts day-then-time lexicographically.
  performances.sort((a, b) => {
    const ad = a.performs_at.slice(0, 10);
    const bd = b.performs_at.slice(0, 10);
    if (ad !== bd) return ad < bd ? -1 : 1;
    // Within the same day: SSTA first, then time.
    if (a.production.is_ssta_event !== b.production.is_ssta_event) {
      return a.production.is_ssta_event ? -1 : 1;
    }
    return a.performs_at < b.performs_at ? -1 : 1;
  });

  // Total upcoming (forward-looking, all months) for masthead. We count
  // raw performances; RLS-cascade via productions.deleted_at would be
  // ideal but Supabase nested filters add complexity without much value
  // here since we always delete-cascade performances when their parent
  // production is deleted.
  const { count: totalUpcoming } = await supabaseAdmin
    .from("performances")
    .select("id", { count: "exact", head: true })
    .gte("performs_at", new Date().toISOString())
    .eq("cancelled", false);

  // Masthead lede - editable from /admin/content row 'calendar'.
  const { data: contentRow } = await supabaseAdmin
    .from("site_content")
    .select("body_markdown")
    .eq("slug", "calendar")
    .maybeSingle();

  return {
    lede: contentRow?.body_markdown ?? "",
    performances,
    categories,
    activeCats,
    areas,
    activeAreas: activeAreaNames, // null = show all
    view,
    q,
    isSearching,
    monthIso: monthIso(monthStart),
    monthLabel: monthStart.toLocaleString("en-US", {
      month: "long",
      year: "numeric",
      timeZone: "UTC",
    }),
    prevMonthIso: monthIso(prevMonth),
    nextMonthIso: monthIso(nextMonth),
    totalUpcoming: totalUpcoming ?? 0,
  };
};
