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

  await page.goto("/en/auth/sign-up");
  await page.getByLabel("Display name").fill("Playwright User");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill("StrongPass123");
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page).toHaveURL(/\/en\/dashboard/);

  return { email };
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

  await grantAdminAccess(page);
  await page.goto("/en/admin/content");
  await expect(
    page.getByRole("heading", { level: 1, name: "Admin" }),
  ).toBeVisible();
  await expect(
    page.getByRole("cell", { name: "landing" }).first(),
  ).toBeVisible();
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
  await expect(mobileNav.getByRole("link", { name: "Admin" })).toBeVisible();

  await mobileNav.getByRole("link", { name: "Settings" }).click();
  await expect(
    page.getByRole("heading", { level: 1, name: "Settings" }),
  ).toBeVisible();
});

test("tenant settings can create a tenant API key", async ({ page }) => {
  const keyName = `E2E key ${Date.now()}`;

  await grantUserAccess(page);
  await page.goto("/en/settings/organization");
  await page.getByLabel("Name").last().fill(keyName);
  await page.getByLabel("Scopes").fill("tenant:read");
  await page.getByRole("button", { name: "Create API key" }).click();

  await expect(page).toHaveURL(/api-key-created/);
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
  const contactForm = page.getByRole("form", { name: "Contact request" });

  await page.goto("/en/contact");
  await contactForm.getByLabel("Name").fill("Content Reviewer");
  await contactForm.getByLabel("Email").fill(email);
  await contactForm
    .getByLabel("Message")
    .fill("Please review this saved contact request from Playwright.");
  await contactForm.getByRole("button", { name: "Submit" }).click();

  await expect(page.getByRole("status")).toContainText("saved for review");

  await grantAdminAccess(page);
  await page.goto("/en/admin/content");
  await expect(page.getByRole("cell", { name: email })).toBeVisible();
});

test("admin-managed pricing plans render on the pricing page", async ({
  page,
}) => {
  const planName = `E2E Plan ${Date.now()}`;
  const pricingForm = page.getByRole("form", { name: "Pricing plans" });

  await grantAdminAccess(page);
  await page.goto("/en/admin/content?selected=pricing-en");
  await pricingForm.locator('input[name="plan.0.name"]').fill(planName);
  await pricingForm.getByRole("button", { name: "Save pricing plans" }).click();

  await expect(page).toHaveURL(/saved=pricing/);
  await page.goto("/en/pricing");
  await expect(page.getByRole("heading", { name: planName })).toBeVisible();
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
