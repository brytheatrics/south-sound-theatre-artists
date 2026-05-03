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
       last_error, cooldown_until, notes, updated_at`,
    )
    .order("org_name");
  if (error) throw error;
  return { sources: sources ?? [] };
};

export const actions: Actions = {
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
