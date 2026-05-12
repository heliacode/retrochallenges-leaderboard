// One-off smoke test for the challenge-leaderboard tab links. Hits prod,
// drills into one challenge, clicks every Daily/Weekly/All-Time tab and
// every Best/All-attempts toggle, and reports the HTTP status of each.
// Pass: every click lands on 200. Fail: any 404 = tab-link regression.
//
// Run: node scripts/smoke-leaderboard-tabs.mjs
import { chromium } from 'playwright';

const BASE = process.env.SMOKE_BASE_URL || 'https://www.flawlessnes.com';

const results = [];
function record(label, status) {
  const ok = status === 200;
  results.push({ label, status, ok });
  const icon = ok ? 'OK ' : 'XX ';
  console.log(`${icon} ${status}  ${label}`);
}

const browser = await chromium.launch();
const ctx = await browser.newContext();
const page = await ctx.newPage();

// Track network responses for the page-level document so we can assert
// each navigation lands on 200, not just "no exception thrown".
const docStatus = new Map();
page.on('response', (r) => {
  if (r.request().resourceType() === 'document') {
    docStatus.set(r.url(), r.status());
  }
});

async function goAndCheck(label, url) {
  await page.goto(url, { waitUntil: 'domcontentloaded' });
  const status = docStatus.get(url) ?? (await page.evaluate(() => 0));
  record(label, status);
  return status;
}

// 1. Leaderboards index
await goAndCheck('GET /leaderboards', `${BASE}/leaderboards`);

// 2. Find a challenge link. The page renders a card per game with each
// challenge as an inner link to /leaderboards/c/<game>/<challenge>.
const challengeLinks = await page.$$eval('a[href*="/leaderboards/c/"]', (els) =>
  els.map((a) => a.getAttribute('href')).filter(Boolean),
);
if (challengeLinks.length === 0) {
  console.error('FAIL: no challenge links found on /leaderboards');
  await browser.close();
  process.exit(2);
}
const firstChallenge = challengeLinks[0];
console.log(`-- picked challenge: ${firstChallenge}`);

// 3. Visit the challenge directly (baseline)
await goAndCheck('GET challenge (default tab)', `${BASE}${firstChallenge}`);

// 4. Iterate the 6 tab states: {daily,weekly,all} x {best,all}
const windows = ['daily', 'weekly', 'all'];
const views = ['best', 'all'];
for (const w of windows) {
  for (const v of views) {
    const params = [];
    if (w !== 'all') params.push(`window=${w}`);
    if (v !== 'best') params.push(`view=${v}`);
    const url = params.length
      ? `${BASE}${firstChallenge}?${params.join('&')}`
      : `${BASE}${firstChallenge}`;
    await goAndCheck(`window=${w} view=${v}`, url);
  }
}

// 5. Also click the tab links directly (catches the case where the
// rendered <a href=...> still has the wrong prefix even if the route
// itself is fine).
await page.goto(`${BASE}${firstChallenge}`, { waitUntil: 'domcontentloaded' });
const tabHrefs = await page.$$eval(
  'nav[aria-label="Leaderboard time window"] a, nav[aria-label="Leaderboard row mode"] a',
  (els) => els.map((a) => a.getAttribute('href')),
);
console.log(`-- tab hrefs rendered on page: ${JSON.stringify(tabHrefs)}`);
const badHrefs = tabHrefs.filter(
  (h) => h && !h.startsWith('/leaderboards/c/'),
);
if (badHrefs.length > 0) {
  console.error(`FAIL: tab hrefs missing /leaderboards prefix: ${JSON.stringify(badHrefs)}`);
  results.push({ label: 'tab hrefs prefix', status: 0, ok: false });
} else {
  console.log('OK  tab hrefs all correctly prefixed with /leaderboards/c/');
}

await browser.close();

const failed = results.filter((r) => !r.ok);
console.log(`\nResult: ${results.length - failed.length}/${results.length} passed`);
if (failed.length > 0) {
  console.error('FAILED checks:', failed);
  process.exit(1);
}
