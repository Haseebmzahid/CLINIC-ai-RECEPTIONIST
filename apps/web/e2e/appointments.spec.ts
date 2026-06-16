import { expect, test } from "@playwright/test";

test("login, view calendar, create a booking, and see it on the calendar", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("Email").fill("staff@example.com");
  await page.getByLabel("Password").fill("password");
  await page.getByRole("button", { name: "Sign in" }).click();

  await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible();
  await page.getByRole("link", { name: /Appointments/ }).click();
  await expect(page.getByRole("heading", { name: "Appointments" })).toBeVisible();

  await page.getByRole("button", { name: "Walk-in" }).click();
  await page.getByLabel("Name").fill("Pat Walker");
  await page.getByLabel("Phone").fill("+15550199");
  await page.getByRole("button", { name: "Load slots" }).click();
  await page.getByRole("button", { name: "9:00 AM" }).click();
  await page.getByRole("button", { name: "Create booking" }).click();

  await expect(
    page.getByRole("button", { name: /9:00 AM Cleaning confirmed/ }).first(),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: /Jun .* Cleaning confirmed/ })).toBeVisible();
});
