import { defineConfig } from '@playwright/test';

/**
 * Runs the frontend in a plain browser (no Tauri backend). The tests have
 * their own dev server port, so they never touch the one `tauri dev` uses.
 */
const PORT = 1430;

export default defineConfig({
  testDir: 'tests/e2e',
  use: { baseURL: `http://localhost:${PORT}` },
  webServer: {
    command: `npx vite --port ${PORT} --strictPort`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: !process.env.CI,
  },
});
