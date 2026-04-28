// /callboard/unsubscribe/[token]
// One-click unsubscribe from the weekly callboard digest. The token is
// the per-row unsubscribe_token issued when the subscription was
// created. Hitting this route stamps unsubscribed_at; we render a
// confirmation page either way so the user gets feedback even if the
// row's already off.

import type { PageServerLoad } from "./$types";
import { supabaseAdmin } from "$lib/server/supabase";

export const load: PageServerLoad = async ({ params }) => {
  const token = (params.token ?? "").trim();
  if (!token) return { state: "invalid" as const, email: null };

  const { data, error } = await supabaseAdmin
    .from("callboard_subscriptions")
    .select("id, subscriber_email, unsubscribed_at")
    .eq("unsubscribe_token", token)
    .maybeSingle();

  if (error || !data) return { state: "invalid" as const, email: null };

  if (data.unsubscribed_at) {
    return { state: "already" as const, email: data.subscriber_email };
  }

  await supabaseAdmin
    .from("callboard_subscriptions")
    .update({ unsubscribed_at: new Date().toISOString() })
    .eq("id", data.id);

  return { state: "ok" as const, email: data.subscriber_email };
};
