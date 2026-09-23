import { defineConfig, devices } from '@playwright/test';

// Verifies the portal journey against the production bundle served statically
// (T-202 DoD: `npm run build` passes and the journey works from dist/). It runs
// only the journey spec, because the dev-only /game.html harness is not part of
// the Vite build output.
export default defineConfig({
  testDir: './tests/browser',
  testMatch: '**/portal-journey.spec.js',
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: 0,
  reporter: [['list']],
  use: {
    baseURL: 'http://127.0.0.1:4173',
    trace: 'retain-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: 'npm run build && npm run preview -- --port 4173 --strictPort',
    url: 'http://127.0.0.1:4173/',
    reuseExistingServer: !process.env.CI,
    timeout: 120000,
  },
});
