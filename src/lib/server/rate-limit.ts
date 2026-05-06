// Per-IP per-endpoint rate limiter for public submit / contact-form
// endpoints. Mirrors the admin-auth login-attempt pattern.
//
// Default policy: 5 submits per hour per IP per endpoint. Honeypot +
// email-verification already filters most automated abuse; this closes
// the "determined script floods pending_submissions" vector.

import { supabaseAdmin } from "$lib/server/supabase";

const WINDOW_MS = 60 * 60 * 1000; // 1 hour
const MAX_SUBMITS = 5;

export type RateLimitResult =
  | { ok: true }
  | { ok: false; retryAfterMs: number };

/**
 * Check whether (ip, endpoint) has hit the submit limit. Always logs
 * the attempt (success or fail), so a flood gets visibility in the
 * `submit_rate_limits` table either way.
 */
export async function checkSubmitRateLimit(
  ip: string,
  endpoint: string,
): Promise<RateLimitResult> {
  const since = new Date(Date.now() - WINDOW_MS).toISOString();
  const { count } = await supabaseAdmin
    .from("submit_rate_limits")
    .select("*", { count: "exact", head: true })
    .eq("ip_address", ip)
    .eq("endpoint", endpoint)
    .gte("attempted_at", since);

  await supabaseAdmin.from("submit_rate_limits").insert({
    ip_address: ip,
    endpoint,
  });

  if ((count ?? 0) >= MAX_SUBMITS) {
    return { ok: false, retryAfterMs: WINDOW_MS };
  }
  return { ok: true };
}

/** Friendly user-facing message for hit-limit responses. */
export const RATE_LIMIT_MESSAGE =
  "Too many submissions from your network in the past hour. Please try again later.";
