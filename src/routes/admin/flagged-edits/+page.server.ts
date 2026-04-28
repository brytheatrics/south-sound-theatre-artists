// /admin/flagged-edits: queue of major-field changes from untrusted
// profiles that landed via the magic-link edit flow. Approve copies the
// proposed values onto the profile; reject just marks the row.
//
// Multi-field changes from one submission are grouped in a single row's
// proposed_changes jsonb so the admin reviews + acts on the bundle.

import { fail } from "@sveltejs/kit";
import type { Actions, PageServerLoad } from "./$types";
import { supabaseAdmin } from "$lib/server/supabase";

type ProposedChanges = Record<string, unknown>;

export const load: PageServerLoad = async ({ url, locals }) => {
  const tab = url.searchParams.get("tab") === "history" ? "history" : "open";

  const baseQuery = supabaseAdmin
    .from("flagged_edits")
    .select(
      `id, profile_id, proposed_changes, status, rejection_reason,
       reviewed_at, created_at,
       profile:profiles ( slug, full_name, email, headshot_url,
                          bio, disciplines, resumes, resume_data, trusted )`,
    )
    .order("created_at", { ascending: false });

  const query =
    tab === "open"
      ? baseQuery.eq("status", "pending")
      : baseQuery.in("status", ["approved", "rejected"]);

  const { data, error } = await query.limit(100);
  if (error) throw error;

  const { count: openCount } = await supabaseAdmin
    .from("flagged_edits")
    .select("*", { count: "exact", head: true })
    .eq("status", "pending");

  return {
    tab,
    flagged: data ?? [],
    openCount: openCount ?? 0,
    adminEmail: locals.admin?.email ?? null,
  };
};

export const actions: Actions = {
  approve: async ({ request, locals }) => {
    const data = await request.formData();
    const id = (data.get("id") as string) ?? "";
    if (!id) return fail(400, { error: "Missing id." });

    const { data: row } = await supabaseAdmin
      .from("flagged_edits")
      .select("id, profile_id, proposed_changes, status")
      .eq("id", id)
      .maybeSingle();
    if (!row) return fail(404, { error: "Flagged edit not found." });
    if (row.status !== "pending") {
      return fail(409, { error: "Already resolved." });
    }

    const proposed = (row.proposed_changes ?? {}) as ProposedChanges;
    const allowed = [
      "full_name",
      "bio",
      "headshot_url",
      "disciplines",
      "resumes",
      "resume_data",
    ];
    const update: Record<string, unknown> = {};
    for (const k of allowed) {
      if (k in proposed) update[k] = proposed[k];
    }

    if (Object.keys(update).length > 0) {
      const { error: updErr } = await supabaseAdmin
        .from("profiles")
        .update(update)
        .eq("id", row.profile_id);
      if (updErr) {
        console.error("approve flagged_edit profile update failed", updErr);
        return fail(500, { error: "Could not apply changes." });
      }
    }

    const { error: markErr } = await supabaseAdmin
      .from("flagged_edits")
      .update({
        status: "approved",
        reviewed_at: new Date().toISOString(),
      })
      .eq("id", id);
    if (markErr) {
      console.error("flagged_edits status update failed", markErr);
      return fail(500, { error: "Saved profile but failed to mark approved." });
    }

    return { approvedId: id };
  },

  reject: async ({ request }) => {
    const data = await request.formData();
    const id = (data.get("id") as string) ?? "";
    const reason = ((data.get("reason") as string) ?? "").trim();
    if (!id) return fail(400, { error: "Missing id." });

    const { error } = await supabaseAdmin
      .from("flagged_edits")
      .update({
        status: "rejected",
        rejection_reason: reason || null,
        reviewed_at: new Date().toISOString(),
      })
      .eq("id", id)
      .eq("status", "pending");
    if (error) {
      console.error("flagged_edits reject failed", error);
      return fail(500, { error: "Could not reject." });
    }
    return { rejectedId: id };
  },
};
