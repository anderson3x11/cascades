import { defineConfig } from '@playwright/test';

/**
 * Writes docs/reference.json (npm run docs): every command with its shortcuts
 * and every setting, as the app shows them, for the website's documentation.
 */
const PORT = 1430;

export default defineConfig({
  testDir: 'tests/docs',
  use: { baseURL: `http://localhost:${PORT}` },
  webServer: {
    command: `npx vite --port ${PORT} --strictPort`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: !process.env.CI,
  },
});
