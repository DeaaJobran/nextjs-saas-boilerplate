import { expect, test } from "@playwright/test";

test("renders the localized marketing page", async ({ page }) => {
  await page.goto("/");

  await expect(
    page.getByRole("heading", {
      level: 1,
      name: "A serious foundation for modern SaaS products.",
    }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { exact: true, name: "Pricing" }),
  ).toBeVisible();
});

test("renders dashboard, settings, and admin shells", async ({ page }) => {
  await page.goto("/en/dashboard");
  await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Demo activity" }),
  ).toBeVisible();

  await page.goto("/en/settings");
  await expect(
    page.getByRole("heading", { level: 1, name: "Settings" }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Profile settings" }),
  ).toBeVisible();

  await page.goto("/en/admin/content");
  await expect(
    page.getByRole("heading", { level: 1, name: "Admin" }),
  ).toBeVisible();
  await expect(
    page.getByRole("cell", { name: "landing" }).first(),
  ).toBeVisible();
});

test("supports Arabic RTL routes", async ({ page }) => {
  await page.goto("/ar");

  await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
  await expect(
    page.getByRole("heading", {
      level: 1,
      name: "أساس قوي لبناء منتجات SaaS حديثة.",
    }),
  ).toBeVisible();
});
