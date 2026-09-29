import { defineConfig } from '@playwright/test';

/**
 * Takes the pictures of the README (npm run screenshots), on the same dev
 * server as the e2e tests. Not part of the test run.
 */
const PORT = 1430;

export default defineConfig({
  testDir: 'tests/screenshots',
  use: {
    baseURL: `http://localhost:${PORT}`,
    viewport: { width: 1280, height: 760 },
    deviceScaleFactor: 1.5,
    locale: 'en-US',
  },
  webServer: {
    command: `npx vite --port ${PORT} --strictPort`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: !process.env.CI,
  },
});
