// Slug helpers for /artists/[slug] URLs.
//
// Slugs are picked by the artist (auto-suggested from their name, but
// editable). On collision, BUILD_PLAN architecture commitment #8 says we
// surface a popup with alternatives - never auto-suffix.

const RESERVED = new Set([
  "about",
  "admin",
  "api",
  "app",
  "artists",
  "auth",
  "callboard",
  "contact",
  "dashboard",
  "dev",
  "edit",
  "feed",
  "help",
  "home",
  "index",
  "login",
  "logout",
  "new",
  "privacy",
  "public",
  "robots.txt",
  "search",
  "signin",
  "signout",
  "signup",
  "sitemap.xml",
  "submit",
  "support",
  "support-us",
  "terms",
]);

export function slugify(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "") // strip diacritics
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/[\s_]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export type SlugValidation = { ok: true } | { ok: false; reason: string };

export function validateSlug(slug: string): SlugValidation {
  if (!slug) return { ok: false, reason: "Pick a URL." };
  if (slug.length < 3) return { ok: false, reason: "URL must be at least 3 characters." };
  if (slug.length > 60) return { ok: false, reason: "URL must be 60 characters or fewer." };
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
    return {
      ok: false,
      reason: "URL can only contain lowercase letters, numbers, and hyphens.",
    };
  }
  if (RESERVED.has(slug)) {
    return { ok: false, reason: "That URL is reserved. Try another." };
  }
  return { ok: true };
}

export function suggestAlternatives(name: string): string[] {
  const root = slugify(name);
  if (!root) return [];
  return [
    `${root}-1`,
    `${root}-2`,
    `${root}-${new Date().getFullYear()}`,
    `${root}-actor`,
  ];
}
