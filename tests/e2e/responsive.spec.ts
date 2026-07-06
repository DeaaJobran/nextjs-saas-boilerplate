import { expect, test } from "@playwright/test";

const cases = [
  { height: 740, route: "/en", width: 375 },
  { height: 900, route: "/en/dashboard", width: 768 },
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
    await page.goto(viewport.route);

    const hasHorizontalOverflow = await page.evaluate(
      () => document.documentElement.scrollWidth > window.innerWidth + 1,
    );

    expect(hasHorizontalOverflow).toBe(false);
  });
}
