// /admin/verify: enter the 6-digit 2FA code, get a session cookie.

import { fail, redirect } from "@sveltejs/kit";
import type { Actions, PageServerLoad } from "./$types";
import { ADMIN_EMAIL } from "$env/static/private";
import { supabaseAdmin } from "$lib/server/supabase";
import {
  generateSessionToken,
  hashSecret,
  SESSION_COOKIE,
  SESSION_TTL_MS,
} from "$lib/server/admin-auth";

export const load: PageServerLoad = async ({ cookies, locals }) => {
  if (locals.admin) throw redirect(303, "/admin");
  if (cookies.get("ssta_admin_pending") !== "1") {
    throw redirect(303, "/admin/login");
  }
  return {};
};

export const actions: Actions = {
  default: async ({ request, getClientAddress, cookies }) => {
    if (cookies.get("ssta_admin_pending") !== "1") {
      throw redirect(303, "/admin/login");
    }

    const data = await request.formData();
    const code = ((data.get("code") as string) ?? "").trim().replace(/\s+/g, "");
    if (!/^\d{6}$/.test(code)) {
      return fail(400, { error: "Enter the 6-digit code from your email." });
    }

    const codeHash = hashSecret(code);
    const { data: token, error } = await supabaseAdmin
      .from("magic_link_tokens")
      .select("id, expires_at, used_at, email")
      .eq("token_hash", codeHash)
      .eq("purpose", "admin_2fa")
      .eq("email", ADMIN_EMAIL.toLowerCase())
      .maybeSingle();

    if (error) {
      console.error("admin 2fa lookup failed", error);
      return fail(500, { error: "Something went wrong. Try again." });
    }

    if (!token) {
      return fail(401, { error: "That code isn't valid." });
    }
    if (token.used_at) {
      return fail(401, { error: "That code has already been used." });
    }
    if (new Date(token.expires_at) < new Date()) {
      return fail(401, { error: "That code has expired. Sign in again." });
    }

    // Burn the token + cut a session.
    await supabaseAdmin
      .from("magic_link_tokens")
      .update({ used_at: new Date().toISOString() })
      .eq("id", token.id);

    const sessionToken = generateSessionToken();
    const sessionHash = hashSecret(sessionToken);
    const expires = new Date(Date.now() + SESSION_TTL_MS);

    await supabaseAdmin.from("admin_sessions").insert({
      token_hash: sessionHash,
      email: token.email,
      expires_at: expires.toISOString(),
      ip_address: getClientAddress(),
      user_agent: request.headers.get("user-agent") ?? null,
    });

    cookies.set(SESSION_COOKIE, sessionToken, {
      path: "/",
      httpOnly: true,
      sameSite: "lax",
      secure: !import.meta.env.DEV,
      expires,
    });
    cookies.delete("ssta_admin_pending", { path: "/admin" });

    throw redirect(303, "/admin");
  },
};
