// @ts-nocheck
// scripts/_lib/calendar-sync.mjs
//
// Types for this module are declared in calendar-sync.d.ts (sibling
// file). The @ts-nocheck above tells svelte-check not to type-check the
// implementation strictly - this is a Node-side script, not a TS module.
//
// Shared library for the v2.x auto-populated calendar feature. The cron
// (scripts/calendar-sync.mjs) and any future ad-hoc tools (e.g. an admin
// "refresh now" button calling into this from the app server) both go
// through syncEventSource() so the upsert logic lives in one place.
//
// Pipeline per organizations row, dispatched by `adapter`:
//   1. extract(source) - adapter-specific. Returns { shows, hash, cost }.
//      Each adapter handles its own fetching strategy (plain HTTP, JSON
//      API, headless browser) and produces a normalized shows[] array.
//   2. Cache short-circuit: hash matches last_hash + not forced => unchanged.
//   3. Code-side expand schedule x run_range -> per-performance list.
//   4. Upsert into productions + performances tables (replace
//      performances atomically per show).
//   5. Write organizations cache + status fields back.
//
// Adapters live in scripts/_lib/adapters/ and each export an
// `extract(source, opts)` function. The dispatch table is at the
// bottom of this file.

import { createHash } from "node:crypto";
import { extractSquarespaceJson } from "./adapters/squarespace.mjs";
import { extractOvationTix } from "./adapters/ovationtix.mjs";
import { extractLudus } from "./adapters/ludus.mjs";
import { extractEventbrite } from "./adapters/eventbrite.mjs";

const MODEL = "claude-haiku-4-5";
const ANTHROPIC_VERSION = "2023-06-01";
const HAIKU_INPUT_PER_M = 1.0;
const HAIKU_OUTPUT_PER_M = 5.0;
const MAX_HTML_BYTES = 200_000;
const RATE_LIMIT_RETRY_DELAY_MS = 65_000;
const DETAIL_FETCH_DELAY_MS = 45_000; // between show-detail Claude calls within one org

const WEEKDAY_TO_NUM = {
  Sun: 0, Sunday: 0,
  Mon: 1, Monday: 1,
  Tue: 2, Tuesday: 2,
  Wed: 3, Wednesday: 3,
  Thu: 4, Thursday: 4,
  Fri: 5, Friday: 5,
  Sat: 6, Saturday: 6,
};

// Pacific Time UTC offset for showtime storage. South Sound is on PT.
// Postgres stores everything in UTC; we tag the wall-clock with -07:00 in
// summer (PDT) and -08:00 in winter (PST). We compute the right offset
// per date instead of hardcoding so DST boundaries don't shift showtimes.
function pacificOffsetForDate(isoDate) {
  // DST in the US: second Sun of March -> first Sun of November.
  const [y, m, d] = isoDate.split("-").map(Number);
  // March: starts DST on the 2nd Sunday
  // November: ends DST on the 1st Sunday
  // Crude but correct enough: midyear (Apr-Oct) = PDT, edges checked.
  if (m > 3 && m < 11) return "-07:00";
  if (m < 3 || m > 11) return "-08:00";
  // March: find 2nd Sunday
  // November: find 1st Sunday
  const firstOfMonth = new Date(`${y}-${String(m).padStart(2, "0")}-01T12:00:00Z`);
  const dowFirst = firstOfMonth.getUTCDay();
  if (m === 3) {
    const firstSunday = 1 + ((7 - dowFirst) % 7);
    const secondSunday = firstSunday + 7;
    return d >= secondSunday ? "-07:00" : "-08:00";
  }
  // November
  const firstSunday = 1 + ((7 - dowFirst) % 7);
  return d >= firstSunday ? "-08:00" : "-07:00";
}

// ---------- HTTP + HTML helpers --------------------------------------

const USER_AGENT =
  "Mozilla/5.0 (compatible; SSTACalendarBot/1.0; +https://southsoundtheatreartists.org)";

export async function fetchHtml(url) {
  const res = await fetch(url, {
    headers: {
      "User-Agent": USER_AGENT,
      Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      "Accept-Language": "en-US,en;q=0.9",
    },
    redirect: "follow",
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}`);
  return await res.text();
}

export function cleanHtml(html) {
  let out = html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "")
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, "")
    .replace(/<noscript\b[^<]*(?:(?!<\/noscript>)<[^<]*)*<\/noscript>/gi, "")
    .replace(/<svg\b[^<]*(?:(?!<\/svg>)<[^<]*)*<\/svg>/gi, "")
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/\s+/g, " ")
    .trim();
  if (out.length > MAX_HTML_BYTES) out = out.slice(0, MAX_HTML_BYTES);
  return out;
}

export function hashContent(s) {
  return createHash("sha256").update(s).digest("hex");
}

function absoluteUrl(maybeRelative, base) {
  if (!maybeRelative) return null;
  try {
    return new URL(maybeRelative, base).toString();
  } catch {
    return null;
  }
}

// ---------- Claude prompts -------------------------------------------

function buildSeasonPrompt(html, today) {
  return `Today is ${today}. Extract every theatre production listed on this season page.

Return a JSON array shaped like:
[
  {
    "title": "Show Title",
    "run_start": "YYYY-MM-DD",
    "run_end": "YYYY-MM-DD",
    "detail_url": "absolute URL to the show's own page" | null,
    "schedule": [{"weekdays": ["Thu","Fri","Sat"], "time": "19:30"}] | [],
    "special": [{"date": "YYYY-MM-DD", "time": "19:30", "note": "Pay What You Can"}] | [],
    "explicit_performances": [{"date": "YYYY-MM-DD", "time": "19:30"}] | []
  }
]

Rules:
- Only theatre productions (plays, musicals, staged readings, themed performance events like murder mystery dinners). Skip: educational programs without a public showing, summer camps, fundraising galas without a performance component, donation pages, audition notices, "next season" teasers without specific dates, non-theatrical content.
- Skip 1-2 day events that are clearly readings, fundraisers, or galas, NOT mainstage productions.
- title: copy the show name exactly as it appears on the page, including unusual spellings, doubled letters, exclamation points, accents, ampersands, and parentheticals. Do NOT normalize, autocorrect, or "fix" titles. "Mamma Mia!" stays "Mamma Mia!" - not "Mama Mia". "tick, tick... BOOM!" stays as-is. "August: Osage County" keeps the colon. When the page itself is inconsistent (heading vs blurb), prefer the heading.
- All dates: YYYY-MM-DD. All times: 24-hour HH:MM.
- weekdays use 3-letter abbreviations: Sun, Mon, Tue, Wed, Thu, Fri, Sat.
- If a year is missing, infer it from page context (season heading, surrounding shows, current date ${today}). When the year is genuinely ambiguous, prefer the next future occurrence over a past one.
- detail_url: absolute URL to the show-specific page if linked from this listing; null otherwise. Resolve relative URLs against the page's own URL.
- schedule: include if the page lists a regular weekly pattern (e.g. "Thu-Sat 7:30pm, Sun 2pm"). Use [] if there is no pattern given.
- special: one-off performances with a note (Pay-What-You-Can, ASL Interpreted, talkback, etc). Use [] if none.
- explicit_performances: ONLY use this when the page lists individual specific performance dates without any pattern (e.g. a calendar grid). Use [] if there's a regular schedule pattern instead.
- If only an opening date is listed without a closing date, set run_end to the same day as run_start and return empty schedule + special + explicit_performances.
- If no upcoming productions are found, return [].
- Return ONLY the raw JSON array. No prose, no markdown, no code fence.

HTML:
${html}`;
}

function buildDetailPrompt(html, knownTitle, today) {
  return `Today is ${today}. Extract the performance schedule for the production "${knownTitle}".

Return a JSON object shaped like:
{
  "run_start": "YYYY-MM-DD" | null,
  "run_end": "YYYY-MM-DD" | null,
  "schedule": [{"weekdays": ["Thu","Fri","Sat"], "time": "19:30"}] | [],
  "special": [{"date": "YYYY-MM-DD", "time": "19:30", "note": "Pay What You Can"}] | [],
  "explicit_performances": [{"date": "YYYY-MM-DD", "time": "19:30"}] | []
}

Rules:
- All dates: YYYY-MM-DD. All times: 24-hour HH:MM.
- weekdays: Sun, Mon, Tue, Wed, Thu, Fri, Sat.
- schedule: regular weekly pattern. Use [] if no pattern.
- special: one-off performances with a note. Use [] if none.
- explicit_performances: individual specific dates ONLY when there is no regular pattern. Use [] when a schedule pattern covers everything.
- run_start / run_end: include if the detail page restates the run dates. null if not on this page.
- If a year is ambiguous, prefer the next future occurrence (today is ${today}).
- Return ONLY the raw JSON object.

HTML:
${html}`;
}

// ---------- Claude API call ------------------------------------------

export async function callClaude(prompt, { isRetry = false } = {}) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY not set");

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": ANTHROPIC_VERSION,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 4096,
      messages: [{ role: "user", content: prompt }],
    }),
  });

  if (res.status === 429 && !isRetry) {
    await new Promise((r) => setTimeout(r, RATE_LIMIT_RETRY_DELAY_MS));
    return callClaude(prompt, { isRetry: true });
  }
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Anthropic ${res.status}: ${text.slice(0, 500)}`);
  }
  const data = await res.json();
  const text = data.content?.[0]?.text ?? "";
  return { text, usage: data.usage ?? {} };
}

function parseJson(text, expectArray) {
  let cleaned = text.trim();
  if (cleaned.startsWith("```")) {
    cleaned = cleaned.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/, "");
  }
  const open = expectArray ? "[" : "{";
  const close = expectArray ? "]" : "}";
  const first = cleaned.indexOf(open);
  const last = cleaned.lastIndexOf(close);
  if (first !== -1 && last > first) cleaned = cleaned.slice(first, last + 1);
  return JSON.parse(cleaned);
}

function costFor(usage) {
  const inT = usage.input_tokens ?? 0;
  const outT = usage.output_tokens ?? 0;
  return (inT / 1_000_000) * HAIKU_INPUT_PER_M + (outT / 1_000_000) * HAIKU_OUTPUT_PER_M;
}

// ---------- Schedule expansion ---------------------------------------

function eachDate(startISO, endISO) {
  const out = [];
  const start = new Date(`${startISO}T12:00:00Z`);
  const end = new Date(`${endISO}T12:00:00Z`);
  for (let d = new Date(start); d <= end; d.setUTCDate(d.getUTCDate() + 1)) {
    out.push({ iso: d.toISOString().slice(0, 10), dayOfWeek: d.getUTCDay() });
  }
  return out;
}

// Defensive validators — the LLM occasionally emits null/undefined for
// time when the source page leaves it ambiguous (e.g. "July 25 or 26
// TBD"). Skip those entries rather than crashing the upsert.
function isIsoDate(s) {
  return typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s);
}
function isHhmm(s) {
  return typeof s === "string" && /^\d{2}:\d{2}$/.test(s);
}

export function expandPerformances(show) {
  const flags = [];
  if (!isIsoDate(show.run_start) || !isIsoDate(show.run_end)) flags.push("missing run dates");

  const hasSchedule = Array.isArray(show.schedule) && show.schedule.length > 0;
  const hasSpecial = Array.isArray(show.special) && show.special.length > 0;
  const hasExplicit = Array.isArray(show.explicit_performances) && show.explicit_performances.length > 0;
  if (!hasSchedule && !hasSpecial && !hasExplicit) flags.push("no schedule data");

  const performances = [];
  const seen = new Set();

  if (hasSchedule && isIsoDate(show.run_start) && isIsoDate(show.run_end)) {
    for (const day of eachDate(show.run_start, show.run_end)) {
      for (const rule of show.schedule) {
        if (!isHhmm(rule.time)) continue;
        const nums = (rule.weekdays || [])
          .map((w) => WEEKDAY_TO_NUM[w])
          .filter((n) => n !== undefined);
        if (nums.includes(day.dayOfWeek)) {
          const datetime = `${day.iso}T${rule.time}`;
          if (!seen.has(datetime)) {
            seen.add(datetime);
            performances.push({ datetime, note: null });
          }
        }
      }
    }
  }

  if (hasExplicit) {
    for (const ep of show.explicit_performances) {
      if (!isIsoDate(ep.date) || !isHhmm(ep.time)) continue;
      const datetime = `${ep.date}T${ep.time}`;
      if (!seen.has(datetime)) {
        seen.add(datetime);
        performances.push({ datetime, note: null });
      }
    }
  }

  if (hasSpecial) {
    for (const sp of show.special) {
      if (!isIsoDate(sp.date) || !isHhmm(sp.time)) continue;
      const datetime = `${sp.date}T${sp.time}`;
      const existing = performances.find((p) => p.datetime === datetime);
      if (existing) existing.note = sp.note;
      else performances.push({ datetime, note: sp.note });
    }
  }

  performances.sort((a, b) => a.datetime.localeCompare(b.datetime));
  return { performances, flags };
}

// Convert a "YYYY-MM-DDTHH:MM" wall-clock string into a Postgres
// timestamptz literal in Pacific Time.
function toPostgresTimestamptz(walltime) {
  const [date, time] = walltime.split("T");
  const offset = pacificOffsetForDate(date);
  return `${date}T${time}:00${offset}`;
}

// ---------- DB upsert -------------------------------------------------

async function getDefaultCategoryId(db) {
  const res = await db.query(
    `select id from public.event_categories where slug = 'production' limit 1`,
  );
  return res.rows[0]?.id ?? null;
}

// Upsert a single production + replace its performances atomically.
// Match key: organization_id + run_start window (+/- 30 days). Title is NOT
// part of the match key so that admin renames don't cause the cron to
// create a duplicate alongside the renamed row.
//
// Three short-circuits:
//   - admin_edited_at is set: row is admin-locked, skip everything
//   - deleted_at is set: row was admin-removed, skip (don't reanimate)
//   - found + clean: update fields + replace performances
//   - not found: insert new
//
// Trade-off: two productions from the same source with overlapping
// 30-day run windows would collide on the same row. Vanishingly rare
// for community theatre (typically one show running at a time); accept
// the false-positive in the rare overlap case.
async function upsertProductionWithPerformances(db, source, show, defaultCategoryId) {
  const orgName = source.org_name;

  // Normalise title to ALL CAPS for consistent display on the calendar.
  const title = String(show.title ?? "").toUpperCase().trim();
  if (!title) return; // skip empty titles after normalisation

  const findRes = await db.query(
    `select id, admin_edited_at, deleted_at from public.productions
      where organization_id = $1
        and (run_start is null or run_start between ($2::date - interval '30 days') and ($2::date + interval '30 days'))
      limit 1`,
    [source.id, show.run_start],
  );

  if (findRes.rowCount > 0) {
    const existing = findRes.rows[0];
    if (existing.admin_edited_at || existing.deleted_at) {
      // Admin owns this row (edit-locked or removed). Cron leaves it
      // alone - neither updates metadata nor touches performances.
      return existing.id;
    }
  }

  let productionId;
  if (findRes.rowCount > 0) {
    productionId = findRes.rows[0].id;
    // (Admin-lock + deleted short-circuits handled above; we only get
    // here when the row is clean and cron-controlled.)
    await db.query(
      `update public.productions
          set title = $2,
              organization_name = $3,
              run_start = $4,
              run_end = $5,
              detail_url = $6,
              category_id = coalesce(category_id, $7),
              status = case when status = 'rejected' then status else 'approved' end,
              updated_at = now()
        where id = $1`,
      [
        productionId,
        title,
        orgName,
        show.run_start,
        show.run_end,
        show.detail_url,
        defaultCategoryId,
      ],
    );
    // Refresh area from the source on every sync (handles cases where
    // Lexi moves an org between areas - all its productions follow).
    await db.query(
      `update public.productions
          set area_id = (select area_id from public.organizations where id = $2)
        where id = $1`,
      [productionId, source.id],
    );
    // Clear out previous performances; we re-write them from the latest
    // extraction. This is correct because the source of truth IS the
    // theatre's published schedule.
    await db.query(
      `delete from public.performances where production_id = $1`,
      [productionId],
    );
  } else {
    const insRes = await db.query(
      `insert into public.productions
         (title, organization_name, run_start, run_end, detail_url,
          category_id, organization_id, area_id, status)
       values ($1, $2, $3, $4, $5, $6, $7,
               (select area_id from public.organizations where id = $7),
               'approved')
       returning id`,
      [
        title,
        orgName,
        show.run_start,
        show.run_end,
        show.detail_url,
        defaultCategoryId,
        source.id,
      ],
    );
    productionId = insRes.rows[0].id;
  }

  // Insert performances
  for (const p of show.performances ?? []) {
    await db.query(
      `insert into public.performances (production_id, performs_at, note)
       values ($1, $2::timestamptz, $3)`,
      [productionId, toPostgresTimestamptz(p.datetime), p.note ?? null],
    );
  }

  return productionId;
}

// ---------- Adapter dispatch -----------------------------------------

// Each adapter takes (source, opts, today) and returns a Promise of:
//   { shows, hash, cost }
// where shows[] is normalized to the season-prompt schema (title, run
// dates, schedule/special/explicit_performances) and hash is whatever
// fingerprint the adapter uses to detect "nothing changed since last
// run." Adapters throw on hard failure; the orchestrator catches and
// records the error on the org row.
const ADAPTERS = {
  "ai-generic": extractAiGeneric,
  "squarespace-json": extractSquarespaceJson,
  "ovationtix": extractOvationTix,
  "ludus": extractLudus,
  "eventbrite": extractEventbrite,
};

// Re-exported for adapter modules so they share the same Claude wiring,
// HTTP helpers, and prompt format. Avoids a separate "adapter helpers"
// file when these are the same primitives the AI-generic path needs.
// (fetchHtml, cleanHtml, hashContent, callClaude, expandPerformances
// are already exported at their declarations above; only the
// internal-use helpers need re-export here.)
export { costFor, buildSeasonPrompt, buildDetailPrompt, parseJson, absoluteUrl };
export { DETAIL_FETCH_DELAY_MS };

// ---------- Per-source pipeline --------------------------------------

/**
 * Sync one organizations row.
 *
 * @param {pg.Client} db
 * @param {object} source - row from organizations (must have id, org_name (alias for name),
 *                          source_url, adapter, last_hash, etc.)
 * @param {object} opts
 * @param {boolean} [opts.force=false] - ignore the hash cache and force re-extract
 * @param {string}  [opts.today] - "YYYY-MM-DD" override for prompt context
 * @returns {Promise<{status, showCount, performanceCount, cost, error?, durationMs, htmlChanged}>}
 */
export async function syncEventSource(db, source, opts = {}) {
  const start = Date.now();
  const today = opts.today ?? new Date().toISOString().slice(0, 10);

  const adapterFn = ADAPTERS[source.adapter];
  if (!adapterFn) {
    await markSourceError(db, source.id, `unknown adapter: ${source.adapter}`);
    return {
      status: "error",
      error: `unknown adapter: ${source.adapter}`,
      cost: 0,
      durationMs: Date.now() - start,
    };
  }

  // Run the adapter. It owns fetching + Claude calls + hash computation
  // for its strategy. We catch its errors centrally so every adapter
  // gets the same error-recording behaviour without re-implementing.
  let result;
  try {
    result = await adapterFn(source, opts, today);
  } catch (err) {
    await markSourceError(db, source.id, `${source.adapter}: ${err.message}`);
    return {
      status: "error",
      error: `${source.adapter}: ${err.message}`,
      cost: 0,
      durationMs: Date.now() - start,
    };
  }

  const { shows: rawShows, hash: newHash, cost } = result;

  // Cache short-circuit - identical hash since last successful run and
  // not forced => no DB write, just bump last_checked_at + status.
  if (!opts.force && source.last_hash && source.last_hash === newHash) {
    await db.query(
      `update public.organizations
          set last_status = 'unchanged',
              last_checked_at = now(),
              last_error = null
        where id = $1`,
      [source.id],
    );
    return {
      status: "unchanged",
      showCount: source.last_show_count ?? 0,
      performanceCount: 0,
      cost,
      htmlChanged: false,
      durationMs: Date.now() - start,
    };
  }

  // Expand performances per show
  for (const show of rawShows) {
    const { performances } = expandPerformances(show);
    show.performances = performances;
  }

  // Upsert into productions + performances. One bad show is logged but
  // doesn't take down the whole org's run.
  const defaultCategoryId = await getDefaultCategoryId(db);
  let productionsWritten = 0;
  let performancesWritten = 0;
  const showErrors = [];
  for (const show of rawShows) {
    if (!show.title || !show.run_start) continue; // skip junk rows
    if (!show.performances || show.performances.length === 0) continue; // need at least one performance to be useful
    try {
      await upsertProductionWithPerformances(db, source, show, defaultCategoryId);
      productionsWritten++;
      performancesWritten += show.performances.length;
    } catch (err) {
      showErrors.push(`${show.title}: ${err.message}`);
    }
  }

  // Update organizations cache + status
  const status = productionsWritten > 0 ? "ok" : "empty";
  const errorSummary = showErrors.length > 0 ? showErrors.join(" | ").slice(0, 1000) : null;
  await db.query(
    `update public.organizations
        set last_hash = $2,
            last_checked_at = now(),
            last_successful_at = case when $3 = 'ok' then now() else last_successful_at end,
            last_show_count = $4,
            last_status = $3,
            last_error = $5,
            cooldown_until = now() + interval '1 hour'
      where id = $1`,
    [source.id, newHash, status, productionsWritten, errorSummary],
  );

  return {
    status,
    showCount: productionsWritten,
    performanceCount: performancesWritten,
    cost,
    htmlChanged: true,
    durationMs: Date.now() - start,
    showErrors,
  };
}

async function markSourceError(db, sourceId, errMsg) {
  await db.query(
    `update public.organizations
        set last_status = 'error',
            last_error = $2,
            last_checked_at = now()
      where id = $1`,
    [sourceId, errMsg.slice(0, 1000)],
  );
}

// ---------- Adapter: ai-generic (the original path) ------------------
//
// Fetches the season URL as plain HTML, strips chrome, hashes the
// cleaned text, asks Claude Haiku to extract every production it sees,
// and (for shows whose listing didn't include a schedule) follows each
// detail_url and asks Claude again with the per-show prompt. This is
// the fallback for any org where there isn't a structured platform
// adapter (Squarespace JSON, OvationTix, Ludus, Eventbrite).
async function extractAiGeneric(source, opts, today) {
  let cost = 0;

  const html = await fetchHtml(source.source_url);
  const cleaned = cleanHtml(html);
  const newHash = hashContent(cleaned);

  // Cache short-circuit happens in the orchestrator. Here we still
  // honour it implicitly by short-circuiting the Claude call when the
  // hash hasn't changed, because the season prompt is the expensive
  // part and a repeat call would burn tokens for no new data.
  if (!opts.force && source.last_hash && source.last_hash === newHash) {
    return { shows: [], hash: newHash, cost: 0 };
  }

  // Season-page extraction
  const seasonResult = await callClaude(buildSeasonPrompt(cleaned, today));
  cost += costFor(seasonResult.usage);

  let rawShows;
  try {
    rawShows = parseJson(seasonResult.text, true);
    if (!Array.isArray(rawShows)) throw new Error("season response was not an array");
  } catch (err) {
    throw new Error(`parse-season: ${err.message}`);
  }

  // Normalise detail URLs to absolute
  for (const show of rawShows) {
    show.detail_url = absoluteUrl(show.detail_url, source.source_url);
  }

  // Detail-page crawl for shows that need deepening
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
      detailHtml = await fetchHtml(show.detail_url);
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
