import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  timeout: 30_000,
  expect: {
    timeout: 10_000,
  },
  use: {
    baseURL: "http://127.0.0.1:3100",
    trace: "on-first-retry",
  },
  webServer: {
    command: "pnpm dev --hostname 127.0.0.1 --port 3100",
    env: {
      NEXT_PUBLIC_E2E_AUTH_BYPASS: "true",
      NEXT_PUBLIC_E2E_API_MOCK: "true",
      NEXT_PUBLIC_FIREBASE_PROJECT_ID: "clinic-ai-local",
    },
    reuseExistingServer: true,
    timeout: 120_000,
    url: "http://127.0.0.1:3100/login",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});
