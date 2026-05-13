// Shared Cache-Control header builders for public SSR pages.
// Goal: reduce Netlify function invocations by letting the edge CDN
// serve cached responses for content that doesn't change per-request.
//
// Profiles:
//   - SHORT (60s edge): high-churn lists like /directory, /callboard,
//     /calendar where new content lands often
//   - MEDIUM (5 min edge): individual profiles, /theatres, /blog list
//   - LONG (30 min edge): static-y pages like /about, /privacy, /terms,
//     /support-us where edits are rare
//
// All profiles use stale-while-revalidate so a stale cached response
// keeps serving while the next request regenerates in the background,
// keeping perceived latency low.
//
// Browser cache (max-age) is kept very short so any update from admin
// shows quickly when the user refreshes. Edge cache (s-maxage) is the
// big lever for cutting function invocations.

export const CACHE_SHORT =
  "public, max-age=30, s-maxage=60, stale-while-revalidate=120";
export const CACHE_MEDIUM =
  "public, max-age=60, s-maxage=300, stale-while-revalidate=300";
export const CACHE_LONG =
  "public, max-age=120, s-maxage=1800, stale-while-revalidate=3600";
