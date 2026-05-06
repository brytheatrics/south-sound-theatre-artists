// /admin/submit-form: one hub for the reference data the artist submit
// form pulls from. Each section (areas, unions, ethnicities) supports
// add / rename / reorder / remove. Renames cascade so existing profiles
// keep matching the renamed value.
//
// Disciplines stay on their own page (/admin/disciplines) because of
// the categories layer; this page links to it.

import { fail } from "@sveltejs/kit";
import type { Actions, PageServerLoad } from "./$types";
import { supabaseAdmin } from "$lib/server/supabase";

// "Other" is a sentinel option in each list - the submit form keys off
// it to render a free-text override input. Renaming or removing it
// would silently break that flow, so we block both.
const SENTINEL_OTHER = "Other";

type RefTable = "areas" | "unions" | "ethnicities";

export const load: PageServerLoad = async () => {
  const [areasRes, unionsRes, ethnicitiesRes, profilesRes, pendingRes] =
    await Promise.all([
      supabaseAdmin
        .from("areas")
        .select("id, name, description, sort_order")
        .order("sort_order"),
      supabaseAdmin
        .from("unions")
        .select("id, name, description, sort_order")
        .order("sort_order"),
      supabaseAdmin
        .from("ethnicities")
        .select("id, name, sort_order")
        .order("sort_order"),
      // Pull the in-use values so each row can show "X profiles use this"
      // and Lexi knows what a rename would cascade through.
      supabaseAdmin
        .from("profiles")
        .select("geographic_area, unions, ethnicities")
        .is("deleted_at", null),
      supabaseAdmin
        .from("pending_submissions")
        .select("geographic_area, unions, ethnicities"),
    ]);
  if (areasRes.error) throw areasRes.error;
  if (unionsRes.error) throw unionsRes.error;
  if (ethnicitiesRes.error) throw ethnicitiesRes.error;

  // Tally usage across both profiles + pending_submissions so the UI can
  // surface "X uses". Ordering doesn't matter; we just count occurrences.
  const areaCounts: Record<string, number> = {};
  const unionCounts: Record<string, number> = {};
  const ethnicityCounts: Record<string, number> = {};
  const rows = [
    ...(profilesRes.data ?? []),
    ...(pendingRes.data ?? []),
  ] as Array<{
    geographic_area: string | null;
    unions: string[] | null;
    ethnicities: string[] | null;
  }>;
  for (const r of rows) {
    if (r.geographic_area) {
      areaCounts[r.geographic_area] = (areaCounts[r.geographic_area] ?? 0) + 1;
    }
    for (const u of r.unions ?? []) {
      unionCounts[u] = (unionCounts[u] ?? 0) + 1;
    }
    for (const e of r.ethnicities ?? []) {
      ethnicityCounts[e] = (ethnicityCounts[e] ?? 0) + 1;
    }
  }

  return {
    areas: areasRes.data ?? [],
    unions: unionsRes.data ?? [],
    ethnicities: ethnicitiesRes.data ?? [],
    counts: {
      areas: areaCounts,
      unions: unionCounts,
      ethnicities: ethnicityCounts,
    },
  };
};

// ---------- Helpers shared across the three sections ----------

function trim(data: FormData, key: string): string {
  return ((data.get(key) as string) ?? "").trim();
}

function intOr(data: FormData, key: string, fallback: number): number {
  const s = trim(data, key);
  if (!s) return fallback;
  const n = Number(s);
  return Number.isFinite(n) ? n : fallback;
}

// Cascade rename across `profiles.geographic_area` (text) +
// `pending_submissions.geographic_area`. Only used by areas.
async function cascadeAreaRename(oldName: string, newName: string) {
  await supabaseAdmin
    .from("profiles")
    .update({ geographic_area: newName })
    .eq("geographic_area", oldName);
  await supabaseAdmin
    .from("pending_submissions")
    .update({ geographic_area: newName })
    .eq("geographic_area", oldName);
}

// Cascade rename across an array column on profiles + pending. Used by
// unions and ethnicities. Pulls rows that contain the old value, mutates
// in JS (de-duped against existing newName values), writes back.
async function cascadeArrayRename(
  column: "unions" | "ethnicities",
  oldName: string,
  newName: string,
) {
  // Profiles
  const { data: pRows } = await supabaseAdmin
    .from("profiles")
    .select(`id, ${column}`)
    .contains(column, [oldName]);
  for (const r of (pRows ?? []) as Array<{ id: string } & Record<string, string[]>>) {
    const next = Array.from(
      new Set(
        (r[column] as string[]).map((v) => (v === oldName ? newName : v)),
      ),
    );
    await supabaseAdmin
      .from("profiles")
      .update({ [column]: next })
      .eq("id", r.id);
  }
  // Pending submissions
  const { data: sRows } = await supabaseAdmin
    .from("pending_submissions")
    .select(`id, ${column}`)
    .contains(column, [oldName]);
  for (const r of (sRows ?? []) as Array<{ id: string } & Record<string, string[]>>) {
    const next = Array.from(
      new Set(
        (r[column] as string[]).map((v) => (v === oldName ? newName : v)),
      ),
    );
    await supabaseAdmin
      .from("pending_submissions")
      .update({ [column]: next })
      .eq("id", r.id);
  }
}

// Generic add for a {name, sort_order, description?} row. Caller passes
// the table; uniqueness is enforced by the DB.
async function addRow(
  table: RefTable,
  fields: { name: string; sort_order: number; description?: string | null },
) {
  const { error } = await supabaseAdmin.from(table).insert(fields);
  if (error) {
    if (error.code === "23505") return { error: "Already exists." };
    return { error: "Could not add." };
  }
  return { ok: true as const };
}

// Generic reorder.
async function reorderRow(table: RefTable, id: string, sort_order: number) {
  const { error } = await supabaseAdmin
    .from(table)
    .update({ sort_order })
    .eq("id", id);
  if (error) return { error: "Could not reorder." };
  return { ok: true as const };
}

// Generic remove.
async function removeRow(table: RefTable, id: string) {
  const { error } = await supabaseAdmin.from(table).delete().eq("id", id);
  if (error) return { error: "Could not remove." };
  return { ok: true as const };
}

// Generic rename (handles the merge case the same way disciplines does).
// The cascade callback is supplied by the caller because each table's
// data lives in a different shape on profiles.
async function renameRow(
  table: RefTable,
  id: string,
  newName: string,
  cascade: (oldName: string, newName: string) => Promise<void>,
) {
  const { data: row } = await supabaseAdmin
    .from(table)
    .select("id, name")
    .eq("id", id)
    .maybeSingle();
  if (!row) return { error: "Not found." };
  // Areas: "Other" is renameable - it's just a regular row now (the
  // free-text override input was removed; people who pick Other type
  // their location into the City field instead).
  // Unions / ethnicities: "Other" is still the picker's free-text key,
  // so renaming it would silently break those flows.
  if (table !== "areas" && row.name === SENTINEL_OTHER) {
    return {
      error: `"${SENTINEL_OTHER}" is reserved for the free-text fallback. Don't rename it.`,
    };
  }
  if (row.name === newName) return { ok: true as const, name: newName };

  const { data: existing } = await supabaseAdmin
    .from(table)
    .select("id")
    .eq("name", newName)
    .maybeSingle();
  const isMerge = !!existing && existing.id !== row.id;

  // Cascade first; if the cascade succeeds but the row update fails, the
  // world is still consistent (every reference points at newName, and
  // newName is a valid row).
  await cascade(row.name, newName);

  if (isMerge) {
    const { error } = await supabaseAdmin.from(table).delete().eq("id", row.id);
    if (error) return { error: "Cascade ran but couldn't retire old row." };
    return { ok: true as const, name: newName, merged: true };
  }

  const { error } = await supabaseAdmin
    .from(table)
    .update({ name: newName })
    .eq("id", row.id);
  if (error) return { error: "Cascade ran but couldn't update row." };
  return { ok: true as const, name: newName };
}

// Generic description edit (areas + unions only).
async function editDescription(
  table: "areas" | "unions",
  id: string,
  description: string,
) {
  const { error } = await supabaseAdmin
    .from(table)
    .update({ description: description || null })
    .eq("id", id);
  if (error) return { error: "Could not save description." };
  return { ok: true as const };
}

// ---------- Actions ----------

export const actions: Actions = {
  // ===== Areas =====
  addArea: async ({ request }) => {
    const data = await request.formData();
    const name = trim(data, "name");
    const description = trim(data, "description");
    const sort_order = intOr(data, "sort_order", 100);
    if (!name) return fail(400, { error: "Name required.", section: "areas" });
    const r = await addRow("areas", {
      name,
      sort_order,
      description: description || null,
    });
    if ("error" in r) return fail(400, { error: r.error, section: "areas" });
    return { added: name, section: "areas" };
  },
  renameArea: async ({ request }) => {
    const data = await request.formData();
    const id = trim(data, "id");
    const newName = trim(data, "new_name");
    if (!id || !newName)
      return fail(400, { error: "Missing fields.", section: "areas" });
    const r = await renameRow("areas", id, newName, cascadeAreaRename);
    if ("error" in r) return fail(400, { error: r.error, section: "areas" });
    return { renamed: r.name, merged: r.merged ?? false, section: "areas" };
  },
  reorderArea: async ({ request }) => {
    const data = await request.formData();
    const id = trim(data, "id");
    const sort_order = intOr(data, "sort_order", 100);
    if (!id) return fail(400, { error: "Missing id.", section: "areas" });
    const r = await reorderRow("areas", id, sort_order);
    if ("error" in r) return fail(500, { error: r.error, section: "areas" });
    return { reordered: true, section: "areas" };
  },
  removeArea: async ({ request }) => {
    const data = await request.formData();
    const id = trim(data, "id");
    if (!id) return fail(400, { error: "Missing id.", section: "areas" });
    // Block removal of the "Other" sentinel.
    const { data: row } = await supabaseAdmin
      .from("areas")
      .select("name")
      .eq("id", id)
      .maybeSingle();
    if (row?.name === SENTINEL_OTHER) {
      return fail(400, {
        error: `"${SENTINEL_OTHER}" is reserved. Don't remove it.`,
        section: "areas",
      });
    }
    const r = await removeRow("areas", id);
    if ("error" in r) return fail(500, { error: r.error, section: "areas" });
    return { removed: true, section: "areas" };
  },
  editAreaDescription: async ({ request }) => {
    const data = await request.formData();
    const id = trim(data, "id");
    const description = trim(data, "description");
    if (!id) return fail(400, { error: "Missing id.", section: "areas" });
    const r = await editDescription("areas", id, description);
    if ("error" in r) return fail(500, { error: r.error, section: "areas" });
    return { descSaved: true, section: "areas" };
  },

  // ===== Unions =====
  addUnion: async ({ request }) => {
    const data = await request.formData();
    const name = trim(data, "name");
    const description = trim(data, "description");
    const sort_order = intOr(data, "sort_order", 100);
    if (!name) return fail(400, { error: "Name required.", section: "unions" });
    const r = await addRow("unions", {
      name,
      sort_order,
      description: description || null,
    });
    if ("error" in r) return fail(400, { error: r.error, section: "unions" });
    return { added: name, section: "unions" };
  },
  renameUnion: async ({ request }) => {
    const data = await request.formData();
    const id = trim(data, "id");
    const newName = trim(data, "new_name");
    if (!id || !newName)
      return fail(400, { error: "Missing fields.", section: "unions" });
    const r = await renameRow("unions", id, newName, (o, n) =>
      cascadeArrayRename("unions", o, n),
    );
    if ("error" in r) return fail(400, { error: r.error, section: "unions" });
    return { renamed: r.name, merged: r.merged ?? false, section: "unions" };
  },
  reorderUnion: async ({ request }) => {
    const data = await request.formData();
    const id = trim(data, "id");
    const sort_order = intOr(data, "sort_order", 100);
    if (!id) return fail(400, { error: "Missing id.", section: "unions" });
    const r = await reorderRow("unions", id, sort_order);
    if ("error" in r) return fail(500, { error: r.error, section: "unions" });
    return { reordered: true, section: "unions" };
  },
  removeUnion: async ({ request }) => {
    const data = await request.formData();
    const id = trim(data, "id");
    if (!id) return fail(400, { error: "Missing id.", section: "unions" });
    const { data: row } = await supabaseAdmin
      .from("unions")
      .select("name")
      .eq("id", id)
      .maybeSingle();
    if (row?.name === SENTINEL_OTHER) {
      return fail(400, {
        error: `"${SENTINEL_OTHER}" is reserved. Don't remove it.`,
        section: "unions",
      });
    }
    const r = await removeRow("unions", id);
    if ("error" in r) return fail(500, { error: r.error, section: "unions" });
    return { removed: true, section: "unions" };
  },
  editUnionDescription: async ({ request }) => {
    const data = await request.formData();
    const id = trim(data, "id");
    const description = trim(data, "description");
    if (!id) return fail(400, { error: "Missing id.", section: "unions" });
    const r = await editDescription("unions", id, description);
    if ("error" in r) return fail(500, { error: r.error, section: "unions" });
    return { descSaved: true, section: "unions" };
  },

  // ===== Ethnicities =====
  addEthnicity: async ({ request }) => {
    const data = await request.formData();
    const name = trim(data, "name");
    const sort_order = intOr(data, "sort_order", 100);
    if (!name)
      return fail(400, { error: "Name required.", section: "ethnicities" });
    const r = await addRow("ethnicities", { name, sort_order });
    if ("error" in r)
      return fail(400, { error: r.error, section: "ethnicities" });
    return { added: name, section: "ethnicities" };
  },
  renameEthnicity: async ({ request }) => {
    const data = await request.formData();
    const id = trim(data, "id");
    const newName = trim(data, "new_name");
    if (!id || !newName)
      return fail(400, { error: "Missing fields.", section: "ethnicities" });
    const r = await renameRow("ethnicities", id, newName, (o, n) =>
      cascadeArrayRename("ethnicities", o, n),
    );
    if ("error" in r)
      return fail(400, { error: r.error, section: "ethnicities" });
    return { renamed: r.name, merged: r.merged ?? false, section: "ethnicities" };
  },
  reorderEthnicity: async ({ request }) => {
    const data = await request.formData();
    const id = trim(data, "id");
    const sort_order = intOr(data, "sort_order", 100);
    if (!id) return fail(400, { error: "Missing id.", section: "ethnicities" });
    const r = await reorderRow("ethnicities", id, sort_order);
    if ("error" in r)
      return fail(500, { error: r.error, section: "ethnicities" });
    return { reordered: true, section: "ethnicities" };
  },
  removeEthnicity: async ({ request }) => {
    const data = await request.formData();
    const id = trim(data, "id");
    if (!id) return fail(400, { error: "Missing id.", section: "ethnicities" });
    const r = await removeRow("ethnicities", id);
    if ("error" in r)
      return fail(500, { error: r.error, section: "ethnicities" });
    return { removed: true, section: "ethnicities" };
  },
};
