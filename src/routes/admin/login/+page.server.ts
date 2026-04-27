// /admin/login: password entry. On success, fires a 6-digit 2FA code to
// ADMIN_EMAIL and forwards to /admin/verify.

import { fail, redirect } from "@sveltejs/kit";
import type { Actions, PageServerLoad } from "./$types";
import { ADMIN_EMAIL } from "$env/static/private";
import { supabaseAdmin } from "$lib/server/supabase";
import { sendEmail } from "$lib/server/email";
import {
  checkLoginRateLimit,
  checkPassword,
  generateTwoFaCode,
  hashSecret,
  logLoginAttempt,
  SESSION_COOKIE,
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
