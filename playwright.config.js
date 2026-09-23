import { defineConfig, devices } from '@playwright/test';

// Browser tests for behaviour a headless Node test cannot prove: the WebAudio
// autoplay guard and the mute preference (T-201). Playwright is the chain's
// browser-test tool; T-202/T-203 reuse this configuration.
//
// @playwright/test is pinned to 1.59.0 because newer releases dropped the
// bundled Chromium build for macOS 13. Run `npx playwright install chromium`
// once after `npm install`.
export default defineConfig({
  testDir: './tests/browser',
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: 0,
  reporter: [['list']],
  use: {
    baseURL: 'http://127.0.0.1:5173',
    trace: 'retain-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: 'npm run dev -- --port 5173 --strictPort',
    url: 'http://127.0.0.1:5173/game.html',
    reuseExistingServer: !process.env.CI,
    timeout: 60000,
  },
});
