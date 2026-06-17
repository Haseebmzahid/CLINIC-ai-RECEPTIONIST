import type { Page } from "@playwright/test";

export async function enableE2eMode(page: Page) {
  await page.addInitScript(() => {
    window.localStorage.setItem("clinic-ai-e2e-auth-bypass", "true");
    window.localStorage.setItem("clinic-ai-e2e-api-mock", "true");
  });
  await page.evaluate(() => {
    window.localStorage.setItem("clinic-ai-e2e-auth-bypass", "true");
    window.localStorage.setItem("clinic-ai-e2e-api-mock", "true");
  });
}
