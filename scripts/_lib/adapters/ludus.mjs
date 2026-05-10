// @ts-nocheck
// Ludus (formerly OnTheStage) adapter.
//
// Ludus subdomains ({org}.ludus.com) are Cloudflare-protected with a
// JS challenge - direct HTTP fetches return a 403 "Just a moment...
// Enable JavaScript and cookies" interstitial. We render with Playwright
// (which solves the challenge automatically by running the JS) and
// feed the resulting HTML to Claude via the season prompt.
//
// `source.source_url` for a ludus-adapter org should be the org's Ludus
// root URL, e.g.:
//   https://tlt.ludus.com/
//   https://manestagetickets.ludus.com/
//
// Confirmed orgs:
//   - Tacoma Little Theatre (tlt.ludus.com)
//   - ManeStage Theatre (manestagetickets.ludus.com)
//
// Per-show pages on Ludus follow the pattern {org}.ludus.com/{numericId}.
// The root index lists the upcoming shows; detail pages have the
// per-performance schedule.

import {
  callClaude,
  costFor,
  cleanHtml,
  hashContent,
  buildSeasonPrompt,
  buildDetailPrompt,
  parseJson,
  absoluteUrl,
  DETAIL_FETCH_DELAY_MS,
} from "../calendar-sync.mjs";
import { fetchHtmlRendered } from "../playwright-fetch.mjs";

export async function extractLudus(source, opts, today) {
  let cost = 0;

  // Ludus shows are listed on the index page once Cloudflare's JS
  // challenge clears. Wait for some plausible content marker rather
  // than a specific selector since Ludus theming varies per org.
  const html = await fetchHtmlRendered(source.source_url, {
    timeoutMs: 45_000,
    // No specific selector - networkidle wait + the cleared challenge
    // is enough. Some orgs don't have many anchor hrefs to wait on.
  });
  const cleaned = cleanHtml(html);

  // Sanity check: if the page still looks like the Cloudflare
  // interstitial, treat that as a transient failure rather than letting
  // Claude waste tokens on noise.
  if (
    /Just a moment/i.test(cleaned) ||
    /Enable JavaScript and cookies/i.test(cleaned) ||
    cleaned.length < 500
  ) {
    throw new Error("ludus: Cloudflare challenge not cleared (rendered page too small)");
  }

  const newHash = hashContent(cleaned);

  if (!opts.force && source.last_hash && source.last_hash === newHash) {
    return { shows: [], hash: newHash, cost: 0 };
  }

  const seasonResult = await callClaude(buildSeasonPrompt(cleaned, today));
  cost += costFor(seasonResult.usage);

  let rawShows;
  try {
    rawShows = parseJson(seasonResult.text, true);
    if (!Array.isArray(rawShows)) throw new Error("season response was not an array");
  } catch (err) {
    throw new Error(`parse-season: ${err.message}`);
  }

  for (const show of rawShows) {
    show.detail_url = absoluteUrl(show.detail_url, source.source_url);
  }

  for (let i = 0; i < rawShows.length; i++) {
    const show = rawShows[i];
    const haveSchedule = Array.isArray(show.schedule) && show.schedule.length > 0;
    const haveExplicit =
      Array.isArray(show.explicit_performances) && show.explicit_performances.length > 0;
    if (haveSchedule || haveExplicit) continue;
    if (!show.detail_url) continue;

    if (i > 0) await new Promise((r) => setTimeout(r, DETAIL_FETCH_DELAY_MS));

    let detailHtml;
    try {
      detailHtml = await fetchHtmlRendered(show.detail_url, { timeoutMs: 45_000 });
    } catch {
      continue;
    }
    const detailClean = cleanHtml(detailHtml);
    if (
      /Just a moment/i.test(detailClean) ||
      detailClean.length < 500
    ) {
      continue;
    }

    let detailResult;
    try {
      detailResult = await callClaude(buildDetailPrompt(detailClean, show.title, today));
      cost += costFor(detailResult.usage);
    } catch {
      continue;
    }

    let detailData;
    try {
      detailData = parseJson(detailResult.text, false);
    } catch {
      continue;
    }
    if (detailData.run_start) show.run_start = detailData.run_start;
    if (detailData.run_end) show.run_end = detailData.run_end;
    if (Array.isArray(detailData.schedule)) show.schedule = detailData.schedule;
    if (Array.isArray(detailData.special)) show.special = detailData.special;
    if (Array.isArray(detailData.explicit_performances))
      show.explicit_performances = detailData.explicit_performances;
  }

  return { shows: rawShows, hash: newHash, cost };
}
