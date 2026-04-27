// /edit-link: artists request a fresh single-use edit link by email.
// We always return the same success message regardless of whether a
// profile exists, so the form doesn't leak which addresses are listed.

import { fail } from "@sveltejs/kit";
import type { Actions } from "./$types";
import { PUBLIC_SITE_URL } from "$env/static/public";
import { supabaseAdmin } from "$lib/server/supabase";
import { sendEmail } from "$lib/server/email";
import { generateToken, hashToken } from "$lib/server/tokens";

const EDIT_TTL_MS = 24 * 60 * 60 * 1000;

export const actions: Actions = {
  default: async ({ request }) => {
    const data = await request.formData();
    const email = ((data.get("email") as string) ?? "").trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return fail(400, { error: "Enter a valid email." });
    }

    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("id, full_name, email")
      .eq("email", email)
      .is("deleted_at", null)
      .maybeSingle();

    if (profile) {
      const token = generateToken();
      const tokenHash = hashToken(token);
      const expires = new Date(Date.now() + EDIT_TTL_MS).toISOString();
      await supabaseAdmin.from("magic_link_tokens").insert({
        token_hash: tokenHash,
        email,
        purpose: "edit_profile",
        target_id: profile.id,
        expires_at: expires,
      });
      const editUrl = `${PUBLIC_SITE_URL}/edit/${token}`;
      await sendEmail({
        to: email,
        templateSlug: "magic_link_resend",
        vars: { name: profile.full_name, edit_url: editUrl },
      });
    }

    return { sent: true };
  },
};
