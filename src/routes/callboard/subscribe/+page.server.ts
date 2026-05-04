// /callboard/subscribe
// POST endpoint for the weekly-digest signup form. Inserts an
// unconfirmed callboard_subscriptions row + emails a confirmation link.
// The subscription is dormant until the user clicks the link, defending
// against drive-by signups (someone typing other people's emails).
//
// Filter model (post mig 071): four dimensions stored as id/slug arrays,
// each with the "empty array = no filter / give me everything (including
// admin-added options later)" sentinel. Subscriber narrows by unticking;
// firehose subscribers store empty arrays and pick up new options for
// free as admin adds them.
//
// Reachable directly via GET too: shows a thanks-page state after the
// form POST redirects here.

import { fail, redirect } from "@sveltejs/kit";
import { randomBytes } from "node:crypto";
import type { Actions, PageServerLoad } from "./$types";
import { PUBLIC_SITE_URL } from "$env/static/public";
import { supabaseAdmin } from "$lib/server/supabase";
import { sendEmail } from "$lib/server/email";

export const load: PageServerLoad = async ({ url }) => {
  // Pull options for the form. All four lists are admin-managed so any
  // future-added rows surface here without a code change.
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

  return {
    sent: url.searchParams.get("sent") === "1",
    postTypes: postTypesRes.data ?? [],
    areas: areasRes.data ?? [],
    categories: categoriesRes.data ?? [],
  };
};

// Helper: collapse "ticked everything available" to an empty array
// (= no filter, future-additions auto-included). Otherwise return the
// explicit picked list. Empty input also collapses to empty array
// (defaulting to firehose if user picks nothing - friendlier than
// rejecting the submit).
function collapseTickedAll(picked: Set<string>, allValid: Set<string>): string[] {
  const tickedAll =
    picked.size === allValid.size &&
    Array.from(allValid).every((v) => picked.has(v));
  if (tickedAll || picked.size === 0) return [];
  return Array.from(picked);
}

export const actions: Actions = {
  default: async ({ request }) => {
    const fd = await request.formData();

    // Honeypot
    if ((fd.get("website") as string)?.trim()) {
      throw redirect(303, "/callboard/subscribe?sent=1");
    }

    const email = ((fd.get("email") as string) ?? "").trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return fail(400, { error: "Enter a valid email address.", values: { email } });
    }

    // Live validation against admin-managed source tables.
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

    const postTypes = collapseTickedAll(tickedTypes, validTypeSlugs);
    const callboardAreaIds = collapseTickedAll(tickedCallboardAreas, validAreaIds);
    const calendarCategoryIds = collapseTickedAll(tickedCategories, validCategoryIds);
    const calendarAreaIds = collapseTickedAll(tickedCalendarAreas, validAreaIds);

    // Look up existing subscription. We only re-fire confirmation when
    // the row hasn't been confirmed yet OR was unsubscribed; an active
    // confirmed subscription updating their filters from the public
    // form is unusual (we expect that traffic on the manage page
    // instead) so we silently no-op there.
    const { data: existing } = await supabaseAdmin
      .from("callboard_subscriptions")
      .select("id, confirmed_at, unsubscribed_at")
      .eq("subscriber_email", email)
      .maybeSingle();

    const confirmToken = randomBytes(24).toString("base64url");
    const nowIso = new Date().toISOString();

    if (existing) {
      const isActive = existing.confirmed_at && !existing.unsubscribed_at;
      if (isActive) {
        throw redirect(303, "/callboard/subscribe?sent=1");
      }
      await supabaseAdmin
        .from("callboard_subscriptions")
        .update({
          post_types: postTypes,
          callboard_area_ids: callboardAreaIds,
          calendar_category_ids: calendarCategoryIds,
          calendar_area_ids: calendarAreaIds,
          confirmation_token: confirmToken,
          confirmed_at: null,
          unsubscribed_at: null,
          preferences_updated_at: nowIso,
        })
        .eq("id", existing.id);
    } else {
      const { error: insErr } = await supabaseAdmin
        .from("callboard_subscriptions")
        .insert({
          subscriber_email: email,
          post_types: postTypes,
          callboard_area_ids: callboardAreaIds,
          calendar_category_ids: calendarCategoryIds,
          calendar_area_ids: calendarAreaIds,
          confirmation_token: confirmToken,
          preferences_updated_at: nowIso,
        });
      if (insErr) {
        console.error("subscription insert failed", insErr);
        return fail(500, {
          error: "Could not save your subscription. Try again in a minute.",
          values: { email },
        });
      }
    }

    const confirmUrl = `${PUBLIC_SITE_URL}/callboard/subscribe/confirm/${confirmToken}`;
    await sendEmail({
      to: email,
      templateSlug: "subscription_confirm",
      vars: { confirm_url: confirmUrl },
    });

    throw redirect(303, "/callboard/subscribe?sent=1");
  },
};
