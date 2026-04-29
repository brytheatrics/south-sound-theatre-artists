// /admin/disciplines: add / remove / reorder canonical disciplines and
// the categories that group them. Categories use `name` as the primary
// key, so a rename also has to update disciplines.category in lockstep.

import { fail } from "@sveltejs/kit";
import type { Actions, PageServerLoad } from "./$types";
import { supabaseAdmin } from "$lib/server/supabase";

export const load: PageServerLoad = async () => {
  const [discRes, catsRes] = await Promise.all([
    supabaseAdmin
      .from("disciplines")
      .select("id, name, category, sort_order")
      .order("category")
      .order("sort_order"),
    supabaseAdmin
      .from("discipline_categories")
      .select("name, sort_order")
      .order("sort_order"),
  ]);
  if (discRes.error) throw discRes.error;
  if (catsRes.error) throw catsRes.error;

  // Count disciplines per category so the UI can disable Remove on
  // categories that still have entries.
  const counts: Record<string, number> = {};
  for (const d of discRes.data ?? []) {
    counts[d.category] = (counts[d.category] ?? 0) + 1;
  }

  return {
    disciplines: discRes.data ?? [],
    categories: catsRes.data ?? [],
    categoryCounts: counts,
  };
};

export const actions: Actions = {
  add: async ({ request }) => {
    const data = await request.formData();
    const name = ((data.get("name") as string) ?? "").trim();
    const category = ((data.get("category") as string) ?? "").trim();
    const sortStr = ((data.get("sort_order") as string) ?? "").trim();
    const sort_order = sortStr ? Number(sortStr) : 0;
    if (!name) return fail(400, { error: "Name required." });
    if (!category) return fail(400, { error: "Category required." });
    const { error } = await supabaseAdmin
      .from("disciplines")
      .insert({ name, category, sort_order });
    if (error) {
      if (error.code === "23505") return fail(400, { error: "Already exists." });
      return fail(500, { error: "Could not add." });
    }
    return { added: name };
  },
  remove: async ({ request }) => {
    const data = await request.formData();
    const id = (data.get("id") as string) ?? "";
    if (!id) return fail(400, { error: "Missing id." });
    await supabaseAdmin.from("disciplines").delete().eq("id", id);
    return { removed: true };
  },

  // Rename a discipline AND cascade the change to every profile and
  // pending submission that has the old name in their disciplines /
  // mentorship arrays. Two cases:
  //   - newName isn't in the canonical list yet -> simple rename:
  //     update the discipline row, then text-replace in arrays.
  //   - newName already exists -> merge: arrays get oldName -> newName
  //     (deduped), then the old discipline row is deleted.
  //
  // The merge case is what saves Lexi from the "delete + add" trap that
  // left Chris Serface with both 'Actor (Stage)' and 'Actor'.
  rename: async ({ request }) => {
    const data = await request.formData();
    const id = ((data.get("id") as string) ?? "").trim();
    const newName = ((data.get("new_name") as string) ?? "").trim();
    if (!id || !newName) return fail(400, { error: "Missing id or new name." });

    const { data: row, error: rowErr } = await supabaseAdmin
      .from("disciplines")
      .select("id, name, category")
      .eq("id", id)
      .maybeSingle();
    if (rowErr || !row) return fail(404, { error: "Discipline not found." });
    if (row.name === newName) return { renamed: newName };

    // Does newName already exist as a different row? If so, this is a
    // merge: keep the existing newName row, retire the old one.
    const { data: existing } = await supabaseAdmin
      .from("disciplines")
      .select("id")
      .eq("name", newName)
      .maybeSingle();
    const isMerge = !!existing && existing.id !== row.id;

    // Cascade arrays: pull rows that contain the old name, mutate in JS,
    // write back. Done separately for profiles + pending_submissions so
    // the TS types stay honest (Supabase rejects dynamic table strings).
    {
      const { data: rows } = await supabaseAdmin
        .from("profiles")
        .select("id, disciplines")
        .contains("disciplines", [row.name]);
      for (const r of rows ?? []) {
        const next = Array.from(
          new Set(
            (r.disciplines as string[]).map((d) =>
              d === row.name ? newName : d,
            ),
          ),
        );
        await supabaseAdmin
          .from("profiles")
          .update({ disciplines: next })
          .eq("id", r.id);
      }
    }
    {
      const { data: rows } = await supabaseAdmin
        .from("pending_submissions")
        .select("id, disciplines")
        .contains("disciplines", [row.name]);
      for (const r of rows ?? []) {
        const next = Array.from(
          new Set(
            (r.disciplines as string[]).map((d) =>
              d === row.name ? newName : d,
            ),
          ),
        );
        await supabaseAdmin
          .from("pending_submissions")
          .update({ disciplines: next })
          .eq("id", r.id);
      }
    }

    // Mentorship arrays on profiles only (pending_submissions doesn't
    // collect mentorship at submit time). Two passes - one per column -
    // because Supabase's TS types require static select strings.
    {
      const { data: rows } = await supabaseAdmin
        .from("profiles")
        .select("id, mentorship_offering")
        .contains("mentorship_offering", [row.name]);
      for (const r of rows ?? []) {
        const next = Array.from(
          new Set(
            (r.mentorship_offering as string[]).map((d) =>
              d === row.name ? newName : d,
            ),
          ),
        );
        await supabaseAdmin
          .from("profiles")
          .update({ mentorship_offering: next })
          .eq("id", r.id);
      }
    }
    {
      const { data: rows } = await supabaseAdmin
        .from("profiles")
        .select("id, mentorship_seeking")
        .contains("mentorship_seeking", [row.name]);
      for (const r of rows ?? []) {
        const next = Array.from(
          new Set(
            (r.mentorship_seeking as string[]).map((d) =>
              d === row.name ? newName : d,
            ),
          ),
        );
        await supabaseAdmin
          .from("profiles")
          .update({ mentorship_seeking: next })
          .eq("id", r.id);
      }
    }

    if (isMerge) {
      // Existing newName row stays; retire the old one.
      const { error: delErr } = await supabaseAdmin
        .from("disciplines")
        .delete()
        .eq("id", row.id);
      if (delErr) {
        return fail(500, {
          error:
            "Cascaded the rename but failed to remove the old row. Try again.",
        });
      }
    } else {
      // Simple rename of the canonical row.
      const { error: updErr } = await supabaseAdmin
        .from("disciplines")
        .update({ name: newName })
        .eq("id", row.id);
      if (updErr) {
        return fail(500, {
          error: "Cascaded the rename but failed to update the canonical row.",
        });
      }
    }

    return { renamed: newName, mergedInto: isMerge ? newName : null };
  },
  reorder: async ({ request }) => {
    const data = await request.formData();
    const id = (data.get("id") as string) ?? "";
    const sortStr = ((data.get("sort_order") as string) ?? "").trim();
    const sort_order = sortStr ? Number(sortStr) : 0;
    if (!id) return fail(400, { error: "Missing id." });
    const { error } = await supabaseAdmin
      .from("disciplines")
      .update({ sort_order })
      .eq("id", id);
    if (error) return fail(500, { error: "Could not reorder." });
    return { reordered: true };
  },

  addCategory: async ({ request }) => {
    const data = await request.formData();
    const name = ((data.get("name") as string) ?? "").trim();
    const sortStr = ((data.get("sort_order") as string) ?? "").trim();
    const sort_order = sortStr ? Number(sortStr) : 100;
    if (!name) return fail(400, { error: "Category name required." });
    const { error } = await supabaseAdmin
      .from("discipline_categories")
      .insert({ name, sort_order });
    if (error) {
      if (error.code === "23505") return fail(400, { error: "Already exists." });
      return fail(500, { error: "Could not add category." });
    }
    return { addedCategory: name };
  },

  renameCategory: async ({ request }) => {
    const data = await request.formData();
    const oldName = ((data.get("old_name") as string) ?? "").trim();
    const newName = ((data.get("new_name") as string) ?? "").trim();
    if (!oldName || !newName) {
      return fail(400, { error: "Old + new name required." });
    }
    if (oldName === newName) return { renamedCategory: newName };
    // Update the category row first; if a row with newName already exists
    // we'd hit a uniqueness conflict and bail before any disciplines
    // change category, keeping the world consistent.
    const { error: catErr } = await supabaseAdmin
      .from("discipline_categories")
      .update({ name: newName })
      .eq("name", oldName);
    if (catErr) {
      if (catErr.code === "23505") {
        return fail(400, { error: "A category with that name already exists." });
      }
      return fail(500, { error: "Could not rename category." });
    }
    const { error: discErr } = await supabaseAdmin
      .from("disciplines")
      .update({ category: newName })
      .eq("category", oldName);
    if (discErr) {
      console.error("disciplines re-tag after category rename failed", discErr);
      return fail(500, {
        error:
          "Renamed the category but failed to re-tag disciplines. Re-run the rename.",
      });
    }
    return { renamedCategory: newName };
  },

  reorderCategory: async ({ request }) => {
    const data = await request.formData();
    const name = ((data.get("name") as string) ?? "").trim();
    const sortStr = ((data.get("sort_order") as string) ?? "").trim();
    const sort_order = sortStr ? Number(sortStr) : 100;
    if (!name) return fail(400, { error: "Missing name." });
    const { error } = await supabaseAdmin
      .from("discipline_categories")
      .update({ sort_order })
      .eq("name", name);
    if (error) return fail(500, { error: "Could not reorder category." });
    return { reorderedCategory: name };
  },

  removeCategory: async ({ request }) => {
    const data = await request.formData();
    const name = ((data.get("name") as string) ?? "").trim();
    if (!name) return fail(400, { error: "Missing name." });
    // Block if any disciplines still reference the category - safer than
    // silently re-homing them to "Other".
    const { count } = await supabaseAdmin
      .from("disciplines")
      .select("*", { count: "exact", head: true })
      .eq("category", name);
    if ((count ?? 0) > 0) {
      return fail(409, {
        error: `Move or remove the ${count} discipline${count === 1 ? "" : "s"} in "${name}" before deleting the category.`,
      });
    }
    const { error } = await supabaseAdmin
      .from("discipline_categories")
      .delete()
      .eq("name", name);
    if (error) return fail(500, { error: "Could not remove category." });
    return { removedCategory: name };
  },
};
