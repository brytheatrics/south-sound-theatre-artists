// Canonical organization category vocabulary (post mig 105). Drives
// the /theatres chip filter and the badge labels on each org card.
//
// New badges can be coined by adding a slug to `KNOWN_CATEGORY_SLUGS`
// + `CATEGORY_LABELS` and (optionally) backfilling whichever orgs
// belong there. Unknown slugs already in the DB still render with the
// raw slug as their label - the page won't blow up if Lexi adds one
// directly via SQL.

export const KNOWN_CATEGORY_SLUGS = [
  "theatre",
  "educational_theatre",
  "opera",
  "ballet",
  "symphony",
  "youth",
  "venue",
  "other",
] as const;

export const CATEGORY_LABELS: Record<string, string> = {
  theatre: "Theatre",
  educational_theatre: "Educational Theatre",
  opera: "Opera",
  ballet: "Ballet",
  symphony: "Symphony",
  youth: "Youth",
  venue: "Venue",
  other: "Other",
};

export function isKnownCategory(slug: string): boolean {
  return (KNOWN_CATEGORY_SLUGS as readonly string[]).includes(slug);
}
