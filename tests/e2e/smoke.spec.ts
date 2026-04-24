import { test, expect } from '@playwright/test';

// Minimal "is the deploy alive and talking to Postgres" smoke test. If this
// passes, the Node service is up, the custom domain resolves (or the
// BASE_URL override works), the Prisma client loads, and the DB responds
// to a groupBy() call. If Postgres is down or migrations haven't run, the
// homepage crashes and this fails.
test('homepage renders without crashing', async ({ page }) => {
  const response = await page.goto('/', { waitUntil: 'domcontentloaded' });
  expect(response?.status()).toBe(200);
  await expect(page.getByRole('heading', { name: 'Leaderboards', level: 1 })).toBeVisible();
});

// Either "no runs yet" message or at least one game section should be
// present. This ensures the page completed its DB round-trip rather than
// rendering half and throwing a client-side error.
test('homepage shows either an empty state or game sections', async ({ page }) => {
  await page.goto('/');
  const emptyState = page.getByText('No runs submitted yet.');
  const anyGameHeading = page.locator('h2').first();
  await expect(emptyState.or(anyGameHeading)).toBeVisible();
});

test('POST /api/runs rejects requests without the submission secret', async ({ request }) => {
  const res = await request.post('/api/runs', {
    data: { nope: true },
    failOnStatusCode: false,
  });
  expect(res.status()).toBe(401);
});
