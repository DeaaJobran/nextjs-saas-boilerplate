import AxeBuilder from "@axe-core/playwright";
import { expect, type Page, test } from "@playwright/test";

const routes = ["/en", "/en/dashboard", "/en/admin/content", "/ar"];

async function grantAdminAccess(page: Page) {
  await page.context().addCookies([
    {
      name: "nextjs_saas_admin_session",
      url: "http://127.0.0.1:3000",
      value: "playwright-admin",
    },
  ]);
}

async function grantUserAccess(page: Page) {
  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2)}`;

  await page.goto("/en/auth/sign-up");
  await page.getByLabel("Display name").fill("A11y User");
  await page.getByLabel("Email").fill(`a11y-${suffix}@example.test`);
  await page.getByLabel("Password").fill("StrongPass123");
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page).toHaveURL(/\/en\/dashboard/);
}

for (const route of routes) {
  test(`${route} has no critical accessibility violations`, async ({
    page,
  }) => {
    if (route.includes("/dashboard")) {
      await grantUserAccess(page);
    }

    if (route.includes("/admin")) {
      await grantAdminAccess(page);
    }

    await page.goto(route);

    const results = await new AxeBuilder({ page }).analyze();
    const seriousViolations = results.violations.filter((violation) =>
      ["critical", "serious"].includes(violation.impact ?? ""),
    );

    expect(seriousViolations).toEqual([]);
  });
}
