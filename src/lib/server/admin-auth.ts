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

import {
  createHash,
  randomBytes,
  scryptSync,
  timingSafeEqual,
} from "node:crypto";
import { ADMIN_PASSWORD } from "$env/static/private";
import { env as privateEnv } from "$env/dynamic/private";
import { supabaseAdmin } from "./supabase";

export const SESSION_COOKIE = "ssta_admin";
export const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days
export const TWOFA_TTL_MS = 10 * 60 * 1000; // 10 minutes
export const RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000;
export const RATE_LIMIT_MAX_FAILS = 5;

// "Remember this device for 30 days" - cookie minted at /admin/verify
// when admin checks the box, consumed at /admin/login to skip the 2FA
// send. Separate from SESSION_COOKIE so revoking a session doesn't kill
// the trusted-device pass and vice versa.
export const TRUSTED_DEVICE_COOKIE = "ssta_admin_trusted_device";
export const TRUSTED_DEVICE_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

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
  admin_user_id: string | null;
};

export async function findValidSession(
  rawToken: string,
): Promise<AdminSession | null> {
  if (!rawToken || rawToken.length < 16) return null;
  const tokenHash = hashSecret(rawToken);
  const { data, error } = await supabaseAdmin
    .from("admin_sessions")
    .select("id, email, expires_at, admin_user_id")
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

/** Returns the trusted-device row if the cookie is still valid. */
export async function findValidTrustedDevice(
  rawToken: string,
  email: string,
): Promise<{ id: string } | null> {
  if (!rawToken || rawToken.length < 16) return null;
  const tokenHash = hashSecret(rawToken);
  const { data } = await supabaseAdmin
    .from("admin_trusted_devices")
    .select("id, expires_at, email")
    .eq("token_hash", tokenHash)
    .eq("email", email.toLowerCase())
    .gt("expires_at", new Date().toISOString())
    .maybeSingle();
  if (!data) return null;
  await supabaseAdmin
    .from("admin_trusted_devices")
    .update({ last_used_at: new Date().toISOString() })
    .eq("id", data.id);
  return { id: data.id };
}

/** Mints a new trusted-device row + returns the raw token to set as cookie. */
export async function createTrustedDevice(
  email: string,
  meta: { ip?: string; userAgent?: string | null; adminUserId?: string | null },
): Promise<{ rawToken: string; expiresAt: Date }> {
  const rawToken = randomBytes(32).toString("base64url");
  const tokenHash = hashSecret(rawToken);
  const expiresAt = new Date(Date.now() + TRUSTED_DEVICE_TTL_MS);
  await supabaseAdmin.from("admin_trusted_devices").insert({
    token_hash: tokenHash,
    email: email.toLowerCase(),
    expires_at: expiresAt.toISOString(),
    ip_address: meta.ip ?? null,
    user_agent: meta.userAgent ?? null,
    admin_user_id: meta.adminUserId ?? null,
  });
  return { rawToken, expiresAt };
}

// =============================================================
// Multi-admin (mig 080): admin_users table + per-user passwords
// =============================================================

export type AdminUser = {
  id: string;
  email: string;
  password_hash: string | null;
  name: string | null;
  role: "owner" | "admin";
  password_set_at: string | null;
  last_login_at: string | null;
};

/** scrypt-based password hashing using only Node built-ins. Format:
 *  "scrypt$<saltHex>$<derivedHex>". 64-byte derived key. */
const SCRYPT_KEYLEN = 64;
export function hashPassword(plain: string): string {
  const salt = randomBytes(16);
  const derived = scryptSync(plain, salt, SCRYPT_KEYLEN);
  return `scrypt$${salt.toString("hex")}$${derived.toString("hex")}`;
}

export function verifyPassword(plain: string, stored: string): boolean {
  if (!stored.startsWith("scrypt$")) return false;
  const parts = stored.split("$");
  if (parts.length !== 3) return false;
  const salt = Buffer.from(parts[1], "hex");
  const expected = Buffer.from(parts[2], "hex");
  let derived: Buffer;
  try {
    derived = scryptSync(plain, salt, SCRYPT_KEYLEN);
  } catch {
    return false;
  }
  if (derived.length !== expected.length) return false;
  return timingSafeEqual(derived, expected);
}

/** Look up an admin_users row by email (case-insensitive via citext column). */
export async function findAdminByEmail(email: string): Promise<AdminUser | null> {
  if (!email) return null;
  const { data } = await supabaseAdmin
    .from("admin_users")
    .select("id, email, password_hash, name, role, password_set_at, last_login_at")
    .eq("email", email.trim().toLowerCase())
    .is("deleted_at", null)
    .maybeSingle();
  return (data ?? null) as AdminUser | null;
}

/** First-login bootstrap: if admin_users is empty AND the submitted
 *  email + password match ADMIN_EMAIL + ADMIN_PASSWORD env vars,
 *  create the owner row with the hashed env password and return it.
 *  Otherwise null. */
export async function bootstrapOwnerIfNeeded(
  email: string,
  password: string,
): Promise<AdminUser | null> {
  const envEmail = (privateEnv.ADMIN_EMAIL ?? "").trim().toLowerCase();
  const envPassword = ADMIN_PASSWORD;
  if (!envEmail || !envPassword) return null;
  if (email.trim().toLowerCase() !== envEmail) return null;
  if (password !== envPassword) return null;
  const { count } = await supabaseAdmin
    .from("admin_users")
    .select("id", { count: "exact", head: true })
    .is("deleted_at", null);
  if ((count ?? 0) > 0) return null; // not the bootstrap moment anymore
  const { data, error } = await supabaseAdmin
    .from("admin_users")
    .insert({
      email: envEmail,
      password_hash: hashPassword(password),
      role: "owner",
      password_set_at: new Date().toISOString(),
    })
    .select("id, email, password_hash, name, role, password_set_at, last_login_at")
    .single();
  if (error) return null;
  return data as AdminUser;
}

/** Mark an admin's last login timestamp. */
export async function touchAdminLogin(adminUserId: string): Promise<void> {
  await supabaseAdmin
    .from("admin_users")
    .update({ last_login_at: new Date().toISOString() })
    .eq("id", adminUserId);
}

/** Update an admin's password. Used for the accept-invite flow + future
 *  "change my password" feature. */
export async function setAdminPassword(adminUserId: string, plain: string): Promise<void> {
  await supabaseAdmin
    .from("admin_users")
    .update({
      password_hash: hashPassword(plain),
      password_set_at: new Date().toISOString(),
    })
    .eq("id", adminUserId);
}
