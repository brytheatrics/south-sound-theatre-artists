// @ts-nocheck
// Eventbrite organizer adapter.
//
// Eventbrite's `/o/{organizerId}` page is the public-facing listing of
// upcoming events for a single organizer. Like OvationTix, the page is
// JS-rendered and the upcoming-events list isn't in the initial HTML.
// We render with Playwright then extract via Claude's season prompt.
//
// `source.source_url` for an eventbrite-adapter org should be the
// public organizer page, e.g.:
//   https://www.eventbrite.com/o/41082285963        (Dukesbay)
//
// Confirmed orgs:
//   - Dukesbay Productions (organizer 41082285963)

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

export async function extractEventbrite(source, opts, today) {
  let cost = 0;

  // Wait for an upcoming-event card to render. Eventbrite uses a few
  // class patterns for organizer event tiles - the most stable signal
  // is an anchor whose href starts with /e/ (the event URL pattern).
  const html = await fetchHtmlRendered(source.source_url, {
    waitForSelector: "a[href*='/e/']",
    timeoutMs: 45_000,
  });
  const cleaned = cleanHtml(html);
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

  // Eventbrite per-event pages have the schedule as JSON-LD. We could
  // skip Claude here and parse the schema.org Event blob directly -
  // but for now use the same Claude detail-prompt path so the adapter
  // is consistent with the others. Future optimization.
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
