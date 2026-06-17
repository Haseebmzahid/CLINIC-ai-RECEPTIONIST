import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  timeout: 60_000,
  workers: 1,
  expect: {
    timeout: 10_000,
  },
  use: {
    baseURL: "http://127.0.0.1:3101",
    storageState: {
      cookies: [],
      origins: [
        {
          origin: "http://127.0.0.1:3101",
          localStorage: [
            { name: "clinic-ai-e2e-auth-bypass", value: "true" },
            { name: "clinic-ai-e2e-api-mock", value: "true" },
          ],
        },
      ],
    },
    trace: "on-first-retry",
  },
  webServer: {
    command:
      'powershell -NoProfile -Command "Remove-Item -LiteralPath .next -Recurse -Force -ErrorAction SilentlyContinue; pnpm dev --hostname 127.0.0.1 --port 3101"',
    env: {
      NEXT_PUBLIC_E2E_AUTH_BYPASS: "true",
      NEXT_PUBLIC_E2E_API_MOCK: "true",
      NEXT_PUBLIC_FIREBASE_PROJECT_ID: "clinic-ai-local",
    },
    reuseExistingServer: false,
    timeout: 180_000,
    url: "http://127.0.0.1:3101/login",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});
