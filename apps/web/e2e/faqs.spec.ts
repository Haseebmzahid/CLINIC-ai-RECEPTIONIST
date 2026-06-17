import { expect, test } from "@playwright/test";

import { openLoginInE2eMode, submitE2eLogin } from "./support";

test("edit a FAQ and verify it persists in the dashboard", async ({ page }) => {
  await openLoginInE2eMode(page);
  await page.getByLabel("Email").fill("owner@example.com");
  await page.getByLabel("Password").fill("password");
  await submitE2eLogin(page);

  await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible();
  await page.goto("/settings/faqs");
  await expect(page.getByRole("heading", { name: "FAQs" })).toBeVisible();

  await page.getByRole("button", { name: /Where are you located/ }).click();
  await page.getByLabel("Answer").fill("We are at 456 Wellness Blvd.");
  await page.getByRole("button", { name: "Save FAQ" }).click();

  await expect(page.getByLabel("Answer")).toHaveValue("We are at 456 Wellness Blvd.");
  await page.goto("/dashboard");
  await page.goto("/settings/faqs");
  await page.getByRole("button", { name: /Where are you located/ }).click();
  await expect(page.getByLabel("Answer")).toHaveValue("We are at 456 Wellness Blvd.");
});
