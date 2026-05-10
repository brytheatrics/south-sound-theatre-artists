// @ts-nocheck
// Headless-browser fetch helper for adapters whose source pages are
// JS-rendered or Cloudflare-walled (OvationTix, Ludus). Loads Playwright
// lazily so adapters that don't need it don't pay the import cost.
//
// What it does:
//   1. Launches a headless Chromium with a realistic UA + locale
//   2. Navigates to the URL with a 30s networkidle wait
//   3. Optionally waits for a CSS selector before returning
//   4. Returns the fully-rendered HTML
//
// Cost notes:
//   - ~500MB Chromium binary (downloaded once via `npx playwright install
//     chromium` in the GitHub Actions workflow). Lives only in the cron
//     runner, never in the deployed app.
//   - ~5-15s per page render. Cron is monthly so this is acceptable.

let _playwright = null;
let _browser = null;

async function getPlaywright() {
  if (!_playwright) {
    _playwright = await import("playwright");
  }
  return _playwright;
}

async function getBrowser() {
  if (_browser) return _browser;
  const { chromium } = await getPlaywright();
  _browser = await chromium.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-dev-shm-usage"],
  });
  return _browser;
}

const REAL_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
  "(KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36";

/**
 * Fetch a URL via headless Chromium and return the fully-rendered HTML.
 *
 * @param {string} url
 * @param {object} [opts]
 * @param {string} [opts.waitForSelector] - CSS selector to wait for (in addition to networkidle)
 * @param {number} [opts.timeoutMs=30000] - hard timeout
 * @param {boolean} [opts.waitForNetworkIdle=true] - wait until no network for 500ms
 * @returns {Promise<string>}
 */
export async function fetchHtmlRendered(url, opts = {}) {
  const browser = await getBrowser();
  const context = await browser.newContext({
    userAgent: REAL_UA,
    locale: "en-US",
    timezoneId: "America/Los_Angeles",
    viewport: { width: 1280, height: 800 },
  });
  const page = await context.newPage();
  try {
    await page.goto(url, {
      waitUntil: opts.waitForNetworkIdle === false ? "load" : "networkidle",
      timeout: opts.timeoutMs ?? 30_000,
    });
    if (opts.waitForSelector) {
      await page
        .waitForSelector(opts.waitForSelector, {
          timeout: opts.timeoutMs ?? 30_000,
        })
        .catch(() => {
          // Don't fail the whole render if the selector doesn't show
          // up - we still got something. Adapters can decide if the
          // result is usable.
        });
    }
    return await page.content();
  } finally {
    await page.close();
    await context.close();
  }
}

/** Close the shared browser. Call this at the end of a sync run so the
 *  cron job exits cleanly. Safe to call when no browser was launched. */
export async function closeBrowser() {
  if (_browser) {
    await _browser.close();
    _browser = null;
  }
}
