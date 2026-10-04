import { expect, test } from "@playwright/test";

test("start page shows the brand and switches language", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveTitle(/Sjodur/);
  await expect(page.getByRole("img", { name: "Sjodur" }).first()).toBeVisible();
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Geld");

  await page.getByRole("button", { name: "en" }).click();
  await expect(page.getByRole("heading", { level: 1 })).toContainText("money");
});

test("unknown routes render the error page", async ({ page }) => {
  const response = await page.goto("/gibt-es-nicht");
  expect(response?.status()).toBe(404);
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Seite");
});
