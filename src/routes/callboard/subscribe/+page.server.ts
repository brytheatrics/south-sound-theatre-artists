// /callboard/subscribe
// POST endpoint for the weekly-digest signup form. Inserts an
// unconfirmed callboard_subscriptions row + emails a confirmation link.
// The subscription is dormant until the user clicks the link, defending
// against drive-by signups (someone typing other people's emails).
//
// Reachable directly via GET too: shows a thanks-page state after the
// form POST redirects here. The thanks page also covers the case where
// someone hits the URL by hand without submitting first.

import { fail, redirect } from "@sveltejs/kit";
import { randomBytes } from "node:crypto";
import type { Actions, PageServerLoad } from "./$types";
import { PUBLIC_SITE_URL } from "$env/static/public";
import { supabaseAdmin } from "$lib/server/supabase";
import { sendEmail } from "$lib/server/email";

const VALID_POST_TYPES = ["audition", "designer", "crew", "production", "general"];

export const load: PageServerLoad = async ({ url }) => {
  // Pull options for the form: callboard post types (admin-managed
  // table, so admin-added types like "Workshop" can be filtered too)
  // and the area list. Empty arrays in either selection mean "no
  // filter / show me everything."
  const [postTypesRes, areasRes] = await Promise.all([
    supabaseAdmin
      .from("callboard_post_types")
      .select("slug, label, plural_label, sort_order")
      .eq("active", true)
      .order("sort_order"),
    supabaseAdmin
      .from("areas")
      .select("id, name, sort_order")
      .order("sort_order"),
  ]);

  return {
    sent: url.searchParams.get("sent") === "1",
    postTypes: postTypesRes.data ?? [],
    areas: areasRes.data ?? [],
  };
};

export const actions: Actions = {
  default: async ({ request }) => {
    const fd = await request.formData();

    // Honeypot: a hidden form field bots tend to fill in. If anything
    // landed in `website` we silently 303 to the thanks state without
    // doing the real work.
    if ((fd.get("website") as string)?.trim()) {
      throw redirect(303, "/callboard/subscribe?sent=1");
    }

    const email = ((fd.get("email") as string) ?? "").trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return fail(400, { error: "Enter a valid email address.", values: { email } });
    }

    // Validate the post-type slugs against the live admin-managed
    // table rather than a hardcoded list, so admin-added types
    // (workshops etc.) carry through correctly.
    const { data: validTypeRows } = await supabaseAdmin
      .from("callboard_post_types")
      .select("slug")
      .eq("active", true);
    const validTypeSlugs = new Set(
      (validTypeRows ?? []).map((r) => r.slug as string),
    );
    const fallbackPostTypes =
      validTypeSlugs.size > 0 ? Array.from(validTypeSlugs) : VALID_POST_TYPES;
    const postTypesRaw = fd.getAll("post_type").map(String).filter(Boolean);
    const postTypes =
      postTypesRaw.length > 0
        ? postTypesRaw.filter((t) => validTypeSlugs.has(t))
        : fallbackPostTypes;

    // Areas: validate uuids against the live areas table. Empty array
    // = "all areas" (no filter); same convention as post_types.
    const areaIdsRaw = fd.getAll("area_id").map(String).filter(Boolean);
    let areaIds: string[] = [];
    if (areaIdsRaw.length > 0) {
      const { data: validAreaRows } = await supabaseAdmin
        .from("areas")
        .select("id")
        .in("id", areaIdsRaw);
      const validAreaIds = new Set(
        (validAreaRows ?? []).map((r) => r.id as string),
      );
      areaIds = areaIdsRaw.filter((id) => validAreaIds.has(id));
    }

    // Look up an existing row first so we can re-confirm idempotently
    // without losing history (and without leaking that the email
    // already exists - we always show the same thanks state).
    const { data: existing } = await supabaseAdmin
      .from("callboard_subscriptions")
      .select("id, confirmed_at, unsubscribed_at")
      .eq("subscriber_email", email)
      .maybeSingle();

    const confirmToken = randomBytes(24).toString("base64url");

    if (existing) {
      // If they had unsubscribed, re-activate the row. If they've never
      // confirmed, refresh their confirmation token + post-type filter.
      // Already-confirmed + active: silently no-op (don't spam them).
      const isActive = existing.confirmed_at && !existing.unsubscribed_at;
      if (isActive) {
        throw redirect(303, "/callboard/subscribe?sent=1");
      }
      await supabaseAdmin
        .from("callboard_subscriptions")
        .update({
          post_types: postTypes,
          area_ids: areaIds,
          confirmation_token: confirmToken,
          // Reset confirmed_at on a re-subscribe attempt so the click
          // is required again.
          confirmed_at: null,
          unsubscribed_at: null,
        })
        .eq("id", existing.id);
    } else {
      const { error: insErr } = await supabaseAdmin
        .from("callboard_subscriptions")
        .insert({
          subscriber_email: email,
          post_types: postTypes,
          area_ids: areaIds,
          confirmation_token: confirmToken,
          // unsubscribe_token defaults via mig 033's column default for
          // new rows; it stays the same across confirm/unsub cycles.
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
