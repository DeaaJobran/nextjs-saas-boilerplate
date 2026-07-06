import { expect, test } from "@playwright/test";

async function grantAdminAccess(page: import("@playwright/test").Page) {
  await page.context().addCookies([
    {
      name: "nextjs_saas_admin_session",
      url: "http://127.0.0.1:3000",
      value: "playwright-admin",
    },
  ]);
}

async function grantUserAccess(page: import("@playwright/test").Page) {
  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2)}`;

  await page.goto("/en/auth/sign-up");
  await page.getByLabel("Display name").fill("Responsive User");
  await page.getByLabel("Email").fill(`responsive-${suffix}@example.test`);
  await page.getByLabel("Password").fill("StrongPass123");
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page).toHaveURL(/\/en\/dashboard/);
}

const cases = [
  { height: 740, route: "/en", width: 375 },
  { height: 900, route: "/en/dashboard", width: 768 },
  { height: 900, route: "/en/settings/organization", width: 390 },
  { height: 900, route: "/en/admin/content", width: 1024 },
  { height: 900, route: "/ar", width: 1440 },
];

for (const viewport of cases) {
  test(`${viewport.route} has no horizontal overflow at ${viewport.width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({
      height: viewport.height,
      width: viewport.width,
    });

    if (
      viewport.route.includes("/dashboard") ||
      viewport.route.includes("/settings")
    ) {
      await grantUserAccess(page);
    }

    if (viewport.route.includes("/admin")) {
      await grantAdminAccess(page);
    }

    await page.goto(viewport.route);

    const hasHorizontalOverflow = await page.evaluate(
      () => document.documentElement.scrollWidth > window.innerWidth + 1,
    );

    expect(hasHorizontalOverflow).toBe(false);
  });
}
