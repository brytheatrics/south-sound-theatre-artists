// /sitemap.xml: lists public pages + every published profile so search
// engines can crawl the directory cleanly.

import { PUBLIC_SITE_URL } from "$env/static/public";
import { supabaseAdmin } from "$lib/server/supabase";

const STATIC_PATHS: Array<{ path: string; changefreq: string; priority: string }> = [
  { path: "/", changefreq: "daily", priority: "1.0" },
  { path: "/directory", changefreq: "daily", priority: "0.9" },
  { path: "/about", changefreq: "monthly", priority: "0.5" },
  { path: "/contact", changefreq: "monthly", priority: "0.4" },
  { path: "/support-us", changefreq: "monthly", priority: "0.4" },
  { path: "/submit", changefreq: "monthly", priority: "0.6" },
  { path: "/privacy", changefreq: "yearly", priority: "0.2" },
  { path: "/terms", changefreq: "yearly", priority: "0.2" },
];

export async function GET() {
  const { data } = await supabaseAdmin
    .from("profiles")
    .select("slug, updated_at")
    .eq("published", true)
    .is("deleted_at", null)
    .order("updated_at", { ascending: false })
    .limit(5000);

  const base = PUBLIC_SITE_URL.replace(/\/$/, "");
  const now = new Date().toISOString();

  const entries: string[] = [];
  for (const s of STATIC_PATHS) {
    entries.push(
      `<url><loc>${base}${s.path}</loc><lastmod>${now}</lastmod><changefreq>${s.changefreq}</changefreq><priority>${s.priority}</priority></url>`,
    );
  }
  for (const p of data ?? []) {
    const lastmod = new Date(p.updated_at ?? now).toISOString();
    entries.push(
      `<url><loc>${base}/artists/${p.slug}</loc><lastmod>${lastmod}</lastmod><changefreq>weekly</changefreq><priority>0.7</priority></url>`,
    );
  }

  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${entries.join("\n")}\n</urlset>`;

  return new Response(xml, {
    headers: {
      "content-type": "application/xml",
      "cache-control": "public, max-age=3600",
    },
  });
}
