// /admin/accept-invite/[token]: invitee sets a password, the admin row
// is activated, the token is burned, redirect to /admin/login.

import { error, fail, redirect } from "@sveltejs/kit";
import type { Actions, PageServerLoad } from "./$types";
import { supabaseAdmin } from "$lib/server/supabase";
import { hashToken } from "$lib/server/tokens";
import { setAdminPassword } from "$lib/server/admin-auth";

async function loadInviteToken(rawToken: string) {
  if (!rawToken) return null;
  const tokenHash = hashToken(rawToken);
  const { data } = await supabaseAdmin
    .from("magic_link_tokens")
    .select("id, email, target_id, expires_at, used_at")
    .eq("token_hash", tokenHash)
    .eq("purpose", "admin_invite")
    .maybeSingle();
  if (!data) return null;
  if (data.used_at) return null;
  if (new Date(data.expires_at) < new Date()) return null;
  if (!data.target_id) return null;
  return data;
}

export const load: PageServerLoad = async ({ params }) => {
  const t = await loadInviteToken(params.token);
  if (!t) error(404, "Invite is invalid or expired.");
  const { data: admin } = await supabaseAdmin
    .from("admin_users")
    .select("id, email, name, password_set_at")
    .eq("id", t.target_id)
    .is("deleted_at", null)
    .maybeSingle();
  if (!admin) error(404, "Admin row not found.");
  return { admin };
};

export const actions: Actions = {
  default: async ({ params, request }) => {
    const t = await loadInviteToken(params.token);
    if (!t) return fail(401, { error: "Invite is invalid or expired." });
    const fd = await request.formData();
    const password = ((fd.get("password") as string) ?? "").trim();
    const confirm = ((fd.get("confirm") as string) ?? "").trim();
    if (password.length < 12) {
      return fail(400, { error: "Password must be at least 12 characters." });
    }
    if (password !== confirm) {
      return fail(400, { error: "Passwords don't match." });
    }
    await setAdminPassword(t.target_id!, password);
    await supabaseAdmin
      .from("magic_link_tokens")
      .update({ used_at: new Date().toISOString() })
      .eq("id", t.id);
    throw redirect(303, "/admin/login");
  },
};
