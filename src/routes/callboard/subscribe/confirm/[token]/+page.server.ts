// /callboard/subscribe/confirm/[token]
// Final step of the double-opt-in flow. Looks up the subscription by
// confirmation_token, stamps confirmed_at, clears the token, and shows
// the user a confirmation page.

import type { PageServerLoad } from "./$types";
import { supabaseAdmin } from "$lib/server/supabase";

export const load: PageServerLoad = async ({ params }) => {
  const token = (params.token ?? "").trim();
  if (!token) return { state: "invalid" as const, email: null };

  const { data, error } = await supabaseAdmin
    .from("callboard_subscriptions")
    .select("id, subscriber_email, confirmed_at")
    .eq("confirmation_token", token)
    .maybeSingle();

  if (error || !data) return { state: "invalid" as const, email: null };

  if (data.confirmed_at) {
    return { state: "already" as const, email: data.subscriber_email };
  }

  await supabaseAdmin
    .from("callboard_subscriptions")
    .update({
      confirmed_at: new Date().toISOString(),
      confirmation_token: null,
    })
    .eq("id", data.id);

  return { state: "ok" as const, email: data.subscriber_email };
};
