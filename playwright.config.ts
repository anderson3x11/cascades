import { defineConfig } from '@playwright/test';

// Runs the frontend in a plain browser (no Tauri backend) to check the UI and editor behavior.
export default defineConfig({
  testDir: 'tests/e2e',
  use: { baseURL: 'http://localhost:1420' },
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:1420',
    reuseExistingServer: !process.env.CI,
  },
});
