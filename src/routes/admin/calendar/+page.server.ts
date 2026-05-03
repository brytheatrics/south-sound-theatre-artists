// /admin/calendar: searchable list of all productions, with status
// filter (pending_review / approved / rejected), area filter, and source
// filter (auto-pop'd via cron vs. manually added). Mirrors the admin
// callboard page structure. Soft-delete here goes to a 30-day trash
// like the callboard / profiles flows.

import { fail } from "@sveltejs/kit";
import type { Actions, PageServerLoad } from "./$types";
import { PUBLIC_SITE_URL } from "$env/static/public";
import { supabaseAdmin } from "$lib/server/supabase";
import { sendEmail } from "$lib/server/email";

const PAGE_SIZE = 50;

export const load: PageServerLoad = async ({ url }) => {
  const q = (url.searchParams.get("q") ?? "").trim();
  const statusFilter = (url.searchParams.get("status") ?? "").trim();
  const sourceFilter = (url.searchParams.get("source") ?? "").trim(); // 'auto' | 'manual'
  const whenFilter = (url.searchParams.get("when") ?? "upcoming").trim(); // 'upcoming' | 'past' | 'all'
  const pageParam = url.searchParams.get("page") ?? "";
  const page =
    /^\d+$/.test(pageParam) && Number(pageParam) > 0 ? Number(pageParam) : 1;

  // Today as YYYY-MM-DD in Pacific (the run_start / run_end columns are
  // dates, not timestamptz, so we just need the date string).
  const today = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Los_Angeles",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());

  let query = supabaseAdmin
    .from("productions")
    .select(
      `id, title, organization_name, run_start, run_end, status, source_id,
       category_id, detail_url, admin_edited_at, created_at, updated_at`,
      { count: "exact" },
    )
    .is("deleted_at", null);

  if (q) {
    query = query.or(`title.ilike.%${q}%,organization_name.ilike.%${q}%`);
  }
  const validStatuses = ["pending_review", "approved", "rejected"];
  if (statusFilter && validStatuses.includes(statusFilter)) {
    query = query.eq("status", statusFilter);
  }
  if (sourceFilter === "auto") {
    query = query.not("source_id", "is", null);
  } else if (sourceFilter === "manual") {
    query = query.is("source_id", null);
  }
  // When filter: default 'upcoming' hides shows whose run_end is past.
  // 'past' shows just past shows. 'all' shows everything.
  if (whenFilter === "upcoming") {
    query = query.or(`run_end.is.null,run_end.gte.${today}`);
  } else if (whenFilter === "past") {
    query = query.lt("run_end", today);
  }

  query = query
    .order("run_start", { ascending: whenFilter === "past" ? false : true, nullsFirst: false })
    .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);

  const { data, count, error } = await query;
  if (error) throw error;

  // Performance counts per production (one query, joined in memory).
  const ids = (data ?? []).map((r) => r.id);
  const perfCountById = new Map<string, number>();
  if (ids.length > 0) {
    const { data: perfRows } = await supabaseAdmin
      .from("performances")
      .select("production_id")
      .in("production_id", ids);
    for (const p of perfRows ?? []) {
      perfCountById.set(p.production_id, (perfCountById.get(p.production_id) ?? 0) + 1);
    }
  }

  // Categories for display labels.
  const { data: catData } = await supabaseAdmin
    .from("event_categories")
    .select("id, name, slug")
    .order("sort_order");
  const categoryNameById = new Map((catData ?? []).map((c) => [c.id, c.name]));

  // Counts for badges + secondary headers
  const { count: pendingCount } = await supabaseAdmin
    .from("productions")
    .select("*", { count: "exact", head: true })
    .eq("status", "pending_review")
    .is("deleted_at", null);

  const { count: trashCount } = await supabaseAdmin
    .from("productions")
    .select("*", { count: "exact", head: true })
    .not("deleted_at", "is", null);

  // How many past shows are currently hidden (so the UI can show
  // "X past shows hidden — show all" affordance).
  const { count: pastCount } = await supabaseAdmin
    .from("productions")
    .select("*", { count: "exact", head: true })
    .lt("run_end", today)
    .is("deleted_at", null);

  return {
    productions: (data ?? []).map((p) => ({
      ...p,
      performance_count: perfCountById.get(p.id) ?? 0,
      category_name: p.category_id ? categoryNameById.get(p.category_id) ?? null : null,
      is_auto_pop: p.source_id !== null,
      is_admin_locked: p.admin_edited_at !== null,
    })),
    total: count ?? 0,
    pendingCount: pendingCount ?? 0,
    trashCount: trashCount ?? 0,
    pastCount: pastCount ?? 0,
    page,
    pageSize: PAGE_SIZE,
    q,
    statusFilter,
    sourceFilter,
    whenFilter,
  };
};

export const actions: Actions = {
  approve: async ({ request }) => {
    const data = await request.formData();
    const ids = data.getAll("id").map(String).filter(Boolean);
    if (ids.length === 0) return fail(400, { error: "Nothing selected." });

    // Pull submitter info before update so we can email them.
    const { data: rows } = await supabaseAdmin
      .from("productions")
      .select("id, title, submitter_email")
      .in("id", ids);

    const { error } = await supabaseAdmin
      .from("productions")
      .update({ status: "approved", reviewed_at: new Date().toISOString() })
      .in("id", ids);
    if (error) return fail(500, { error: "Could not approve." });

    // Send approved email to anyone with a submitter_email (cron-imported
    // rows have no submitter_email; those silently skip the send).
    for (const r of rows ?? []) {
      if (!r.submitter_email) continue;
      await sendEmail({
        to: r.submitter_email,
        templateSlug: "calendar_approved",
        vars: {
          name: "",
          title: r.title,
          calendar_url: `${PUBLIC_SITE_URL}/calendar`,
        },
      });
    }

    return { approved: ids.length };
  },

  reject: async ({ request }) => {
    const data = await request.formData();
    const ids = data.getAll("id").map(String).filter(Boolean);
    const reason = ((data.get("reason") as string) ?? "").trim();
    if (ids.length === 0) return fail(400, { error: "Nothing selected." });

    const { data: rows } = await supabaseAdmin
      .from("productions")
      .select("id, title, submitter_email")
      .in("id", ids);

    const { error } = await supabaseAdmin
      .from("productions")
      .update({
        status: "rejected",
        rejection_reason: reason || null,
        reviewed_at: new Date().toISOString(),
      })
      .in("id", ids);
    if (error) return fail(500, { error: "Could not reject." });

    if (reason) {
      for (const r of rows ?? []) {
        if (!r.submitter_email) continue;
        await sendEmail({
          to: r.submitter_email,
          templateSlug: "calendar_rejected",
          vars: {
            name: "",
            title: r.title,
            reason,
          },
        });
      }
    }

    return { rejected: ids.length };
  },

  softDelete: async ({ request }) => {
    const data = await request.formData();
    const ids = data.getAll("id").map(String).filter(Boolean);
    if (ids.length === 0) return fail(400, { error: "Nothing selected." });
    // Set admin_edited_at alongside deleted_at so the cron sees the lock
    // and won't reanimate the row on its next sync.
    const now = new Date().toISOString();
    const { error } = await supabaseAdmin
      .from("productions")
      .update({ deleted_at: now, admin_edited_at: now })
      .in("id", ids);
    if (error) return fail(500, { error: "Could not delete." });
    return { deleted: ids.length };
  },
};
