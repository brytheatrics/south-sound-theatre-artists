// Manage publish state for profiles that are missing required info
// (geographic_area, disciplines, or headshot-without-consent).
//
// Usage:
//   node scripts/gate-incomplete-profiles.mjs           # unpublish incomplete (pre-launch / before invites)
//   node scripts/gate-incomplete-profiles.mjs --unhide  # re-publish them all (dev / staging review)
//
// The "unpublish" mode is the launch-time default: we want bulk-imported
// profiles missing required info to be hidden so /edit/[token]'s
// complete-to-publish banner kicks in when the artist clicks their
// invitation link. Saving with everything filled in auto-publishes.
//
// The "--unhide" mode is for development - Blake wants to see all the
// imported profiles in the directory while iterating on the site. Run
// this whenever incomplete profiles disappear and you want them back
// for visual testing. Re-run the default before sending invitations.
//
// Both modes also fix Chris Serface's headshot_consent flag if it was
// missed during admin upload (legacy gap).

import "dotenv/config";
import { createClient } from "@supabase/supabase-js";

const unhide = process.argv.includes("--unhide");
const supa = createClient(
  process.env.PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
);

// Backfill: Chris's missing consent flag.
{
  const { data: chris } = await supa
    .from("profiles")
    .select("id, slug, headshot_url, headshot_consent")
    .eq("slug", "chris-serface")
    .maybeSingle();
  if (chris && chris.headshot_url && !chris.headshot_consent) {
    await supa
      .from("profiles")
      .update({ headshot_consent: true })
      .eq("id", chris.id);
    console.log(`Set headshot_consent=true for ${chris.slug}`);
  }
}

const { data, error } = await supa
  .from("profiles")
  .select(
    "id, slug, full_name, geographic_area, disciplines, headshot_url, headshot_consent, published",
  )
  .is("deleted_at", null);
if (error) throw error;

const incomplete = data.filter((p) => {
  const isComplete =
    !!p.full_name &&
    !!p.geographic_area &&
    (p.disciplines ?? []).length > 0 &&
    (!p.headshot_url || p.headshot_consent);
  return !isComplete;
});

console.log(`\n${data.length} profiles total · ${incomplete.length} incomplete`);

if (unhide) {
  const toShow = incomplete.filter((p) => !p.published);
  console.log(`Re-publishing ${toShow.length} hidden incomplete profiles:\n`);
  for (const p of toShow) {
    await supa.from("profiles").update({ published: true }).eq("id", p.id);
    console.log(`  + ${p.full_name} (${p.slug})`);
  }
} else {
  const toHide = incomplete.filter((p) => p.published);
  console.log(`Unpublishing ${toHide.length} visible incomplete profiles:\n`);
  for (const p of toHide) {
    await supa.from("profiles").update({ published: false }).eq("id", p.id);
    console.log(`  - ${p.full_name} (${p.slug})`);
  }
}
console.log("\nDone.");
