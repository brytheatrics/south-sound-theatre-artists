// /admin/contact/[id]: detail view for a single contact submission.
// Lets admin set status + append notes ("emailed them", "spam", etc.).
// Notes are append-only audit trail.

import { error, fail } from "@sveltejs/kit";
import type { Actions, PageServerLoad } from "./$types";
import { supabaseAdmin } from "$lib/server/supabase";

type Note = { author: string; body: string; created_at: string };

export const load: PageServerLoad = async ({ params }) => {
  const { data: sub, error: err } = await supabaseAdmin
    .from("contact_submissions")
    .select("*")
    .eq("id", params.id)
    .maybeSingle();
  if (err || !sub) error(404, "Submission not found.");
  const { data: cat } = await supabaseAdmin
    .from("contact_categories")
    .select("label, primary_email, cc_emails")
    .eq("slug", sub.category_slug)
    .maybeSingle();
  return {
    sub,
    category_label: cat?.label ?? sub.category_slug,
    routing: {
      primary: cat?.primary_email ?? null,
      cc: cat?.cc_emails ?? [],
    },
  };
};

export const actions: Actions = {
  setStatus: async ({ params, request }) => {
    const data = await request.formData();
    const status = ((data.get("status") as string) ?? "").trim();
    if (!["new", "in_progress", "resolved", "spam"].includes(status)) {
      return fail(400, { error: "Invalid status." });
    }
    const patch: Record<string, unknown> = { status };
    if (status === "resolved") patch.resolved_at = new Date().toISOString();
    const { error: err } = await supabaseAdmin
      .from("contact_submissions")
      .update(patch)
      .eq("id", params.id);
    if (err) return fail(500, { error: "Could not update status." });
    return { statusSet: status };
  },

  addNote: async ({ params, request, locals }) => {
    const data = await request.formData();
    const body = ((data.get("body") as string) ?? "").trim();
    if (!body) return fail(400, { error: "Note can't be empty." });
    const { data: row } = await supabaseAdmin
      .from("contact_submissions")
      .select("notes")
      .eq("id", params.id)
      .maybeSingle();
    if (!row) return fail(404, { error: "Submission not found." });
    const newNote: Note = {
      author: locals.admin?.email ?? "unknown",
      body,
      created_at: new Date().toISOString(),
    };
    const existing = Array.isArray(row.notes) ? (row.notes as Note[]) : [];
    const { error: err } = await supabaseAdmin
      .from("contact_submissions")
      .update({ notes: [...existing, newNote] })
      .eq("id", params.id);
    if (err) return fail(500, { error: "Could not add note." });
    return { noteAdded: true };
  },
};
