// Admin: list / inspect / refresh calendar event sources. Each row in
// event_sources represents one org we auto-pull from. Lexi sees the last
// sync status, count of shows currently held, and can trigger a manual
// refresh (which calls into the same syncEventSource() the cron uses,
// honouring the per-source cooldown to prevent click-spam).

import type { Actions, PageServerLoad } from "./$types";
import { supabaseAdmin } from "$lib/server/supabase";
import { fail } from "@sveltejs/kit";
import pg from "pg";
import { syncEventSource } from "../../../../scripts/_lib/calendar-sync.mjs";
import { SUPABASE_DB_URL, ANTHROPIC_API_KEY } from "$env/static/private";

const { Client } = pg;

export const load: PageServerLoad = async () => {
  const { data: sources, error } = await supabaseAdmin
    .from("event_sources")
    .select(
      `id, org_slug, org_name, source_url, adapter, cadence_days, active,
       last_status, last_show_count, last_checked_at, last_successful_at,
       last_error, cooldown_until, notes, updated_at, area_id,
       description, homepage_url, logo_url`,
    )
    .order("org_name");
  if (error) throw error;

  const { data: areas } = await supabaseAdmin
    .from("areas")
    .select("id, name, sort_order")
    .order("sort_order");
  const areaNameById = new Map((areas ?? []).map((a) => [a.id, a.name]));

  const enriched = (sources ?? []).map((s) => ({
    ...s,
    area_name: s.area_id ? areaNameById.get(s.area_id) ?? null : null,
    is_manual: s.adapter === "manual",
  }));

  return {
    autoSources: enriched.filter((s) => !s.is_manual),
    manualSources: enriched.filter((s) => s.is_manual),
  };
};

export const actions: Actions = {
  // Save the public-facing /theatres metadata (description, homepage URL,
  // logo URL). All three are nullable - empty string clears the column.
  // The other event_sources fields (source_url, adapter, area, etc.) are
  // managed elsewhere; this action only touches the display fields.
  updatePublic: async ({ request }) => {
    const fd = await request.formData();
    const id = String(fd.get("id") ?? "");
    if (!id) return fail(400, { error: "missing source id" });

    const description = String(fd.get("description") ?? "").trim();
    const homepageUrl = String(fd.get("homepage_url") ?? "").trim();
    const logoUrl = String(fd.get("logo_url") ?? "").trim();

    // Light validation: URLs must look like URLs if set.
    const looksLikeUrl = (s: string) => /^https?:\/\//i.test(s);
    if (homepageUrl && !looksLikeUrl(homepageUrl)) {
      return fail(400, { error: "Homepage URL must start with http:// or https://" });
    }
    if (logoUrl && !looksLikeUrl(logoUrl)) {
      return fail(400, { error: "Logo URL must start with http:// or https://" });
    }
    if (description.length > 500) {
      return fail(400, { error: "Description should be under 500 characters." });
    }

    const { data: row, error } = await supabaseAdmin
      .from("event_sources")
      .update({
        description: description || null,
        homepage_url: homepageUrl || null,
        logo_url: logoUrl || null,
      })
      .eq("id", id)
      .select("org_slug")
      .maybeSingle();
    if (error || !row) return fail(500, { error: "Could not save." });
    return { savedPublic: row.org_slug };
  },

  // Flip active=true/false. Inactive sources are skipped entirely by the
  // cron. Existing productions stay live - this only controls future syncs.
  setActive: async ({ request }) => {
    const fd = await request.formData();
    const id = String(fd.get("id") ?? "");
    const active = fd.get("active") === "true";
    if (!id) return fail(400, { error: "missing source id" });
    const { data: row, error } = await supabaseAdmin
      .from("event_sources")
      .update({ active })
      .eq("id", id)
      .select("org_slug")
      .maybeSingle();
    if (error || !row) return fail(500, { error: "Could not update." });
    return { activeSet: { slug: row.org_slug, active } };
  },

  // Flip adapter between 'ai-generic' (auto-pulled by cron) and 'manual'
  // (skipped by cron, Lexi enters shows by hand). Useful when an org's
  // site stops scraping cleanly and we'd rather curate than fight it.
  setAdapter: async ({ request }) => {
    const fd = await request.formData();
    const id = String(fd.get("id") ?? "");
    const adapter = String(fd.get("adapter") ?? "");
    if (!id) return fail(400, { error: "missing source id" });
    if (adapter !== "ai-generic" && adapter !== "manual") {
      return fail(400, { error: "adapter must be ai-generic or manual" });
    }
    const { data: row, error } = await supabaseAdmin
      .from("event_sources")
      .update({ adapter })
      .eq("id", id)
      .select("org_slug")
      .maybeSingle();
    if (error || !row) return fail(500, { error: "Could not update." });
    return { adapterSet: { slug: row.org_slug, adapter } };
  },

  refresh: async ({ request }) => {
    if (!ANTHROPIC_API_KEY) return fail(500, { error: "ANTHROPIC_API_KEY not configured" });
    const fd = await request.formData();
    const sourceId = String(fd.get("id") ?? "");
    if (!sourceId) return fail(400, { error: "missing source id" });

    // Use direct pg connection so the lib's queries (parameterised SQL)
    // can run unchanged. Supabase JS client's promise model is
    // incompatible with the lib's interface.
    const db = new Client({ connectionString: SUPABASE_DB_URL, ssl: { rejectUnauthorized: false } });
    await db.connect();
    try {
      const sourceRes = await db.query(
        `select id, org_slug, org_name, source_url, adapter, last_hash,
                last_show_count, cadence_days, last_checked_at, last_status,
                cooldown_until
           from public.event_sources where id = $1`,
        [sourceId],
      );
      const source = sourceRes.rows[0];
      if (!source) return fail(404, { error: "source not found" });

      // Cooldown check (manual refresh respects the 1hr post-success cooldown
      // that the cron sets, defending against click-spam / accidental loops).
      if (source.cooldown_until && new Date(source.cooldown_until) > new Date()) {
        const minsLeft = Math.ceil(
          (new Date(source.cooldown_until).getTime() - Date.now()) / 60_000,
        );
        return fail(429, {
          error: `Cooldown - try again in ${minsLeft} minute${minsLeft === 1 ? "" : "s"}.`,
        });
      }

      const result = await syncEventSource(db, source, { force: true });
      return {
        refreshed: source.org_slug,
        result: {
          status: result.status,
          showCount: result.showCount ?? 0,
          performanceCount: result.performanceCount ?? 0,
          cost: result.cost ?? 0,
          error: result.error,
        },
      };
    } catch (err) {
      return fail(500, { error: String(err).slice(0, 500) });
    } finally {
      await db.end();
    }
  },
};
