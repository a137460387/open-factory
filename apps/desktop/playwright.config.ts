import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  timeout: 30_000,
  expect: { timeout: 5_000 },
  use: {
    baseURL: 'http://localhost:1420',
    trace: 'retain-on-failure'
  },
  webServer: {
    command: 'bun run dev -- --host localhost',
    url: 'http://localhost:1420',
    reuseExistingServer: true,
    env: {
      VITE_E2E: 'true'
    }
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] }
    }
  ]
});
