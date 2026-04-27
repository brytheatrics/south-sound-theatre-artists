// Admin authentication helpers.
//
// Flow:
//   1. POST /admin/login with password.
//      - Rate-limit: 5 failed attempts per IP per 15 min.
//      - Constant-time compare against ADMIN_PASSWORD env var.
//      - On success: generate a 6-digit code, hash + store in
//        magic_link_tokens with purpose='admin_2fa', expires in 10 min.
//        Send to ADMIN_EMAIL via the email wrapper.
//   2. POST /admin/verify with code.
//      - Look up by hash, check expiry + used_at.
//      - On success: mark token used_at, generate session token,
//        hash + store in admin_sessions, set httpOnly cookie.
//   3. hooks.server.ts validates the cookie on every request to /admin/*.

import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { ADMIN_PASSWORD } from "$env/static/private";
import { supabaseAdmin } from "./supabase";

export const SESSION_COOKIE = "ssta_admin";
export const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days
export const TWOFA_TTL_MS = 10 * 60 * 1000; // 10 minutes
export const RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000;
export const RATE_LIMIT_MAX_FAILS = 5;

export function checkPassword(submitted: string): boolean {
  const a = Buffer.from(submitted, "utf8");
  const b = Buffer.from(ADMIN_PASSWORD, "utf8");
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export function generateTwoFaCode(): string {
  // Six-digit numeric code, zero-padded.
  const n = Math.floor(Math.random() * 1_000_000);
  return n.toString().padStart(6, "0");
}

export function generateSessionToken(): string {
  return randomBytes(32).toString("base64url");
}

export function hashSecret(secret: string): string {
  return createHash("sha256").update(secret).digest("hex");
}

/** Throws if the IP has hit the rate limit; logs an attempt either way. */
export async function checkLoginRateLimit(ip: string): Promise<{
  ok: boolean;
  retryAfterMs?: number;
}> {
  const since = new Date(Date.now() - RATE_LIMIT_WINDOW_MS).toISOString();
  const { count } = await supabaseAdmin
    .from("admin_login_attempts")
    .select("*", { count: "exact", head: true })
    .eq("ip_address", ip)
    .eq("success", false)
    .gte("attempted_at", since);
  if ((count ?? 0) >= RATE_LIMIT_MAX_FAILS) {
    return { ok: false, retryAfterMs: RATE_LIMIT_WINDOW_MS };
  }
  return { ok: true };
}

export async function logLoginAttempt(
  ip: string,
  success: boolean,
  reason?: string,
): Promise<void> {
  await supabaseAdmin.from("admin_login_attempts").insert({
    ip_address: ip,
    success,
    reason: reason ?? null,
  });
}

export type AdminSession = {
  id: string;
  email: string;
  expires_at: string;
};

export async function findValidSession(
  rawToken: string,
): Promise<AdminSession | null> {
  if (!rawToken || rawToken.length < 16) return null;
  const tokenHash = hashSecret(rawToken);
  const { data, error } = await supabaseAdmin
    .from("admin_sessions")
    .select("id, email, expires_at")
    .eq("token_hash", tokenHash)
    .gt("expires_at", new Date().toISOString())
    .maybeSingle();
  if (error || !data) return null;
  // Touch last_used_at for sliding-session bookkeeping.
  await supabaseAdmin
    .from("admin_sessions")
    .update({ last_used_at: new Date().toISOString() })
    .eq("id", data.id);
  return data;
}

export async function revokeSession(rawToken: string): Promise<void> {
  if (!rawToken) return;
  await supabaseAdmin
    .from("admin_sessions")
    .delete()
    .eq("token_hash", hashSecret(rawToken));
}
