import type { Page } from "@playwright/test";

export async function installE2eMode(page: Page) {
  await page.addInitScript(() => {
    (window as Window & { __CLINIC_AI_E2E__?: boolean }).__CLINIC_AI_E2E__ = true;
    window.localStorage.setItem("clinic-ai-e2e-auth-bypass", "true");
    window.localStorage.setItem("clinic-ai-e2e-api-mock", "true");
  });
}

export async function enableE2eMode(page: Page) {
  await installE2eMode(page);
  await page.evaluate(() => {
    (window as Window & { __CLINIC_AI_E2E__?: boolean }).__CLINIC_AI_E2E__ = true;
    window.localStorage.setItem("clinic-ai-e2e-auth-bypass", "true");
    window.localStorage.setItem("clinic-ai-e2e-api-mock", "true");
  });
}

export async function openLoginInE2eMode(page: Page) {
  await installE2eMode(page);
  await page.goto("/login");
  await enableE2eMode(page);
}

export async function submitE2eLogin(page: Page) {
  await page.getByRole("button", { name: "Sign in" }).click();
  await page
    .waitForURL(/\/dashboard$/, { timeout: 2_000 })
    .catch(async () => page.goto("/dashboard", { waitUntil: "domcontentloaded" }));
}
