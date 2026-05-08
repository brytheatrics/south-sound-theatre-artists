// @ts-nocheck
// OvationTix (AudienceView) adapter.
//
// OvationTix exposes a server-rendered calendar listing at
//   https://web.ovationtix.com/trs/cal/{accountId}
// which contains every upcoming production's title + run-date range
// + venue in plain HTML. We hit that with a regular HTTP fetch (no
// headless browser) and let Claude extract the season-shape JSON.
//
// Per-show pages live at ci.ovationtix.com/{accountId}/production/{id}
// and ARE JS-only. When the calendar page leaves run-dates-only with
// no schedule pattern, we render the per-show page via Playwright to
// pull the actual showtime list.
//
// `source.source_url` for an ovationtix-adapter org should be:
//   https://web.ovationtix.com/trs/cal/{accountId}
//
// Confirmed orgs:
//   - Centerstage Theatre (account 36978)
//
// To migrate an org: set source_url to the trs/cal URL with their
// account ID and flip `adapter` to 'ovationtix'.

import {
  callClaude,
  costFor,
  fetchHtml,
  cleanHtml,
  hashContent,
  buildSeasonPrompt,
  buildDetailPrompt,
  parseJson,
  absoluteUrl,
  DETAIL_FETCH_DELAY_MS,
} from "../calendar-sync.mjs";
import { fetchHtmlRendered } from "../playwright-fetch.mjs";

// The trs/cal page references productions by their ID inside ci.
// links. Build the per-show URL we'll later render via Playwright.
function productionDetailUrl(accountId, productionId) {
  return `https://ci.ovationtix.com/${accountId}/production/${productionId}`;
}

function accountIdFromCalUrl(calUrl) {
  // /trs/cal/{accountId} - last path segment
  const m = calUrl.match(/\/trs\/cal\/(\d+)/);
  return m ? m[1] : null;
}

export async function extractOvationTix(source, opts, today) {
  let cost = 0;

  const html = await fetchHtml(source.source_url);
  const cleaned = cleanHtml(html);
  const newHash = hashContent(cleaned);

  if (!opts.force && source.last_hash && source.last_hash === newHash) {
    return { shows: [], hash: newHash, cost: 0 };
  }

  // Season-page extraction. The trs/cal page text is small (~1500 chars)
  // so the prompt is very cheap.
  const seasonResult = await callClaude(buildSeasonPrompt(cleaned, today));
  cost += costFor(seasonResult.usage);

  let rawShows;
  try {
    rawShows = parseJson(seasonResult.text, true);
    if (!Array.isArray(rawShows)) throw new Error("season response was not an array");
  } catch (err) {
    throw new Error(`parse-season: ${err.message}`);
  }

  // The trs/cal page references each show via a /production/{id} link.
  // Claude doesn't always pull the link verbatim, so we fall back to
  // mining the raw HTML for productionId + matching by title.
  const accountId = accountIdFromCalUrl(source.source_url);
  const productionLinks = [
    ...html.matchAll(/href="[^"]*\/production\/(\d+)[^"]*"[^>]*>\s*([^<]{2,80})\s*</g),
  ]
    .map((m) => ({ id: m[1], titleHint: m[2].trim() }))
    .filter((x) => !/buy now|tickets/i.test(x.titleHint));

  for (const show of rawShows) {
    if (show.detail_url) {
      show.detail_url = absoluteUrl(show.detail_url, source.source_url);
      continue;
    }
    if (!accountId) continue;
    // Match by exact title or close substring against the production
    // anchors in the raw HTML. Falls back to the first un-claimed link
    // in document order if no title match is found.
    const titleNorm = String(show.title ?? "").toLowerCase().trim();
    const found = productionLinks.find(
      (p) =>
        p.titleHint.toLowerCase() === titleNorm ||
        p.titleHint.toLowerCase().includes(titleNorm) ||
        titleNorm.includes(p.titleHint.toLowerCase()),
    );
    if (found) {
      show.detail_url = productionDetailUrl(accountId, found.id);
    }
  }

  // Per-show schedule lookup. The trs/cal page only gives run-date
  // ranges (no weekday/time pattern). For shows missing schedule, render
  // the ci.ovationtix.com/{account}/production/{id} page via Playwright
  // and ask Claude to lift the schedule.
  //
  // The ci.ovationtix.com production page is JS + Cloudflare-protected
  // and frequently times out. When a render fails OR Claude returns
  // nothing usable, we fall back to a community-theatre-standard
  // schedule (Fri 7:30pm, Sat 7:30pm, Sun 2:00pm). This is wrong some
  // of the time (Wednesday matinees, Thursday previews) but gets the
  // calendar populated; admin can correct individual shows from the
  // /admin/calendar editor when the cron's guess is off.
  for (let i = 0; i < rawShows.length; i++) {
    const show = rawShows[i];
    const haveSchedule = Array.isArray(show.schedule) && show.schedule.length > 0;
    const haveExplicit =
      Array.isArray(show.explicit_performances) && show.explicit_performances.length > 0;
    if (haveSchedule || haveExplicit) continue;
    if (!show.detail_url) {
      applyDefaultSchedule(show);
      continue;
    }

    if (i > 0) await new Promise((r) => setTimeout(r, DETAIL_FETCH_DELAY_MS));

    let detailHtml;
    try {
      detailHtml = await fetchHtmlRendered(show.detail_url, {
        timeoutMs: 30_000,
        // Use "load" instead of "networkidle" - the JS pages keep firing
        // tracking beacons that prevent networkidle from resolving.
        waitForNetworkIdle: false,
      });
    } catch {
      applyDefaultSchedule(show);
      continue;
    }
    const detailClean = cleanHtml(detailHtml);
    if (detailClean.length < 500) {
      applyDefaultSchedule(show);
      continue;
    }

    let detailResult;
    try {
      detailResult = await callClaude(buildDetailPrompt(detailClean, show.title, today));
      cost += costFor(detailResult.usage);
    } catch {
      applyDefaultSchedule(show);
      continue;
    }

    let detailData;
    try {
      detailData = parseJson(detailResult.text, false);
    } catch {
      applyDefaultSchedule(show);
      continue;
    }
    if (detailData.run_start) show.run_start = detailData.run_start;
    if (detailData.run_end) show.run_end = detailData.run_end;
    if (Array.isArray(detailData.schedule)) show.schedule = detailData.schedule;
    if (Array.isArray(detailData.special)) show.special = detailData.special;
    if (Array.isArray(detailData.explicit_performances))
      show.explicit_performances = detailData.explicit_performances;

    // If Claude saw the page but couldn't pull anything schedule-shaped,
    // still seed the default so the show isn't dropped.
    const stillEmpty =
      (!Array.isArray(show.schedule) || show.schedule.length === 0) &&
      (!Array.isArray(show.explicit_performances) ||
        show.explicit_performances.length === 0);
    if (stillEmpty) applyDefaultSchedule(show);
  }

  return { shows: rawShows, hash: newHash, cost };
}

// Community-theatre default schedule. Fri/Sat 7:30pm, Sun 2pm. Used
// only as a last-resort fallback when per-show detail rendering fails;
// admin can override the resulting performances row by row from
// /admin/calendar/[id]/edit.
function applyDefaultSchedule(show) {
  show.schedule = [
    { weekdays: ["Fri", "Sat"], time: "19:30" },
    { weekdays: ["Sun"], time: "14:00" },
  ];
}
