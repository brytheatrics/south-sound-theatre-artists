// /admin/flagged-edits: queue of major-field changes from untrusted
// profiles that landed via the magic-link edit flow. Approve copies the
// proposed values onto the profile; reject just marks the row.
//
// Multi-field changes from one submission are grouped in a single row's
// proposed_changes jsonb so the admin reviews + acts on the bundle.

import { fail } from "@sveltejs/kit";
import type { Actions, PageServerLoad } from "./$types";
import { PUBLIC_SITE_URL } from "$env/static/public";
import { supabaseAdmin } from "$lib/server/supabase";
import { sendEmail } from "$lib/server/email";

type ProposedChanges = Record<string, unknown>;

export const load: PageServerLoad = async ({ url, locals }) => {
  const tab = url.searchParams.get("tab") === "history" ? "history" : "open";

  const baseQuery = supabaseAdmin
    .from("flagged_edits")
    .select(
      `id, profile_id, proposed_changes, status, rejection_reason,
       reviewed_at, created_at,
       profile:profiles ( slug, full_name, email, headshot_url,
                          bio, disciplines, resumes, trusted )`,
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

    // Pull the profile email + name before flipping status, so we can
    // notify the artist with the typed reason after the update lands.
    const { data: flag } = await supabaseAdmin
      .from("flagged_edits")
      .select("profile_id")
      .eq("id", id)
      .maybeSingle();
    let notifyTarget: { email: string; full_name: string } | null = null;
    if (flag?.profile_id) {
      const { data: prof } = await supabaseAdmin
        .from("profiles")
        .select("email, full_name")
        .eq("id", flag.profile_id)
        .maybeSingle();
      if (prof?.email) {
        notifyTarget = { email: prof.email, full_name: prof.full_name };
      }
    }

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

    // Email the artist with the typed reason so they know what happened.
    // Failures are non-fatal - the status flip already saved.
    if (notifyTarget && reason) {
      const res = await sendEmail({
        to: notifyTarget.email,
        templateSlug: "edit_rejected",
        vars: {
          name: notifyTarget.full_name,
          reason,
          site_url: PUBLIC_SITE_URL,
        },
      });
      if (!res.ok) {
        console.error(
          `edit_rejected email failed for flagged_edit ${id}, reason=${res.reason}`,
        );
      }
    }

    return { rejectedId: id };
  },
};
