// /admin/blocklist: addresses whose contact-form messages we silently
// drop. Adds and removes from email_blocklist.

import { fail } from "@sveltejs/kit";
import type { Actions, PageServerLoad } from "./$types";
import { supabaseAdmin } from "$lib/server/supabase";

export const load: PageServerLoad = async () => {
  const { data, error } = await supabaseAdmin
    .from("email_blocklist")
    .select("id, email, note, created_at")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return { entries: data ?? [] };
};

export const actions: Actions = {
  add: async ({ request }) => {
    const data = await request.formData();
    const email = ((data.get("email") as string) ?? "").trim().toLowerCase();
    const note = ((data.get("note") as string) ?? "").trim() || null;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return fail(400, { error: "Enter a valid email address." });
    }
    const { error } = await supabaseAdmin
      .from("email_blocklist")
      .insert({ email, note });
    if (error) {
      if (error.code === "23505") return fail(400, { error: "Already blocked." });
      return fail(500, { error: "Could not block." });
    }
    return { added: email };
  },
  remove: async ({ request }) => {
    const data = await request.formData();
    const id = (data.get("id") as string) ?? "";
    if (!id) return fail(400, { error: "Missing id." });
    await supabaseAdmin.from("email_blocklist").delete().eq("id", id);
    return { removed: true };
  },
};
