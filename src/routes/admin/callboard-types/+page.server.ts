// /admin/callboard-types: CRUD for callboard post types. Lets Lexi
// add Workshops / Meetups / Director Calls / etc. alongside the seeded
// 5 (Audition / Designer / Crew / Production / General). Slug is the
// stable identifier stored on callboard_posts.post_type; the label /
// plural / glyph / marquee_prefix control display.
//
// Removal is blocked when posts still reference a type (FK
// `on delete restrict`), so admin gets a clear error rather than a
// silent orphan.

import { fail } from "@sveltejs/kit";
import type { Actions, PageServerLoad } from "./$types";
import { supabaseAdmin } from "$lib/server/supabase";

const SLUG_RE = /^[a-z][a-z0-9_-]{0,30}$/;

export const load: PageServerLoad = async () => {
  const [typesRes, countsRes] = await Promise.all([
    supabaseAdmin
      .from("callboard_post_types")
      .select("slug, label, plural_label, description, sort_order, glyph, marquee_prefix, active")
      .order("sort_order"),
    // How many posts use each type? Helps the UI signal which types
    // can't be deleted without re-tagging existing posts first.
    supabaseAdmin
      .from("callboard_posts")
      .select("post_type")
      .is("deleted_at", null),
  ]);
  if (typesRes.error) throw typesRes.error;

  const counts: Record<string, number> = {};
  for (const r of countsRes.data ?? []) {
    counts[r.post_type] = (counts[r.post_type] ?? 0) + 1;
  }

  return {
    types: typesRes.data ?? [],
    counts,
  };
};

function clean(v: FormDataEntryValue | null): string {
  return ((v as string) ?? "").trim();
}
function intOrDefault(v: FormDataEntryValue | null, fallback: number): number {
  const s = clean(v);
  if (!s) return fallback;
  const n = Number(s);
  return Number.isFinite(n) ? n : fallback;
}

export const actions: Actions = {
  add: async ({ request }) => {
    const data = await request.formData();
    const slug = clean(data.get("slug")).toLowerCase();
    const label = clean(data.get("label"));
    const pluralLabel = clean(data.get("plural_label")) || label;
    const description = clean(data.get("description")) || null;
    const sortOrder = intOrDefault(data.get("sort_order"), 100);
    const glyph = clean(data.get("glyph")) || "✦";
    const marqueePrefix = clean(data.get("marquee_prefix")) || null;
    const active = data.get("active") !== "off";

    if (!SLUG_RE.test(slug)) {
      return fail(400, {
        error:
          "Slug must be lowercase letters, numbers, dashes, or underscores. Start with a letter; max 31 chars.",
      });
    }
    if (!label) return fail(400, { error: "Label is required." });

    const { error } = await supabaseAdmin
      .from("callboard_post_types")
      .insert({
        slug,
        label,
        plural_label: pluralLabel,
        description,
        sort_order: sortOrder,
        glyph,
        marquee_prefix: marqueePrefix,
        active,
      });
    if (error) {
      if (error.code === "23505") {
        return fail(400, { error: `A type with slug "${slug}" already exists.` });
      }
      console.error("post type insert failed", error);
      return fail(500, { error: "Could not add type." });
    }
    return { added: slug };
  },

  update: async ({ request }) => {
    const data = await request.formData();
    const slug = clean(data.get("slug"));
    if (!slug) return fail(400, { error: "Missing slug." });

    const label = clean(data.get("label"));
    const pluralLabel = clean(data.get("plural_label")) || label;
    const description = clean(data.get("description")) || null;
    const sortOrder = intOrDefault(data.get("sort_order"), 100);
    const glyph = clean(data.get("glyph")) || "✦";
    const marqueePrefix = clean(data.get("marquee_prefix")) || null;
    const active = data.get("active") !== "off";

    if (!label) return fail(400, { error: "Label is required." });

    const { error } = await supabaseAdmin
      .from("callboard_post_types")
      .update({
        label,
        plural_label: pluralLabel,
        description,
        sort_order: sortOrder,
        glyph,
        marquee_prefix: marqueePrefix,
        active,
      })
      .eq("slug", slug);
    if (error) {
      console.error("post type update failed", error);
      return fail(500, { error: "Could not save changes." });
    }
    return { updated: slug };
  },

  remove: async ({ request }) => {
    const data = await request.formData();
    const slug = clean(data.get("slug"));
    if (!slug) return fail(400, { error: "Missing slug." });

    // Block delete if any posts (live or trash) reference this type.
    // The FK constraint would catch this anyway, but a friendlier error
    // here saves a roundtrip.
    const { count } = await supabaseAdmin
      .from("callboard_posts")
      .select("*", { count: "exact", head: true })
      .eq("post_type", slug);
    if ((count ?? 0) > 0) {
      return fail(409, {
        error: `Can't delete - ${count} post${count === 1 ? "" : "s"} still use${count === 1 ? "s" : ""} this type. Re-tag them first, or use the Active toggle to hide it without deleting.`,
      });
    }

    const { error } = await supabaseAdmin
      .from("callboard_post_types")
      .delete()
      .eq("slug", slug);
    if (error) {
      console.error("post type delete failed", error);
      return fail(500, { error: "Could not delete type." });
    }
    return { removed: slug };
  },
};
