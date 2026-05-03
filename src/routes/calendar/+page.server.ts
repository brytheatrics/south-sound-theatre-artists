// Public calendar ("What's Playing"). Filterable list of upcoming
// performances across South Sound theatre, populated by the cron-driven
// auto-extractor and any manually-added entries. Filter state lives in
// URL params so views are shareable. View toggle (grid vs list) is also
// in URL state; mobile auto-switches to list via CSS regardless.

import type { PageServerLoad } from "./$types";
import { supabaseAdmin } from "$lib/server/supabase";

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
  };
};

export type Category = {
  id: string;
  slug: string;
  name: string;
  default_visible: boolean;
  sort_order: number;
};

export const load: PageServerLoad = async ({ url }) => {
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

  // ---- View --------------------------------------------------------
  const view = params.get("view") === "list" ? "list" : "grid";

  // ---- Categories --------------------------------------------------
  const { data: catData } = await supabaseAdmin
    .from("event_categories")
    .select("id, slug, name, default_visible, sort_order")
    .order("sort_order");
  const categories = (catData ?? []) as Category[];

  // Active filter set: explicit ?cats=slug1,slug2 if given, else
  // categories with default_visible=true.
  const catParam = params.get("cats");
  const activeCats: string[] = catParam
    ? catParam.split(",").map((s) => s.trim()).filter(Boolean)
    : categories.filter((c) => c.default_visible).map((c) => c.slug);

  // ---- Performances in this month ---------------------------------
  const { data: perfRows } = await supabaseAdmin
    .from("performances")
    .select("id, performs_at, note, production_id")
    .gte("performs_at", monthStart.toISOString())
    .lt("performs_at", monthEnd.toISOString())
    .eq("cancelled", false)
    .order("performs_at");

  const perfs = perfRows ?? [];
  const productionIds = [...new Set(perfs.map((p) => p.production_id))];

  let productionsMap = new Map<string, any>();
  if (productionIds.length > 0) {
    const { data: prodRows } = await supabaseAdmin
      .from("productions")
      .select(
        `id, title, organization_name, detail_url, run_start, run_end,
         status, deleted_at, category_id`,
      )
      .in("id", productionIds)
      .eq("status", "approved")
      .is("deleted_at", null);

    productionsMap = new Map((prodRows ?? []).map((p) => [p.id, p]));
  }

  const categoriesById = new Map(categories.map((c) => [c.id, c]));

  // Stitch + filter
  const performances: Performance[] = perfs
    .map((p) => {
      const prod = productionsMap.get(p.production_id);
      if (!prod) return null;
      const cat = prod.category_id ? categoriesById.get(prod.category_id) : undefined;
      const slug = cat?.slug ?? null;
      // Filter by active categories. Uncategorised entries fall through
      // when "production" is in the active list (sensible default).
      const isVisible = slug
        ? activeCats.includes(slug)
        : activeCats.includes("production");
      if (!isVisible) return null;
      return {
        id: p.id,
        performs_at: p.performs_at,
        note: p.note,
        production: {
          id: prod.id,
          title: prod.title,
          organization_name: prod.organization_name,
          detail_url: prod.detail_url ?? null,
          run_start: prod.run_start,
          run_end: prod.run_end,
          category_slug: slug,
          category_name: cat?.name ?? null,
        },
      };
    })
    .filter((p): p is Performance => p !== null);

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

  return {
    performances,
    categories,
    activeCats,
    view,
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
