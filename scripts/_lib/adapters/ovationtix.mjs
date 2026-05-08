// @ts-nocheck
// OvationTix (AudienceView) adapter.
//
// OvationTix sites are JS-rendered single-page apps under
// ci.ovationtix.com/{accountId}. Direct HTTP fetches return a thin
// shell with no event data. We render with Playwright, then feed the
// rendered text to Claude with the season prompt.
//
// `source.source_url` for an ovationtix-adapter org should be the
// public events list URL: usually
//   https://ci.ovationtix.com/{accountId}
// or
//   https://ci.ovationtix.com/{accountId}/store/events
//
// Confirmed orgs:
//   - Centerstage Theatre (account 36978)
//
// Other South Sound orgs that use OvationTix can be migrated to this
// adapter by setting source_url to their ci.ovationtix.com page and
// flipping `adapter` to 'ovationtix'.

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

export async function extractOvationTix(source, opts, today) {
  let cost = 0;

  // Wait for the events grid to populate. OvationTix uses a few class
  // names ("event-card", "production-tile") - we try a generic anchor
  // pattern that's been stable: any link to /production/{id}.
  const html = await fetchHtmlRendered(source.source_url, {
    waitForSelector: "a[href*='/production/']",
    timeoutMs: 45_000,
  });
  const cleaned = cleanHtml(html);
  const newHash = hashContent(cleaned);

  if (!opts.force && source.last_hash && source.last_hash === newHash) {
    return { shows: [], hash: newHash, cost: 0 };
  }

  // Season-page extraction (Claude reads the rendered HTML the same
  // way it reads any other site)
  const seasonResult = await callClaude(buildSeasonPrompt(cleaned, today));
  cost += costFor(seasonResult.usage);

  let rawShows;
  try {
    rawShows = parseJson(seasonResult.text, true);
    if (!Array.isArray(rawShows)) throw new Error("season response was not an array");
  } catch (err) {
    throw new Error(`parse-season: ${err.message}`);
  }

  // Resolve detail URLs to absolute against the rendered page's origin
  for (const show of rawShows) {
    show.detail_url = absoluteUrl(show.detail_url, source.source_url);
  }

  // Detail-page render for shows missing a schedule. Each per-show page
  // on ci.ovationtix.com lists actual showtimes once rendered.
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
