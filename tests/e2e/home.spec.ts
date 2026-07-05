import { expect, test } from "@playwright/test";

test("renders the starter page", async ({ page }) => {
  await page.goto("/");

  await expect(
    page.getByRole("heading", {
      name: "To get started, edit the page.tsx file.",
    }),
  ).toBeVisible();
  await expect(page.getByRole("link", { name: "Documentation" })).toBeVisible();
});
