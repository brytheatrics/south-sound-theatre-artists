// /admin/admins: invite + manage co-admins. Owner only (the bootstrap
// admin from ADMIN_EMAIL env var). Other admins see a "you're not an
// owner" message; they can change their own password elsewhere.

import { error, fail, redirect } from "@sveltejs/kit";
import type { Actions, PageServerLoad } from "./$types";
import { PUBLIC_SITE_URL } from "$env/static/public";
import { supabaseAdmin } from "$lib/server/supabase";
import { generateToken, hashToken } from "$lib/server/tokens";

const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

async function loadOwner(adminUserId: string | null) {
  if (!adminUserId) return null;
  const { data } = await supabaseAdmin
    .from("admin_users")
    .select("id, role")
    .eq("id", adminUserId)
    .maybeSingle();
  return data;
}

export const load: PageServerLoad = async ({ locals }) => {
  if (!locals.admin) error(401, "Admin only.");
  const me = await loadOwner(locals.admin?.admin_user_id ?? null);
  const isOwner = me?.role === "owner";

  const { data: admins } = await supabaseAdmin
    .from("admin_users")
    .select("id, email, name, role, password_set_at, last_login_at, invited_at, created_at")
    .is("deleted_at", null)
    .order("created_at");

  return {
    admins: admins ?? [],
    isOwner,
  };
};

export const actions: Actions = {
  invite: async ({ request, locals }) => {
    if (!locals.admin) error(401, "Admin only.");
    const me = await loadOwner(locals.admin?.admin_user_id ?? null);
    if (me?.role !== "owner") {
      return fail(403, { error: "Only the owner can invite admins." });
    }
    const fd = await request.formData();
    const email = ((fd.get("email") as string) ?? "").trim().toLowerCase();
    const name = ((fd.get("name") as string) ?? "").trim() || null;
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return fail(400, { error: "Enter a valid email." });
    }

    // Insert admin_users row (password null until invitee sets it). If
    // an active row already exists for this email, reuse it.
    const { data: existing } = await supabaseAdmin
      .from("admin_users")
      .select("id, password_set_at")
      .eq("email", email)
      .is("deleted_at", null)
      .maybeSingle();
    let adminUserId: string;
    if (existing) {
      adminUserId = existing.id;
    } else {
      const { data: created, error: insertErr } = await supabaseAdmin
        .from("admin_users")
        .insert({
          email,
          name,
          role: "admin",
          invited_by: me.id,
        })
        .select("id")
        .single();
      if (insertErr || !created) {
        return fail(500, { error: "Could not create admin row." });
      }
      adminUserId = created.id;
    }

    const token = generateToken();
    const tokenHash = hashToken(token);
    const expiresAt = new Date(Date.now() + INVITE_TTL_MS).toISOString();
    await supabaseAdmin.from("magic_link_tokens").insert({
      token_hash: tokenHash,
      email,
      purpose: "admin_invite",
      target_id: adminUserId,
      expires_at: expiresAt,
    });

    return {
      invite: {
        url: `${PUBLIC_SITE_URL}/admin/accept-invite/${token}`,
        email,
        expires_at: expiresAt,
      },
    };
  },

  remove: async ({ request, locals }) => {
    if (!locals.admin) error(401, "Admin only.");
    const me = await loadOwner(locals.admin?.admin_user_id ?? null);
    if (me?.role !== "owner") {
      return fail(403, { error: "Only the owner can remove admins." });
    }
    const fd = await request.formData();
    const id = String(fd.get("id") ?? "");
    if (!id) return fail(400, { error: "Missing id." });
    if (id === me.id) {
      return fail(400, { error: "You can't remove the owner account." });
    }
    await supabaseAdmin
      .from("admin_users")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", id);
    // Wipe sessions + trusted devices for that user.
    await supabaseAdmin.from("admin_sessions").delete().eq("admin_user_id", id);
    await supabaseAdmin.from("admin_trusted_devices").delete().eq("admin_user_id", id);
    return { removed: 1 };
  },
};
