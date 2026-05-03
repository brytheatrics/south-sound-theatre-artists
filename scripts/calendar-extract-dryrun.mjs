// scripts/calendar-extract-dryrun.mjs
//
// Phase 0.5 dry-run for the v2.x auto-populated calendar feature. Two-step
// crawl per org:
//   1. Fetch the season-list URL, extract titles + run dates + detail URLs
//      (and schedule pattern when it's already on the season page).
//   2. For shows whose schedule wasn't on the season page, follow the
//      detail_url and extract the schedule pattern + special performances
//      from the show's own page.
// Then code-side expands schedule x run_range into a flat list of individual
// performances ({datetime, note}). No DB writes.
//
// The point: validate that we can produce per-performance data ("what's
// playing tonight?") for the auto-populated calendar before building the
// schema and admin surface around it.
//
// Run:
//   node scripts/calendar-extract-dryrun.mjs                # all 11 sources
//   node scripts/calendar-extract-dryrun.mjs --org=tlt      # one source
//   node scripts/calendar-extract-dryrun.mjs --save         # also dump JSON
//
// Requires ANTHROPIC_API_KEY in .env.

import { config as loadDotenv } from "dotenv";
import { writeFile, mkdir } from "node:fs/promises";

// override:true so .env beats inherited OS env vars (e.g. an empty
// ANTHROPIC_API_KEY=  set by a parent shell or by Claude Code itself).
loadDotenv({ override: true });

const MODEL = "claude-haiku-4-5";
const ANTHROPIC_VERSION = "2023-06-01";
const HAIKU_INPUT_PER_M = 1.0;
const HAIKU_OUTPUT_PER_M = 5.0;
const MAX_HTML_BYTES = 200_000;
const REQUEST_DELAY_MS = 45_000;
const RATE_LIMIT_RETRY_DELAY_MS = 65_000;

const SOURCES = [
  { id: "tlt", name: "Tacoma Little Theatre", url: "https://www.tacomalittletheatre.com/blog/tag/2025-2026" },
  { id: "lakewood", name: "Lakewood Playhouse", url: "https://www.lakewoodplayhouse.org/season-87.html" },
  { id: "tmp", name: "Tacoma Musical Playhouse", url: "https://www.tmp.org/season-and-show-tickets" },
  { id: "manestage", name: "ManeStage Theatre Company", url: "https://www.manestagetheatre.com/buy-tickets" },
  { id: "harlequin", name: "Harlequin Productions", url: "https://harlequinproductions.org/season/" },
  { id: "tao", name: "Theater Artists Olympia", url: "https://www.olytheater.com/calendar" },
  { id: "animalfire", name: "Animal Fire Theatre", url: "https://animalfiretheatre.com/" },
  { id: "evergreen", name: "Evergreen Playhouse", url: "https://app.arts-people.com/index.php?ticketing=tep" },
  { id: "bat", name: "Burien Actors Theatre", url: "https://battheatre.org/this-season/" },
  { id: "battery", name: "Theatre Battery", url: "https://www.theatrebattery.org/" },
  { id: "emerald", name: "Emerald Theatre", url: "https://www.emeraldtheatre.org/current-production" },
  { id: "olt", name: "Olympia Little Theatre", url: "https://app.arts-people.com/index.php?ticketing=olylt" },
  { id: "oft", name: "Olympia Family Theater", url: "https://app.arts-people.com/index.php?ticketing=olyft" },
  { id: "auburn", name: "Auburn Community Players", url: "https://app.arts-people.com/index.php?ticketing=coapa" },
  { id: "jewelbox", name: "Jewel Box Theatre", url: "https://app.arts-people.com/index.php?show=287501" },
  { id: "bremerton", name: "Bremerton Community Theatre", url: "https://app.arts-people.com/index.php?ticketing=brmct" },
  { id: "mustardseed", name: "Mustard Seed Theater Company", url: "https://mustardseedtheater.csstix.com/" },
  { id: "dukesbay", name: "Dukesbay Productions", url: "https://dukesbay.org/shows/" },
  { id: "centerstage", name: "Centerstage Theatre", url: "https://centerstagetheatre.com/current-season/" },
  { id: "rentoncivic", name: "Renton Civic Theatre", url: "https://www.rentoncivictheatre.org/season-2026" },
];

const TODAY = new Date().toISOString().slice(0, 10);

// ----- Prompts ------------------------------------------------------------

function buildSeasonPrompt(html) {
  return `Today is ${TODAY}. Extract every theatre production listed on this season page.

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
- Only theatre productions (plays, musicals, staged readings). Skip educational programs, summer camps, fundraisers, donation pages, audition notices, "next season" teasers without specific dates, and any non-theatrical content.
- Skip 1-2 day events that are clearly readings, fundraisers, or galas, NOT mainstage productions.
- All dates: YYYY-MM-DD. All times: 24-hour HH:MM.
- weekdays use 3-letter abbreviations: Sun, Mon, Tue, Wed, Thu, Fri, Sat.
- If a year is missing, infer it from page context (season heading, surrounding shows, current date ${TODAY}). When the year is genuinely ambiguous, prefer the next future occurrence over a past one.
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

function buildDetailPrompt(html, knownTitle) {
  return `Today is ${TODAY}. Extract the performance schedule for the production "${knownTitle}".

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
- schedule: regular weekly pattern (e.g. "Thursday - Saturday at 7:30pm, Sundays at 2:00pm"). Use [] if no pattern.
- special: one-off performances with a note (Pay-What-You-Can, ASL Interpreted, talkback, opening night reception, etc). Use [] if none.
- explicit_performances: individual specific dates ONLY when there is no regular pattern. Use [] when a schedule pattern covers everything.
- run_start / run_end: include if the detail page restates the run dates. null if not on this page.
- If a year is ambiguous, prefer the next future occurrence (today is ${TODAY}).
- Return ONLY the raw JSON object.

HTML:
${html}`;
}

// ----- Helpers ------------------------------------------------------------

async function fetchHtml(url) {
  const res = await fetch(url, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (compatible; SSTACalendarBot/1.0; +https://southsoundtheatreartists.org)",
      Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    },
    redirect: "follow",
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}`);
  return await res.text();
}

function cleanHtml(html) {
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

async function callClaude(prompt, { isRetry = false } = {}) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error("ANTHROPIC_API_KEY not set. Add it to .env.");
  }

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
    console.log(
      `    Rate-limited; waiting ${RATE_LIMIT_RETRY_DELAY_MS / 1000}s then retrying once...`,
    );
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
  // Find first { or [, last } or ]
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

function absoluteUrl(maybeRelative, base) {
  if (!maybeRelative) return null;
  try {
    return new URL(maybeRelative, base).toString();
  } catch {
    return null;
  }
}

// ----- Schedule expansion -------------------------------------------------

const WEEKDAY_TO_NUM = {
  Sun: 0, Sunday: 0,
  Mon: 1, Monday: 1,
  Tue: 2, Tuesday: 2,
  Wed: 3, Wednesday: 3,
  Thu: 4, Thursday: 4,
  Fri: 5, Friday: 5,
  Sat: 6, Saturday: 6,
};

function eachDate(startISO, endISO) {
  const out = [];
  // Use noon UTC to dodge daylight-saving boundary weirdness when iterating
  // by day; we only ever read .getUTCDay() and the ISO date prefix.
  const start = new Date(`${startISO}T12:00:00Z`);
  const end = new Date(`${endISO}T12:00:00Z`);
  for (let d = new Date(start); d <= end; d.setUTCDate(d.getUTCDate() + 1)) {
    out.push({
      iso: d.toISOString().slice(0, 10),
      dayOfWeek: d.getUTCDay(),
    });
  }
  return out;
}

function expandPerformances(show) {
  const flags = [];
  if (!show.run_start || !show.run_end) {
    flags.push("missing run dates");
  }
  const hasSchedule = Array.isArray(show.schedule) && show.schedule.length > 0;
  const hasSpecial = Array.isArray(show.special) && show.special.length > 0;
  const hasExplicit =
    Array.isArray(show.explicit_performances) && show.explicit_performances.length > 0;

  if (!hasSchedule && !hasSpecial && !hasExplicit) {
    flags.push("no schedule, special, or explicit performance data");
  }

  const performances = [];
  const seen = new Set();

  // 1. Expand schedule x range
  if (hasSchedule && show.run_start && show.run_end) {
    for (const day of eachDate(show.run_start, show.run_end)) {
      for (const rule of show.schedule) {
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

  // 2. Add explicit performances (deduped against pattern)
  if (hasExplicit) {
    for (const ep of show.explicit_performances) {
      const datetime = `${ep.date}T${ep.time}`;
      if (!seen.has(datetime)) {
        seen.add(datetime);
        performances.push({ datetime, note: null });
      }
    }
  }

  // 3. Apply special performances: annotate matching, add new
  if (hasSpecial) {
    for (const sp of show.special) {
      const datetime = `${sp.date}T${sp.time}`;
      const existing = performances.find((p) => p.datetime === datetime);
      if (existing) {
        existing.note = sp.note;
      } else {
        performances.push({ datetime, note: sp.note });
      }
    }
  }

  performances.sort((a, b) => a.datetime.localeCompare(b.datetime));

  return { performances, flags };
}

// ----- Per-source pipeline -----------------------------------------------

async function processSource(source, isLastSource) {
  const start = Date.now();
  const callsLog = [];
  console.log(`\n========================================`);
  console.log(`${source.name} (${source.id})`);
  console.log(`========================================`);
  console.log(`Season URL: ${source.url}`);

  // Step 1: season page
  let seasonHtml;
  try {
    seasonHtml = await fetchHtml(source.url);
  } catch (err) {
    console.error(`Fetch failed: ${err.message}`);
    return { source, error: `fetch: ${err.message}`, calls: 0, cost: 0, ms: Date.now() - start };
  }
  const seasonClean = cleanHtml(seasonHtml);
  console.log(`  Fetched ${seasonHtml.length}b raw -> ${seasonClean.length}b cleaned`);

  let seasonCall;
  try {
    seasonCall = await callClaude(buildSeasonPrompt(seasonClean));
    callsLog.push({ kind: "season", usage: seasonCall.usage, cost: costFor(seasonCall.usage) });
    console.log(
      `  Claude (season): ${seasonCall.usage.input_tokens ?? 0} in / ${seasonCall.usage.output_tokens ?? 0} out -> $${costFor(seasonCall.usage).toFixed(4)}`,
    );
  } catch (err) {
    console.error(`  LLM (season) failed: ${err.message}`);
    return { source, error: `llm-season: ${err.message}`, calls: 0, cost: 0, ms: Date.now() - start };
  }

  let rawShows;
  try {
    rawShows = parseJson(seasonCall.text, true);
    if (!Array.isArray(rawShows)) throw new Error("season response was not an array");
  } catch (err) {
    console.error(`  Parse (season) failed: ${err.message}`);
    return {
      source,
      error: `parse-season: ${err.message}`,
      raw: seasonCall.text,
      calls: 1,
      cost: costFor(seasonCall.usage),
      ms: Date.now() - start,
    };
  }
  console.log(`  Season extraction: ${rawShows.length} show${rawShows.length === 1 ? "" : "s"}`);

  // Normalise detail URLs to absolute
  for (const show of rawShows) {
    show.detail_url = absoluteUrl(show.detail_url, source.url);
  }

  // Step 2: detail pages for shows that need them
  for (const show of rawShows) {
    const haveSchedule = Array.isArray(show.schedule) && show.schedule.length > 0;
    const haveExplicit =
      Array.isArray(show.explicit_performances) && show.explicit_performances.length > 0;

    if (haveSchedule || haveExplicit) {
      // Already complete from season page (TAO-style). Skip detail fetch.
      continue;
    }

    if (!show.detail_url) {
      // No way to deepen. expandPerformances() will flag it.
      continue;
    }

    // Be polite between detail-page fetches
    await new Promise((r) => setTimeout(r, REQUEST_DELAY_MS));

    console.log(`\n  -- Detail crawl: ${show.title}`);
    console.log(`     ${show.detail_url}`);

    let detailHtml;
    try {
      detailHtml = await fetchHtml(show.detail_url);
    } catch (err) {
      console.error(`     Fetch failed: ${err.message}`);
      show._detailError = `fetch: ${err.message}`;
      continue;
    }
    const detailClean = cleanHtml(detailHtml);
    console.log(`     Fetched ${detailHtml.length}b raw -> ${detailClean.length}b cleaned`);

    let detailCall;
    try {
      detailCall = await callClaude(buildDetailPrompt(detailClean, show.title));
      callsLog.push({ kind: "detail", usage: detailCall.usage, cost: costFor(detailCall.usage) });
      console.log(
        `     Claude: ${detailCall.usage.input_tokens ?? 0} in / ${detailCall.usage.output_tokens ?? 0} out -> $${costFor(detailCall.usage).toFixed(4)}`,
      );
    } catch (err) {
      console.error(`     LLM failed: ${err.message}`);
      show._detailError = `llm: ${err.message}`;
      continue;
    }

    let detailData;
    try {
      detailData = parseJson(detailCall.text, false);
    } catch (err) {
      console.error(`     Parse failed: ${err.message}`);
      show._detailError = `parse: ${err.message}`;
      continue;
    }

    // Merge: detail overrides season for run dates if it has them, and
    // brings schedule / special / explicit_performances.
    if (detailData.run_start) show.run_start = detailData.run_start;
    if (detailData.run_end) show.run_end = detailData.run_end;
    if (Array.isArray(detailData.schedule)) show.schedule = detailData.schedule;
    if (Array.isArray(detailData.special)) show.special = detailData.special;
    if (Array.isArray(detailData.explicit_performances))
      show.explicit_performances = detailData.explicit_performances;
  }

  // Step 3: expand performances
  const enriched = rawShows.map((show) => {
    const { performances, flags } = expandPerformances(show);
    if (show._detailError) flags.push(`detail crawl: ${show._detailError}`);
    return {
      title: show.title,
      run_start: show.run_start ?? null,
      run_end: show.run_end ?? null,
      detail_url: show.detail_url ?? null,
      schedule: show.schedule ?? [],
      special: show.special ?? [],
      explicit_performances: show.explicit_performances ?? [],
      performances,
      flags,
    };
  });

  console.log(`\n  Per-show summary:`);
  for (const s of enriched) {
    const flagStr = s.flags.length > 0 ? `  [FLAGS: ${s.flags.join("; ")}]` : "";
    console.log(`    ${s.title}: ${s.performances.length} performance${s.performances.length === 1 ? "" : "s"}${flagStr}`);
  }

  const totalCost = callsLog.reduce((sum, c) => sum + c.cost, 0);

  // Polite delay before next source's season call (skip if last)
  if (!isLastSource) {
    await new Promise((r) => setTimeout(r, REQUEST_DELAY_MS));
  }

  return {
    source,
    shows: enriched,
    calls: callsLog,
    cost: totalCost,
    ms: Date.now() - start,
  };
}

// ----- CLI plumbing -------------------------------------------------------

function parseArgs() {
  const out = { org: null, save: false };
  for (const a of process.argv.slice(2)) {
    if (a === "--save") out.save = true;
    else if (a.startsWith("--org=")) out.org = a.slice("--org=".length);
    else if (a === "--help" || a === "-h") {
      console.log(
        "Usage: node scripts/calendar-extract-dryrun.mjs [--org=<id>] [--save]\n\n" +
          `Available org ids: ${SOURCES.map((s) => s.id).join(", ")}`,
      );
      process.exit(0);
    } else {
      console.error(`Unknown argument: ${a}`);
      process.exit(1);
    }
  }
  return out;
}

async function main() {
  const args = parseArgs();
  const targets = args.org ? SOURCES.filter((s) => s.id === args.org) : SOURCES;
  if (targets.length === 0) {
    console.error(
      `No source matches --org=${args.org}.\nAvailable: ${SOURCES.map((s) => s.id).join(", ")}`,
    );
    process.exit(1);
  }

  console.log(
    `Phase 0.5 dry-run: ${targets.length} source${targets.length === 1 ? "" : "s"}, model=${MODEL}, today=${TODAY}`,
  );

  const results = [];
  for (let i = 0; i < targets.length; i++) {
    const r = await processSource(targets[i], i === targets.length - 1);
    results.push(r);
  }

  // Aggregate summary
  console.log(`\n\n============================================================`);
  console.log(`AGGREGATE SUMMARY`);
  console.log(`============================================================`);
  let totalShows = 0;
  let totalPerformances = 0;
  let totalCost = 0;
  let totalCalls = 0;
  let orgErrors = 0;
  const flaggedShows = [];

  for (const r of results) {
    if (r.error) {
      console.log(`  [ORG ERROR] ${r.source.name}: ${r.error}`);
      orgErrors++;
      totalCost += r.cost ?? 0;
      continue;
    }
    const showCount = r.shows.length;
    const perfCount = r.shows.reduce((sum, s) => sum + s.performances.length, 0);
    const flaggedCount = r.shows.filter((s) => s.flags.length > 0).length;
    totalShows += showCount;
    totalPerformances += perfCount;
    totalCost += r.cost;
    totalCalls += r.calls.length;

    const flagStr = flaggedCount > 0 ? `  (${flaggedCount} flagged)` : "";
    console.log(
      `  ${r.source.name}: ${showCount} show${showCount === 1 ? "" : "s"}, ${perfCount} performance${perfCount === 1 ? "" : "s"}, $${r.cost.toFixed(4)}${flagStr}`,
    );

    for (const s of r.shows) {
      if (s.flags.length > 0) {
        flaggedShows.push({
          org: r.source.name,
          title: s.title,
          flags: s.flags,
          detail_url: s.detail_url,
        });
      }
    }
  }

  console.log(`\n${totalShows} shows, ${totalPerformances} individual performances`);
  console.log(`${totalCalls} API calls, $${totalCost.toFixed(4)} total cost`);
  console.log(`${orgErrors} org-level error${orgErrors === 1 ? "" : "s"}, ${flaggedShows.length} flagged show${flaggedShows.length === 1 ? "" : "s"}`);

  if (flaggedShows.length > 0) {
    console.log(`\n--- FLAGGED SHOWS (need manual lookup) ---`);
    for (const f of flaggedShows) {
      console.log(`  ${f.org} :: ${f.title}`);
      for (const flag of f.flags) console.log(`    - ${flag}`);
      if (f.detail_url) console.log(`    detail: ${f.detail_url}`);
    }
  }

  if (args.save) {
    const ts = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
    await mkdir("_dryrun-results", { recursive: true });
    const path = `_dryrun-results/calendar-perf-dryrun-${ts}.json`;
    await writeFile(path, JSON.stringify(results, null, 2));
    console.log(`\nSaved full results to ${path}`);
  }
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
