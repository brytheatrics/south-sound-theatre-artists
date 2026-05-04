// /callboard/subscribe/manage/[token]
//
// Edit-existing-subscription surface. Reached by clicking "Manage your
// preferences" in any digest email's footer. Token is the subscription
// row's `unsubscribe_token` (already minted at signup, stable across
// confirm / unsub cycles, mailed in every digest). No email
// reconfirmation required on save - the token IS the proof of identity
// and the worst-case attack is "someone narrows your filter list,"
// which the legitimate subscriber can revert in seconds.

import { error, fail } from "@sveltejs/kit";
import type { Actions, PageServerLoad } from "./$types";
import { supabaseAdmin } from "$lib/server/supabase";

export const load: PageServerLoad = async ({ params, url }) => {
  const token = (params.token ?? "").trim();
  if (!token) throw error(400, "Missing token.");

  const { data: sub, error: subErr } = await supabaseAdmin
    .from("callboard_subscriptions")
    .select(
      `id, subscriber_email, post_types, callboard_area_ids,
       calendar_category_ids, calendar_area_ids, preferences_updated_at,
       confirmed_at, unsubscribed_at`,
    )
    .eq("unsubscribe_token", token)
    .maybeSingle();

  if (subErr) {
    console.error("manage-subscription lookup failed", subErr);
    throw error(500, "Could not load your preferences right now.");
  }
  if (!sub) {
    throw error(404, "This preferences link is invalid or has expired.");
  }
  if (sub.unsubscribed_at) {
    throw error(410, "This subscription has been unsubscribed - resubscribe at /callboard/subscribe to start receiving the digest again.");
  }

  // Pull all admin-managed option lists for the form.
  const [postTypesRes, areasRes, categoriesRes] = await Promise.all([
    supabaseAdmin
      .from("callboard_post_types")
      .select("slug, label, plural_label, sort_order")
      .eq("active", true)
      .order("sort_order"),
    supabaseAdmin
      .from("areas")
      .select("id, name, sort_order")
      .order("sort_order"),
    supabaseAdmin
      .from("event_categories")
      .select("id, name, slug, sort_order")
      .order("sort_order"),
  ]);

  const allTypeSlugs = (postTypesRes.data ?? []).map((t) => t.slug as string);
  const allAreaIds = (areasRes.data ?? []).map((a) => a.id as string);
  const allCategoryIds = (categoriesRes.data ?? []).map((c) => c.id as string);

  // Translate stored arrays into ticked sets for the form. An empty
  // stored array means "firehose" (no filter), so we display it as
  // every option ticked - that way the user sees their actual
  // subscription scope and the next save preserves the "ticked all
  // = empty = firehose" semantics.
  const initialPickedTypes =
    (sub.post_types ?? []).length === 0 ? allTypeSlugs : sub.post_types;
  const initialPickedCallboardAreas =
    (sub.callboard_area_ids ?? []).length === 0 ? allAreaIds : sub.callboard_area_ids;
  const initialPickedCategories =
    (sub.calendar_category_ids ?? []).length === 0 ? allCategoryIds : sub.calendar_category_ids;
  const initialPickedCalendarAreas =
    (sub.calendar_area_ids ?? []).length === 0 ? allAreaIds : sub.calendar_area_ids;

  return {
    email: sub.subscriber_email,
    postTypes: postTypesRes.data ?? [],
    areas: areasRes.data ?? [],
    categories: categoriesRes.data ?? [],
    initialPickedTypes,
    initialPickedCallboardAreas,
    initialPickedCategories,
    initialPickedCalendarAreas,
    saved: url.searchParams.get("saved") === "1",
  };
};

function collapseTickedAll(picked: Set<string>, allValid: Set<string>): string[] {
  const tickedAll =
    picked.size === allValid.size &&
    Array.from(allValid).every((v) => picked.has(v));
  if (tickedAll || picked.size === 0) return [];
  return Array.from(picked);
}

export const actions: Actions = {
  default: async ({ request, params, url }) => {
    const token = (params.token ?? "").trim();
    if (!token) return fail(400, { error: "Missing token." });

    const { data: sub } = await supabaseAdmin
      .from("callboard_subscriptions")
      .select("id")
      .eq("unsubscribe_token", token)
      .is("unsubscribed_at", null)
      .maybeSingle();
    if (!sub) return fail(404, { error: "Subscription not found." });

    const fd = await request.formData();

    const [validTypeRes, validAreaRes, validCategoryRes] = await Promise.all([
      supabaseAdmin
        .from("callboard_post_types")
        .select("slug")
        .eq("active", true),
      supabaseAdmin.from("areas").select("id"),
      supabaseAdmin.from("event_categories").select("id"),
    ]);
    const validTypeSlugs = new Set((validTypeRes.data ?? []).map((r) => r.slug as string));
    const validAreaIds = new Set((validAreaRes.data ?? []).map((r) => r.id as string));
    const validCategoryIds = new Set((validCategoryRes.data ?? []).map((r) => r.id as string));

    const tickedTypes = new Set(
      fd.getAll("post_type").map(String).filter((s) => validTypeSlugs.has(s)),
    );
    const tickedCallboardAreas = new Set(
      fd.getAll("callboard_area_id").map(String).filter((s) => validAreaIds.has(s)),
    );
    const tickedCategories = new Set(
      fd.getAll("calendar_category_id").map(String).filter((s) => validCategoryIds.has(s)),
    );
    const tickedCalendarAreas = new Set(
      fd.getAll("calendar_area_id").map(String).filter((s) => validAreaIds.has(s)),
    );

    const post_types = collapseTickedAll(tickedTypes, validTypeSlugs);
    const callboard_area_ids = collapseTickedAll(tickedCallboardAreas, validAreaIds);
    const calendar_category_ids = collapseTickedAll(tickedCategories, validCategoryIds);
    const calendar_area_ids = collapseTickedAll(tickedCalendarAreas, validAreaIds);

    const { error: updErr } = await supabaseAdmin
      .from("callboard_subscriptions")
      .update({
        post_types,
        callboard_area_ids,
        calendar_category_ids,
        calendar_area_ids,
        preferences_updated_at: new Date().toISOString(),
      })
      .eq("id", sub.id);

    if (updErr) {
      console.error("manage-subscription save failed", updErr);
      return fail(500, { error: "Could not save your preferences. Try again." });
    }

    // PRG so refresh after save doesn't re-post.
    return { saved: true };
  },
};
