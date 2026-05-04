// /admin/login: password entry. On success, fires a 6-digit 2FA code to
// ADMIN_EMAIL and forwards to /admin/verify.
//
// Dev convenience: setting ADMIN_SKIP_2FA=true in .env skips the 2FA
// step entirely and goes straight to creating a session - lets Blake
// iterate on admin pages without burning email codes. The bypass is
// gated on `import.meta.env.DEV`, which Vite hardcodes to false in
// production builds. So even if the env var leaks into a production
// environment, the bypass branch can't run.

import { fail, redirect } from "@sveltejs/kit";
import type { Actions, PageServerLoad } from "./$types";
import { ADMIN_EMAIL } from "$env/static/private";
import { env as privateEnv } from "$env/dynamic/private";
import { supabaseAdmin } from "$lib/server/supabase";
import { sendEmail } from "$lib/server/email";
import {
  checkLoginRateLimit,
  checkPassword,
  findValidTrustedDevice,
  generateSessionToken,
  generateTwoFaCode,
  hashSecret,
  logLoginAttempt,
  SESSION_COOKIE,
  SESSION_TTL_MS,
  TRUSTED_DEVICE_COOKIE,
  TWOFA_TTL_MS,
} from "$lib/server/admin-auth";

export const load: PageServerLoad = async ({ locals }) => {
  if (locals.admin) throw redirect(303, "/admin");
  return {};
};

export const actions: Actions = {
  default: async ({ request, getClientAddress, cookies }) => {
    const ip = getClientAddress();
    const rate = await checkLoginRateLimit(ip);
    if (!rate.ok) {
      return fail(429, {
        error:
          "Too many failed attempts from this address. Try again in about 15 minutes.",
      });
    }

    const data = await request.formData();
    const password = (data.get("password") as string) ?? "";

    if (!password) {
      await logLoginAttempt(ip, false, "no_password");
      return fail(400, { error: "Enter the admin password." });
    }

    if (!checkPassword(password)) {
      await logLoginAttempt(ip, false, "bad_password");
      return fail(401, { error: "That password isn't right." });
    }

    // Dev convenience: skip 2FA when running `pnpm dev` AND the env
    // flag is opted in. Hard-gated on import.meta.env.DEV, which Vite
    // hardcodes to false in production builds, so this branch can't
    // ever run on staging / prod even if the env var leaks.
    if (import.meta.env.DEV && privateEnv.ADMIN_SKIP_2FA === "true") {
      const sessionToken = generateSessionToken();
      const sessionHash = hashSecret(sessionToken);
      const expires = new Date(Date.now() + SESSION_TTL_MS);
      await supabaseAdmin.from("admin_sessions").insert({
        token_hash: sessionHash,
        email: ADMIN_EMAIL.toLowerCase(),
        expires_at: expires.toISOString(),
        ip_address: ip,
        user_agent: request.headers.get("user-agent") ?? null,
      });
      cookies.set(SESSION_COOKIE, sessionToken, {
        path: "/",
        httpOnly: true,
        sameSite: "lax",
        secure: false,
        expires,
      });
      await logLoginAttempt(ip, true, "password_ok_2fa_bypassed_DEV");
      throw redirect(303, "/admin");
    }

    // Trusted-device bypass: if the browser has a valid
    // ssta_admin_trusted_device cookie, skip the 2FA round-trip and cut
    // a session straight away. Password was just validated above; the
    // cookie just substitutes for "we already proved this device once."
    const trustedToken = cookies.get(TRUSTED_DEVICE_COOKIE);
    if (trustedToken) {
      const trusted = await findValidTrustedDevice(
        trustedToken,
        ADMIN_EMAIL,
      );
      if (trusted) {
        const sessionToken = generateSessionToken();
        const sessionHash = hashSecret(sessionToken);
        const expires = new Date(Date.now() + SESSION_TTL_MS);
        await supabaseAdmin.from("admin_sessions").insert({
          token_hash: sessionHash,
          email: ADMIN_EMAIL.toLowerCase(),
          expires_at: expires.toISOString(),
          ip_address: ip,
          user_agent: request.headers.get("user-agent") ?? null,
        });
        cookies.set(SESSION_COOKIE, sessionToken, {
          path: "/",
          httpOnly: true,
          sameSite: "lax",
          secure: !import.meta.env.DEV,
          expires,
        });
        await logLoginAttempt(ip, true, "password_ok_trusted_device");
        throw redirect(303, "/admin");
      }
      // Cookie present but invalid (expired / revoked). Fall through to
      // the normal 2FA flow; we deliberately don't clear the bad cookie
      // here - the verify page can re-set or replace it.
    }

    // Password is valid - issue a 2FA code and stash a short-lived cookie
    // so the verify page knows which login attempt it belongs to.
    const code = generateTwoFaCode();
    const codeHash = hashSecret(code);
    const expires = new Date(Date.now() + TWOFA_TTL_MS).toISOString();

    await supabaseAdmin.from("magic_link_tokens").insert({
      token_hash: codeHash,
      email: ADMIN_EMAIL.toLowerCase(),
      purpose: "admin_2fa",
      expires_at: expires,
    });

    const sendResult = await sendEmail({
      to: ADMIN_EMAIL,
      templateSlug: "admin_2fa",
      vars: { code },
    });
    if (!sendResult.ok) {
      console.error(
        `admin 2fa send failed (${sendResult.reason}); code generated and logged via Resend pipeline anyway`,
      );
    }

    await logLoginAttempt(ip, true, "password_ok_2fa_sent");
    cookies.set("ssta_admin_pending", "1", {
      path: "/admin",
      httpOnly: true,
      sameSite: "strict",
      secure: !import.meta.env.DEV,
      maxAge: 600, // 10 min, matches 2FA TTL
    });
    cookies.delete(SESSION_COOKIE, { path: "/" });

    throw redirect(303, "/admin/verify");
  },
};
