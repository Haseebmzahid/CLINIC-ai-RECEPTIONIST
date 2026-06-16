import { expect, test } from "@playwright/test";

test("take over a conversation, send a manual reply, and resume AI", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("Email").fill("staff@example.com");
  await page.getByLabel("Password").fill("password");
  await page.getByRole("button", { name: "Sign in" }).click();

  await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible();
  await page.getByRole("link", { name: /Conversations/ }).click();
  await expect(page.getByRole("heading", { name: "Conversations" })).toBeVisible();

  await page.getByRole("button", { name: /\+15550111/ }).click();
  await expect(page.getByText("Hi, I need help with my appointment.")).toBeVisible();

  await page.getByRole("button", { name: "Take over" }).click();
  await expect(page.getByText("AI paused").first()).toBeVisible();

  await page.getByLabel("Reply").fill("Maria here from the clinic. I can help.");
  await page.getByRole("button", { name: "Send" }).click();
  await expect(page.getByText("Maria here from the clinic. I can help.")).toBeVisible();

  await page.getByRole("button", { name: "Resume AI" }).click();
  await expect(page.getByText(/AI active/)).toBeVisible();
});
