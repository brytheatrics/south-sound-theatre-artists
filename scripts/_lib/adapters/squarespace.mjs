// @ts-nocheck
// Squarespace events-collection adapter.
//
// Squarespace's `?format=json` query on any events page returns the
// underlying collection JSON, including an `items[]` array with one
// object per event. This is the *enumeration* path - we get titles,
// URLs, and rendered HTML body for free, with no AI call needed to
// figure out what events exist.
//
// Squarespace doesn't expose performance dates as structured fields on
// the events collection (they're embedded in body HTML). So per item
// we still ask Claude to extract the run dates + schedule from the
// item's body text. This is *cheaper* than the ai-generic path because
// each prompt is small (one event's body) instead of an entire season
// page that may have 60+ entries to enumerate.
//
// Confirmed orgs:
//   - Bainbridge Performing Arts (BPA)
//
// Squarespace pages that aren't events collections won't have an
// items[] - those should stay on ai-generic.

import {
  callClaude,
  costFor,
  hashContent,
  buildDetailPrompt,
  parseJson,
} from "../calendar-sync.mjs";

const ITEMS_PER_PAGE = 20;
const MAX_PAGES = 10; // hard cap so a misconfigured site can't loop forever
// Squarespace per-item prompts are tiny (one event's body, ~500-1000
// input tokens). 20 of them fits well under Anthropic's Tier-1 50K/min
// input-token limit even without delays. Keep a small pause anyway so
// transient API blips don't burn through retries instantly.
const PER_ITEM_DELAY_MS = 3_000;

const UA =
  "Mozilla/5.0 (compatible; SSTACalendarBot/1.0; +https://southsoundtheatreartists.org)";

async function fetchJson(url) {
  const res = await fetch(url, {
    headers: {
      "User-Agent": UA,
      Accept: "application/json",
    },
    redirect: "follow",
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}`);
  return await res.json();
}

// Pull every page of the events collection. Squarespace paginates with
// `?offset=...` style cursors in pagination.nextPageUrl.
async function fetchAllItems(baseUrl) {
  const url = new URL(baseUrl);
  // Force JSON response. baseUrl might already have ?format=json or not.
  url.searchParams.set("format", "json");
  let collected = [];
  let cursorUrl = url.toString();
  for (let page = 0; page < MAX_PAGES; page++) {
    const data = await fetchJson(cursorUrl);
    if (!Array.isArray(data.items)) break;
    collected = collected.concat(data.items);
    if (!data.pagination?.nextPage || !data.pagination?.nextPageOffset) break;
    const next = new URL(baseUrl);
    next.searchParams.set("format", "json");
    next.searchParams.set("offset", String(data.pagination.nextPageOffset));
    cursorUrl = next.toString();
  }
  return collected;
}

// Each Squarespace event item carries:
//   id, title, fullUrl (relative path under the site origin),
//   body (rendered HTML), excerpt (rendered HTML),
//   addedOn / updatedOn / publishOn (CMS metadata, NOT show dates).
// We feed body+excerpt text to Claude with the existing detail prompt
// to lift run_start/run_end/schedule.
function bodyText(item) {
  const html =
    (item.excerpt || "") + "\n" + (item.body || "");
  return html
    .replace(/<script[\s\S]+?<\/script>/g, "")
    .replace(/<style[\s\S]+?<\/style>/g, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#x27;|&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

function originOf(sourceUrl) {
  return new URL(sourceUrl).origin;
}

export async function extractSquarespaceJson(source, opts, today) {
  const items = await fetchAllItems(source.source_url);
  if (items.length === 0) {
    return { shows: [], hash: hashContent("squarespace:empty"), cost: 0 };
  }

  // Cache fingerprint: sorted list of item IDs + their updatedOn. New
  // items appear, deleted items vanish, edits bump updatedOn - any of
  // those should bust the cache.
  const fingerprint = items
    .map((i) => `${i.id}:${i.updatedOn ?? i.addedOn ?? 0}`)
    .sort()
    .join("|");
  const hash = hashContent(fingerprint);

  if (!opts.force && source.last_hash && source.last_hash === hash) {
    return { shows: [], hash, cost: 0 };
  }

  const origin = originOf(source.source_url);
  let cost = 0;
  const shows = [];

  for (let i = 0; i < items.length; i++) {
    const it = items[i];
    if (i > 0) await new Promise((r) => setTimeout(r, PER_ITEM_DELAY_MS));

    const text = bodyText(it);
    if (!text || text.length < 30) continue; // empty body, skip

    let detail;
    try {
      const resp = await callClaude(buildDetailPrompt(text, it.title, today));
      cost += costFor(resp.usage);
      detail = parseJson(resp.text, false);
    } catch (err) {
      // One bad item shouldn't kill the run.
      console.error(`squarespace: detail parse failed for ${it.title}: ${err.message}`);
      continue;
    }

    if (!detail.run_start) continue; // no usable date, drop

    shows.push({
      title: it.title,
      run_start: detail.run_start,
      run_end: detail.run_end ?? detail.run_start,
      detail_url: it.fullUrl ? origin + it.fullUrl : null,
      schedule: Array.isArray(detail.schedule) ? detail.schedule : [],
      special: Array.isArray(detail.special) ? detail.special : [],
      explicit_performances: Array.isArray(detail.explicit_performances)
        ? detail.explicit_performances
        : [],
    });
  }

  return { shows, hash, cost };
}
