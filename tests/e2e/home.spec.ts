import { expect, type Page, test } from "@playwright/test";

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
  const email = `user-${suffix}@example.test`;
  const address = Array.from({ length: 3 }, () =>
    Math.floor(Math.random() * 256),
  ).join(".");

  await page.setExtraHTTPHeaders({ "x-forwarded-for": `10.${address}` });

  await page.goto("/en/auth/sign-up");
  await page.getByLabel("Display name").fill("Playwright User");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill("StrongPass123");
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page).toHaveURL(/\/en\/dashboard/);

  return { email };
}

async function expectNoHorizontalOverflow(
  page: Page,
  {
    route,
    viewport,
  }: {
    route: string;
    viewport: { height: number; width: number };
  },
) {
  await expect
    .poll(
      () =>
        page.evaluate(
          () => document.documentElement.scrollWidth - window.innerWidth,
        ),
      {
        message: `${route} at ${viewport.width}x${viewport.height} should not overflow horizontally`,
      },
    )
    .toBeLessThanOrEqual(1);
}

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
  await expect(
    page.getByRole("link", { name: "View dashboard" }).first(),
  ).toHaveAttribute("href", "/en/dashboard");
  await expect(
    page.getByRole("link", { name: "Review pricing" }),
  ).toHaveAttribute("href", "/en/pricing");

  await page.goto("/en/auth/sign-up");
  await expect(
    page.getByRole("link", { name: "terms of service" }),
  ).toHaveAttribute("href", "/en/legal/terms");
  await expect(
    page.getByRole("link", { name: "privacy policy" }),
  ).toHaveAttribute("href", "/en/legal/privacy");
});

test("renders dashboard, settings, and admin shells", async ({ page }) => {
  await grantUserAccess(page);

  await page.goto("/en/dashboard");
  await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible();
  await expect(page.getByRole("cell", { name: "storage" })).toBeVisible();

  await page.goto("/en/settings/organization");
  await expect(
    page.getByRole("heading", { name: "Organization profile" }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Team members" }),
  ).toBeVisible();

  await page.goto("/en/settings");
  await expect(
    page.getByRole("heading", { level: 1, name: "Settings" }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Profile settings" }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Security activity" }),
  ).toBeVisible();

  await grantAdminAccess(page);
  await page.goto("/en/admin/content");
  await expect(
    page.getByRole("heading", { level: 1, name: "Admin" }),
  ).toBeVisible();
  await expect(
    page.getByRole("cell", { name: "landing" }).first(),
  ).toBeVisible();
});

test("rotates the browser refresh token when the session cookie expires", async ({
  page,
}) => {
  await grantUserAccess(page);
  const cookiesBefore = await page.context().cookies();
  const refreshBefore = cookiesBefore.find(
    (cookie) => cookie.name === "nextjs_saas_refresh",
  );

  expect(refreshBefore?.value).toBeTruthy();
  await page.context().clearCookies({ name: "nextjs_saas_session" });
  await page.goto("/en/dashboard");
  await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible();

  const cookiesAfter = await page.context().cookies();
  const sessionAfter = cookiesAfter.find(
    (cookie) => cookie.name === "nextjs_saas_session",
  );
  const refreshAfter = cookiesAfter.find(
    (cookie) => cookie.name === "nextjs_saas_refresh",
  );

  expect(sessionAfter?.value).toBeTruthy();
  expect(refreshAfter?.value).toBeTruthy();
  expect(refreshAfter?.value).not.toBe(refreshBefore?.value);
});

test("signs out from the application shell and revokes browser access", async ({
  page,
}) => {
  await grantUserAccess(page);

  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(page).toHaveURL(/\/en\/auth\/sign-in/);

  const authCookies = (await page.context().cookies()).filter((cookie) =>
    ["nextjs_saas_session", "nextjs_saas_refresh"].includes(cookie.name),
  );

  expect(authCookies).toEqual([]);
  await page.goto("/en/dashboard");
  await expect(page).toHaveURL(/\/auth\/sign-in/);
});

test("returns an API authorization error for protected identity routes", async ({
  request,
}) => {
  const response = await request.post("/api/auth/passkeys/register/options", {
    data: "{",
    headers: { "content-type": "application/json" },
  });

  expect(response.status()).toBe(401);
  await expect(response.json()).resolves.toEqual({
    error: {
      code: "unauthorized",
      message: "Authentication is required.",
    },
  });
});

test("rate limits public OAuth authorization by client and provider", async ({
  request,
}) => {
  const statuses: number[] = [];

  for (let attempt = 0; attempt < 11; attempt += 1) {
    const response = await request.post("/api/v1/oauth/authorize", {
      data: {
        codeChallenge: "A".repeat(43),
        provider: "playwright",
        redirectUri: "https://mobile.example.test/oauth/callback",
      },
    });

    statuses.push(response.status());
  }

  expect(statuses.slice(0, 10)).toEqual(Array(10).fill(200));
  expect(statuses[10]).toBe(429);
});

test("binds an OAuth callback to the browser that initiated sign-in", async ({
  browser,
  page,
}) => {
  await page.route("https://identity.example.test/**", (route) =>
    route.fulfill({ body: "Identity provider fixture", status: 200 }),
  );
  await page.goto("/en/auth/sign-in");
  await page
    .getByRole("button", { name: "Continue with Playwright Identity" })
    .click();
  await expect(page).toHaveURL(
    /^https:\/\/identity\.example\.test\/authorize/u,
  );

  const state = new URL(page.url()).searchParams.get("state");
  const stateCookie = (await page.context().cookies()).find((cookie) =>
    cookie.name.startsWith("nextjs_saas_oauth_state_"),
  );

  expect(state).toBeTruthy();
  expect(stateCookie).toMatchObject({
    httpOnly: true,
    path: "/en/auth/oauth/playwright/callback",
    sameSite: "Lax",
  });

  if (!state) {
    throw new Error("OAuth authorization did not include a state value.");
  }

  const otherContext = await browser.newContext();
  const otherPage = await otherContext.newPage();

  try {
    await otherPage.goto(
      `/en/auth/oauth/playwright/callback?code=transferred-code&state=${encodeURIComponent(state)}`,
    );
    await expect(otherPage).toHaveURL(
      /\/en\/auth\/sign-in\?error=oauth_failed/u,
    );
    expect(
      (await otherContext.cookies()).some(
        (cookie) => cookie.name === "nextjs_saas_session",
      ),
    ).toBe(false);
  } finally {
    await otherContext.close();
  }
});

test("renders mobile application navigation", async ({ page }) => {
  await page.setViewportSize({ height: 844, width: 390 });
  await grantUserAccess(page);
  await page.goto("/en/dashboard");

  const mobileNav = page.getByRole("navigation", {
    name: "Mobile application navigation",
  });

  await expect(
    mobileNav.getByRole("link", { name: "Dashboard" }),
  ).toBeVisible();
  await expect(
    mobileNav.getByRole("link", { name: "Organization" }),
  ).toBeVisible();
  await expect(mobileNav.getByRole("link", { name: "Settings" })).toBeVisible();
  await expect(mobileNav.getByRole("link", { name: "Admin" })).toHaveCount(0);
  await expect(
    mobileNav.getByRole("link", { name: "Dashboard" }),
  ).toHaveAttribute("aria-current", "page");

  await mobileNav.getByRole("link", { name: "Settings" }).click();
  await expect(
    page.getByRole("heading", { level: 1, name: "Settings" }),
  ).toBeVisible();
});

test("exposes deployment health and an admin observability dashboard", async ({
  page,
  request,
}, testInfo) => {
  const baseUrl = testInfo.project.use.baseURL;

  if (!baseUrl) {
    throw new Error(
      "The observability E2E test requires a configured base URL.",
    );
  }

  const origin = new URL(baseUrl).origin;
  const liveness = await request.get("/api/v1/health", {
    headers: { origin },
  });
  const readiness = await request.get("/api/v1/readiness", {
    headers: { origin },
  });

  expect(liveness.status()).toBe(200);
  expect(liveness.headers()["access-control-allow-origin"]).toBe(origin);
  expect(await liveness.json()).toMatchObject({
    data: { checks: [], status: "healthy" },
  });
  expect(readiness.status()).toBe(200);
  expect(readiness.headers()["access-control-allow-origin"]).toBe(origin);
  expect(await readiness.json()).toMatchObject({
    data: {
      checks: [{ name: "database", status: "healthy" }],
      status: "healthy",
    },
  });
  await grantAdminAccess(page);
  await page.setViewportSize({ height: 844, width: 390 });
  await page.goto("/en/admin/observability");
  await expect(page.getByText("Dependency health checks")).toBeVisible();
  await expect(page.getByRole("cell", { name: "database" })).toBeVisible();
  await expectNoHorizontalOverflow(page, {
    route: "/en/admin/observability",
    viewport: { height: 844, width: 390 },
  });
});

test("tenant settings can create a tenant API key", async ({ page }) => {
  const keyName = `E2E key ${Date.now()}`;

  await grantUserAccess(page);
  await page.goto("/en/settings/organization");
  const apiKeyForm = page.getByRole("form", { name: "Create API key" });

  await apiKeyForm.getByLabel("Name").fill(keyName);
  await apiKeyForm.getByLabel("Scopes").fill("tenant:read");
  await apiKeyForm.getByRole("button", { name: "Create API key" }).click();

  await expect(page).toHaveURL(/api-key-created/, { timeout: 15_000 });
  await expect(
    page.getByRole("heading", { name: "New API key secret" }),
  ).toBeVisible();
  await expect(page.getByRole("cell", { name: keyName })).toBeVisible();
});

test("super admin can start an audited impersonation session", async ({
  page,
}) => {
  const { email } = await grantUserAccess(page);

  await page.context().clearCookies();
  await grantAdminAccess(page);
  await page.goto("/en/admin/super");
  await page.getByLabel("Member").selectOption({
    label: `Playwright User Workspace / Playwright User / ${email}`,
  });
  await page
    .getByLabel("Reason")
    .fill("Investigate tenant support request from Playwright.");
  await page.getByRole("button", { name: "Start impersonation" }).click();

  await expect(page).toHaveURL(/\/en\/dashboard\?status=impersonation-started/);
  await expect(
    page.getByText(`admin@example.test is impersonating ${email}`),
  ).toBeVisible();
  await expect(
    page.getByRole("cell", { name: "tenant.impersonation.started" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "End impersonation" }).click();
  await expect(page).toHaveURL(
    /\/en\/admin\/super\?status=impersonation-ended/,
    { timeout: 15_000 },
  );
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

test("switches locale while preserving the current public route", async ({
  page,
}) => {
  await page.goto("/en/pricing");
  await page.getByRole("link", { name: "Switch language to العربية" }).click();

  await expect(page).toHaveURL(/\/ar\/pricing$/);
  await expect(page.locator("html")).toHaveAttribute("lang", "ar");
  await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
});

test("persists customer and tenant preferred locales", async ({ page }) => {
  await grantUserAccess(page);
  await page.goto("/en/settings");

  const preferredLocaleSelect = page.getByLabel("Preferred locale");
  const profileForm = preferredLocaleSelect.locator("xpath=ancestor::form");
  await preferredLocaleSelect.selectOption("ar");
  await profileForm.getByRole("button", { name: "Save profile" }).click();

  await expect(page).toHaveURL(/status=profile-updated/, { timeout: 15_000 });
  await expect(page.getByLabel("Preferred locale")).toHaveValue("ar");

  await page.goto("/en/settings/organization");
  const organizationLocaleSelect = page.getByLabel("Default locale");
  const organizationForm = organizationLocaleSelect.locator(
    "xpath=ancestor::form",
  );
  await organizationLocaleSelect.selectOption("ar");
  await organizationForm
    .getByRole("button", { name: "Save organization" })
    .click();

  await expect(page).toHaveURL(/status=organization-updated/);
  await expect(page.getByLabel("Default locale")).toHaveValue("ar");
});

test("persists admin-controlled locale settings", async ({ page }) => {
  await grantAdminAccess(page);
  await page.goto("/en/admin/content");

  const localizationForm = page.getByRole("form", {
    name: "Localization settings",
  });
  const defaultLocaleSelect = localizationForm.getByLabel("Default locale");
  const originalDefaultLocale = await defaultLocaleSelect.inputValue();

  try {
    await defaultLocaleSelect.selectOption("ar");
    await localizationForm
      .getByRole("button", { name: "Save localization settings" })
      .click();

    await expect(page).toHaveURL(/saved=localization/);
    await expect(
      page
        .getByRole("form", { name: "Localization settings" })
        .getByLabel("Default locale"),
    ).toHaveValue("ar");
  } finally {
    await page.goto("/en/admin/content");
    const restoreForm = page.getByRole("form", {
      name: "Localization settings",
    });
    await restoreForm
      .getByLabel("Default locale")
      .selectOption(originalDefaultLocale);
    await restoreForm
      .getByRole("button", { name: "Save localization settings" })
      .click();
    await expect(page).toHaveURL(/saved=localization/);
  }
});

test("keeps Arabic RTL core layouts within the viewport", async ({ page }) => {
  const publicRoutes = [
    "/ar",
    "/ar/pricing",
    "/ar/contact",
    "/ar/auth/sign-in",
  ];

  for (const viewport of [
    { height: 844, width: 390 },
    { height: 900, width: 1280 },
  ]) {
    await page.setViewportSize(viewport);

    for (const route of publicRoutes) {
      await page.goto(route);
      await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
      await expectNoHorizontalOverflow(page, { route, viewport });
    }
  }

  await grantUserAccess(page);
  await page.setViewportSize({ height: 844, width: 390 });
  await page.goto("/ar/dashboard");
  await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
  await expectNoHorizontalOverflow(page, {
    route: "/ar/dashboard",
    viewport: { height: 844, width: 390 },
  });
});

test("admin-managed content can create, update, and render a legal page", async ({
  page,
}) => {
  const slug = `e2e-${Date.now()}`;
  const initialTitle = `E2E Legal ${slug}`;
  const updatedTitle = `Updated Legal ${slug}`;
  const createForm = page.getByRole("form", { name: "Create managed page" });
  const editForm = page.getByRole("form", { name: "Edit managed page" });

  await grantAdminAccess(page);
  await page.goto("/en/admin/content");
  await createForm.getByLabel("Type").selectOption("legal");
  await createForm.getByLabel("Publish state").selectOption("published");
  await createForm.getByLabel("Slug").fill(slug);
  await createForm.getByLabel("Title").fill(initialTitle);
  await createForm
    .getByLabel("Description")
    .fill("Managed legal page created from the admin dashboard.");
  await createForm
    .getByLabel("First section body")
    .fill("This legal content is persisted through the database.");
  await createForm.getByRole("button", { name: "Create page" }).click();

  await expect(page).toHaveURL(/saved=page/);
  await editForm.locator('input[name="title"]').fill(updatedTitle);
  await editForm.getByRole("button", { name: "Save page" }).click();

  await expect(page.getByRole("cell", { name: updatedTitle })).toBeVisible();
  await page.goto(`/en/legal/${slug}`);
  await expect(
    page.getByRole("heading", { level: 1, name: updatedTitle }),
  ).toBeVisible();
});

test("contact submissions are validated, saved, and visible in admin", async ({
  page,
}) => {
  const email = `contact-${Date.now()}@example.com`;
  const repeatedEmail = `contact-repeat-${Date.now()}@example.com`;
  const contactForm = page.getByRole("form", { name: "Contact request" });

  await page.goto("/en/contact");
  await contactForm.getByLabel("Name").fill("Content Reviewer");
  await contactForm.getByLabel("Email").fill(email);
  await contactForm
    .getByLabel("Message")
    .fill("Please review this saved contact request from Playwright.");
  await contactForm.getByRole("button", { name: "Submit" }).click();

  await expect(
    page
      .locator('[role="status"]')
      .filter({ hasText: "saved for review" })
      .first(),
  ).toBeVisible();
  await expect(page.locator('[data-slot="toast"]')).toContainText(
    "Message sent",
  );
  await expect(contactForm.getByLabel("Name")).toHaveValue("");
  await expect(contactForm.getByLabel("Email")).toHaveValue("");
  await expect(contactForm.getByLabel("Message")).toHaveValue("");

  await contactForm.getByLabel("Name").fill("Repeat Reviewer");
  await contactForm.getByLabel("Email").fill(repeatedEmail);
  await contactForm
    .getByLabel("Message")
    .fill("Please save this second contact request as a separate result.");
  await contactForm.getByRole("button", { name: "Submit" }).click();

  await expect(contactForm.getByLabel("Name")).toHaveValue("");
  await expect(contactForm.getByLabel("Email")).toHaveValue("");
  await expect(contactForm.getByLabel("Message")).toHaveValue("");

  await grantAdminAccess(page);
  await page.goto("/en/admin/content");
  await expect(page.getByRole("cell", { name: email })).toBeVisible();
  await expect(page.getByRole("cell", { name: repeatedEmail })).toBeVisible();
});

test("published pricing content renders and draft pricing navigation stays hidden", async ({
  page,
}) => {
  const planName = `E2E Plan ${Date.now()}`;
  const pricingForm = page.getByRole("form", { name: "Pricing plans" });
  const managedPageForm = page.getByRole("form", {
    name: "Edit managed page",
  });

  await grantAdminAccess(page);
  await page.goto("/en/admin/content?selected=pricing-en");
  await pricingForm.locator('input[name="plan.0.name"]').fill(planName);
  await pricingForm.getByRole("button", { name: "Save pricing plans" }).click();

  await expect(page).toHaveURL(/saved=pricing/);
  await page.goto("/en/pricing");
  await expect(page.getByRole("heading", { name: planName })).toBeVisible();

  try {
    await page.goto("/en/admin/content?selected=pricing-en");
    await managedPageForm.getByLabel("Publish state").selectOption("draft");
    await managedPageForm.getByRole("button", { name: "Save page" }).click();
    await expect(page).toHaveURL(/saved=page/);

    await page.goto("/en/contact");
    await expect(
      page
        .getByRole("navigation", { name: "Main navigation" })
        .getByRole("link", { name: "Pricing", exact: true }),
    ).toHaveCount(0);
  } finally {
    await page.goto("/en/admin/content?selected=pricing-en");
    await managedPageForm.getByLabel("Publish state").selectOption("published");
    await managedPageForm.getByRole("button", { name: "Save page" }).click();
    await expect(page).toHaveURL(/saved=page/);
  }
});

test("admin-managed contact fields render on the contact page", async ({
  page,
}) => {
  const fieldLabel = `Reference ${Date.now()}`;
  const contactSettings = page.getByRole("form", { name: "Contact settings" });

  await grantAdminAccess(page);
  await page.goto("/en/admin/content?selected=contact-ar");
  await contactSettings.getByRole("button", { name: "Add field" }).click();
  await contactSettings.locator('input[name="field.3.label"]').fill(fieldLabel);
  await contactSettings
    .getByRole("button", { name: "Save contact settings" })
    .click();

  await expect(page).toHaveURL(/saved=contact/);
  await page.goto("/ar/contact");
  await expect(
    page
      .getByRole("form", { name: "طلب تواصل" })
      .getByLabel(fieldLabel)
      .first(),
  ).toBeVisible();
});

test("keeps public navigation reachable and active on small screens", async ({
  page,
}) => {
  await page.setViewportSize({ height: 667, width: 375 });
  await page.goto("/en/pricing");

  await page.getByRole("button", { name: "Open main navigation" }).click();
  const dialog = page.getByRole("dialog", { name: "Explore the site" });

  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole("link", { name: "Pricing" })).toHaveAttribute(
    "aria-current",
    "page",
  );
  await dialog.getByRole("link", { name: "Contact" }).click();
  await expect(page).toHaveURL(/\/en\/contact/);
  await expectNoHorizontalOverflow(page, {
    route: "/en/contact",
    viewport: { height: 667, width: 375 },
  });
});

test("provides a keyboard skip link and persistent localized themes", async ({
  page,
}) => {
  await page.emulateMedia({ colorScheme: "light", reducedMotion: "reduce" });
  await page.goto("/en");
  await page.keyboard.press("Tab");

  const skipLink = page.getByRole("link", { name: "Skip to main content" });
  await expect(skipLink).toBeFocused();
  await skipLink.press("Enter");
  await expect(page.locator("#main-content")).toBeFocused();

  await page.getByRole("button", { name: "Switch to dark mode" }).click();
  await expect(page.locator("html")).toHaveClass(/dark/);
  await expect(
    page.getByRole("button", { name: "Switch to light mode" }),
  ).toBeEnabled();
  await page.getByRole("button", { name: "Switch to light mode" }).click();
  await expect(page.locator("html")).not.toHaveClass(/dark/);
  await page.getByRole("button", { name: "Switch to dark mode" }).click();
  await expect(page.locator("html")).toHaveClass(/dark/);
  await expect
    .poll(() => page.evaluate(() => window.localStorage.getItem("theme")))
    .toBe("dark");
  await page.reload();
  await expect(page.locator("html")).toHaveClass(/dark/);

  await page.goto("/ar");
  await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
  await expect(page.locator('[data-slot="toast-viewport"]')).toHaveAttribute(
    "data-swipe-direction",
    "left",
  );
  await expect
    .poll(() => page.evaluate(() => window.localStorage.getItem("theme")))
    .toBe("dark");
  await expect(page.locator("html")).toHaveClass(/dark/);
  await page.getByRole("button", { name: "التبديل إلى الوضع الفاتح" }).click();
  await expect(page.locator("html")).not.toHaveClass(/dark/);
});

test("renders live accessible charts, empty states, and confirmation dialogs", async ({
  page,
}) => {
  await grantUserAccess(page);
  await page.goto("/en/dashboard");

  await expect(page.locator('meta[name="robots"]')).toHaveAttribute(
    "content",
    /noindex/,
  );

  await expect(
    page.getByRole("img", { name: /Workspace resource overview/ }),
  ).toBeVisible();
  await expect(
    page.getByRole("table", { name: "Workspace resource overview" }),
  ).toBeAttached();
  const zeroValueBars = page.locator(
    '[data-slot="metric-bar"][data-value="0"]',
  );
  await expect(zeroValueBars).toHaveCount(2);
  await expect(zeroValueBars.first()).toHaveAttribute("style", /width:\s*0%/);

  await page.goto("/en/settings");
  await expect(
    page.getByRole("heading", {
      name: "No in-app notifications are available.",
    }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Delete account", exact: true })
    .click();

  const dialog = page.getByRole("dialog", {
    name: "Permanently delete account",
  });
  await expect(dialog).toBeVisible();
  await dialog.getByRole("button", { name: "Cancel" }).click();
  await expect(dialog).not.toBeVisible();
});

test("publishes crawlable metadata without exposing private routes", async ({
  page,
  request,
}) => {
  await page.goto("/en");

  await expect(page.locator('meta[property="og:title"]')).toHaveAttribute(
    "content",
    /Next\.js SaaS Boilerplate/,
  );
  const jsonLd = await page
    .locator('script[type="application/ld+json"]')
    .textContent();
  expect(jsonLd).toContain('"@type":"SoftwareApplication"');

  const [sitemapResponse, robotsResponse] = await Promise.all([
    request.get("/sitemap.xml"),
    request.get("/robots.txt"),
  ]);
  const sitemap = await sitemapResponse.text();
  const robots = await robotsResponse.text();

  expect(sitemapResponse.ok()).toBe(true);
  expect(sitemap).toContain("/en/pricing");
  expect(sitemap).not.toContain("/en/dashboard");
  expect(sitemap).not.toContain("/en/settings");
  expect(sitemap).not.toContain("/en/admin");
  expect(robotsResponse.ok()).toBe(true);
  expect(robots).toContain("Disallow: /en/dashboard");
  expect(robots).toContain("Disallow: /ar/dashboard");
  expect(robots).not.toContain("Disallow: /*/dashboard");
  expect(robots).toContain("Disallow: /api/");
});

test("renders localized route states and no-indexes authentication", async ({
  page,
}) => {
  await page.goto("/en/legal/does-not-exist");
  await expect(
    page.getByRole("heading", { name: "Page not found" }),
  ).toBeVisible();
  await expect(page.getByRole("link", { name: "Return home" })).toHaveAttribute(
    "href",
    "/en",
  );

  await page.goto("/en/auth/sign-in");
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute(
    "content",
    /noindex/,
  );
});
