// /admin/invitations: post-launch visibility on who got their invitation
// email, who clicked the magic link, and who's filled out their profile.
// Helps admin chase down stragglers and confirm engagement.

import type { PageServerLoad } from "./$types";
import { supabaseAdmin } from "$lib/server/supabase";

export const load: PageServerLoad = async () => {
  // All profiles that received an invitation. invited_at is stamped by
  // scripts/send-launch-invitations.mjs the moment the email is sent.
  const { data: profiles, error } = await supabaseAdmin
    .from("profiles")
    .select(
      `id, slug, full_name, email, invited_at, published, auto_hidden_incomplete,
       geographic_area, headshot_url, disciplines, bio, updated_at`,
    )
    .not("invited_at", "is", null)
    .is("deleted_at", null)
    .order("invited_at", { ascending: false });
  if (error) throw error;

  // Most recent used edit_profile token per profile. used_at is set when
  // the artist clicks the magic link and the editor loads.
  const targetIds = (profiles ?? []).map((p) => p.id);
  const { data: usedTokens } = await supabaseAdmin
    .from("magic_link_tokens")
    .select("target_id, used_at, created_at")
    .eq("purpose", "edit_profile")
    .not("used_at", "is", null)
    .in("target_id", targetIds.length ? targetIds : ["00000000-0000-0000-0000-000000000000"])
    .order("used_at", { ascending: false });
  const lastUsedByProfile = new Map<string, string>();
  for (const t of usedTokens ?? []) {
    if (!lastUsedByProfile.has(t.target_id)) {
      lastUsedByProfile.set(t.target_id, t.used_at);
    }
  }

  // Completeness check matches the publish-gate fields: area, headshot
  // (adults), at least one discipline, a bio. Same shape as
  // src/lib/server/profile-completeness.ts uses, kept inline to keep
  // this page server self-contained.
  function isComplete(p: { geographic_area: string | null; headshot_url: string | null; disciplines: string[] | null; bio: string | null }) {
    return !!p.geographic_area && !!p.headshot_url && (p.disciplines?.length ?? 0) > 0 && !!p.bio;
  }

  const rows = (profiles ?? []).map((p) => {
    const lastClick = lastUsedByProfile.get(p.id) ?? null;
    return {
      id: p.id,
      slug: p.slug,
      full_name: p.full_name,
      email: p.email,
      invited_at: p.invited_at as string,
      last_click: lastClick,
      clicked: !!lastClick,
      published: p.published,
      auto_hidden_incomplete: p.auto_hidden_incomplete,
      complete: isComplete(p),
      updated_at: p.updated_at,
    };
  });

  // Sort: clicked-but-incomplete first (need attention), then unclicked
  // (chase), then clicked-and-complete (done). Within each, most recent
  // activity first.
  rows.sort((a, b) => {
    const bucket = (r: typeof a) =>
      r.clicked && !r.complete ? 0 : !r.clicked ? 1 : 2;
    const ba = bucket(a);
    const bb = bucket(b);
    if (ba !== bb) return ba - bb;
    const ka = a.last_click ?? a.invited_at;
    const kb = b.last_click ?? b.invited_at;
    return kb.localeCompare(ka);
  });

  return {
    rows,
    summary: {
      total: rows.length,
      clicked: rows.filter((r) => r.clicked).length,
      complete: rows.filter((r) => r.complete).length,
      auto_hidden: rows.filter((r) => r.auto_hidden_incomplete).length,
    },
  };
};
