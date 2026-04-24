import { defineConfig, devices } from '@playwright/test';

// Target a deployed URL via BASE_URL env var, defaulting to the production
// custom domain. Useful overrides:
//   BASE_URL=https://xxx.up.railway.app npx playwright test
//   BASE_URL=http://localhost:3000 npx playwright test
export default defineConfig({
  testDir: './tests/e2e',
  timeout: 30_000,
  fullyParallel: true,
  reporter: [['list']],
  use: {
    baseURL: process.env.BASE_URL ?? 'https://leaderboards.retrochallenges.com',
    trace: 'retain-on-failure',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],
});
