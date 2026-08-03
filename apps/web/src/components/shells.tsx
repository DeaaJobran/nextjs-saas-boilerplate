import { appConfig, appRoutes } from "@nextjs-saas/config/app";
import type { Locale } from "@nextjs-saas/localization";
import { Button } from "@nextjs-saas/ui";
import {
  ActivityIcon,
  BarChart3Icon,
  CreditCardIcon,
  GaugeIcon,
  ShieldIcon,
  UsersIcon,
} from "lucide-react";
import { getTranslations } from "next-intl/server";

import { Link } from "../i18n/navigation";
import { getContentRepository } from "../lib/content-store";
import { listCanonicalPublicManagedPages } from "../lib/public-content";
import { getManagedPageRoute, getPublicRecoveryRoute } from "../lib/seo-routes";
import { LocaleSwitcher } from "./locale-switcher";
import {
  ApplicationNavigation,
  type ApplicationNavigationItem,
  MarketingNavigation,
  type MarketingNavigationItem,
} from "./navigation";
import { ThemeToggle } from "./theme-toggle";

const applicationNavigation = [
  {
    href: appRoutes.dashboard,
    key: "dashboard",
  },
  {
    href: appRoutes.organizationSettings,
    key: "organization",
  },
  {
    href: appRoutes.billingSettings,
    key: "billing",
  },
  { href: appRoutes.settings, key: "settings" },
  { href: appRoutes.admin, key: "admin" },
] as const;

const managedMarketingNavigation = [
  { href: appRoutes.marketing, key: "home", kind: "landing" },
  { href: appRoutes.pricing, key: "pricing", kind: "pricing" },
  { href: appRoutes.contact, key: "contact", kind: "contact" },
] as const;

export async function MarketingShell({
  children,
  locale,
}: {
  children: React.ReactNode;
  locale: Locale;
}) {
  const [t, shellT, repository] = await Promise.all([
    getTranslations({ locale, namespace: "Navigation" }),
    getTranslations({ locale, namespace: "Shell" }),
    getContentRepository(),
  ]);
  const availableLocales = repository.listEnabledLocales();
  const publicManagedPages = listCanonicalPublicManagedPages(
    repository.listAllPages(),
  );
  const publicManagedNavigation = managedMarketingNavigation.filter((item) =>
    publicManagedPages.some(
      (page) => page.kind === item.kind && page.locale === locale,
    ),
  );
  const managedRoutesByLocale = Object.fromEntries(
    availableLocales.map((availableLocale) => [
      availableLocale,
      [] as string[],
    ]),
  ) as Partial<Record<Locale, string[]>>;

  for (const page of publicManagedPages) {
    managedRoutesByLocale[page.locale]?.push(getManagedPageRoute(page));
  }
  const navigationItems: MarketingNavigationItem[] = [
    ...publicManagedNavigation.map((item) => ({
      href: item.href,
      key: item.key,
      label: t(item.key),
    })),
    { href: appRoutes.apiDocs, key: "api", label: t("api") },
  ];
  const hasPublicLandingPage = publicManagedNavigation.some(
    (item) => item.kind === "landing",
  );

  return (
    <div className="bg-background min-h-dvh">
      <header className="bg-background/90 sticky top-0 z-40 border-b backdrop-blur">
        <div className="mx-auto flex min-h-16 w-full max-w-7xl flex-wrap items-center justify-between gap-2 px-4 py-2 sm:flex-nowrap sm:gap-4 sm:px-6 lg:px-8">
          {hasPublicLandingPage ? (
            <Link
              className="max-w-20 min-w-0 truncate font-semibold sm:max-w-none"
              href={appRoutes.marketing}
            >
              {appConfig.shortName}
            </Link>
          ) : (
            <span className="max-w-20 min-w-0 truncate font-semibold sm:max-w-none">
              {appConfig.shortName}
            </span>
          )}
          <MarketingNavigation
            closeLabel={shellT("closeNavigation")}
            description={shellT("mobileNavigationDescription")}
            items={navigationItems}
            menuLabel={shellT("openNavigation")}
            navigationLabel={shellT("mainNavigation")}
            title={shellT("mobileNavigationTitle")}
          />
          <div className="flex shrink-0 items-center gap-1 sm:gap-2">
            <ThemeToggle />
            <LocaleSwitcher
              availableLocales={availableLocales}
              managedRoutesByLocale={managedRoutesByLocale}
            />
            <Button asChild size="sm">
              <Link href={appRoutes.signIn}>{t("signIn")}</Link>
            </Button>
          </div>
        </div>
      </header>
      {children}
    </div>
  );
}

export async function AuthShell({
  children,
  locale,
}: {
  children: React.ReactNode;
  locale: Locale;
}) {
  const [t, shellT, repository] = await Promise.all([
    getTranslations({ locale, namespace: "Navigation" }),
    getTranslations({ locale, namespace: "Shell" }),
    getContentRepository(),
  ]);
  const recoveryRoute = getPublicRecoveryRoute(
    repository.listPages(locale),
    locale,
  );

  return (
    <main
      className="bg-background grid min-h-dvh lg:grid-cols-[minmax(0,1fr)_minmax(24rem,34rem)]"
      id="main-content"
      tabIndex={-1}
    >
      <section className="bg-muted/40 hidden border-e p-10 lg:flex lg:flex-col lg:justify-between">
        {recoveryRoute ? (
          <Link className="font-semibold" href={recoveryRoute}>
            {appConfig.shortName}
          </Link>
        ) : (
          <span className="font-semibold">{appConfig.shortName}</span>
        )}
        <div className="max-w-lg space-y-4">
          <p className="text-primary text-sm font-medium">{t("signIn")}</p>
          <h1 className="text-3xl font-semibold tracking-tight">
            {shellT("authTitle")}
          </h1>
          <p className="text-muted-foreground">{shellT("authDescription")}</p>
        </div>
      </section>
      <section className="flex min-h-dvh items-center justify-center p-4 sm:p-8">
        {children}
      </section>
    </main>
  );
}

export async function DashboardShell({
  children,
  impersonationNotice,
  locale,
  showAdmin = false,
  tenantControls,
  title,
}: {
  children: React.ReactNode;
  impersonationNotice?: string;
  locale: Locale;
  showAdmin?: boolean;
  tenantControls?: React.ReactNode;
  title: string;
}) {
  const [t, shellT, repository] = await Promise.all([
    getTranslations({ locale, namespace: "Navigation" }),
    getTranslations({ locale, namespace: "Shell" }),
    getContentRepository(),
  ]);
  const availableLocales = repository.listEnabledLocales();
  const navigationItems: ApplicationNavigationItem[] = applicationNavigation
    .filter((item) => showAdmin || item.key !== "admin")
    .map((item) => ({
      ...item,
      label: t(item.key),
    }));

  return (
    <div className="bg-muted/30 min-h-dvh lg:grid lg:grid-cols-[16rem_minmax(0,1fr)]">
      <aside className="bg-background hidden border-e lg:block">
        <div className="flex h-16 items-center border-b px-5 font-semibold">
          {appConfig.shortName}
        </div>
        <ApplicationNavigation
          items={navigationItems}
          mobileNavigationLabel={shellT("mobileApplicationNavigation")}
          navigationLabel={shellT("applicationNavigation")}
          variant="desktop"
        />
      </aside>
      <div className="min-w-0">
        {impersonationNotice ? (
          <div className="bg-destructive text-destructive-foreground px-4 py-2 text-sm font-medium sm:px-6">
            {impersonationNotice}
          </div>
        ) : null}
        <header className="bg-background/90 sticky top-0 z-30 flex min-h-16 flex-wrap items-center justify-between gap-3 border-b px-4 backdrop-blur sm:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <GaugeIcon aria-hidden="true" className="text-primary size-5" />
            <h1 className="truncate text-lg font-semibold">{title}</h1>
          </div>
          <div className="flex min-w-0 flex-wrap items-center justify-end gap-2">
            {tenantControls}
            <ThemeToggle />
            <LocaleSwitcher availableLocales={availableLocales} />
          </div>
        </header>
        <main
          className="mx-auto w-full max-w-7xl p-4 pb-28 sm:p-6 sm:pb-28 lg:p-8"
          id="main-content"
          tabIndex={-1}
        >
          {children}
        </main>
      </div>
      <ApplicationNavigation
        items={navigationItems}
        mobileNavigationLabel={shellT("mobileApplicationNavigation")}
        navigationLabel={shellT("applicationNavigation")}
        variant="mobile"
      />
    </div>
  );
}

export async function AdminShell({
  children,
  locale,
}: {
  children: React.ReactNode;
  locale: Locale;
}) {
  const [shellT, navigationT] = await Promise.all([
    getTranslations({ locale, namespace: "Shell" }),
    getTranslations({
      locale,
      namespace: "Navigation",
    }),
  ]);

  return (
    <DashboardShell locale={locale} showAdmin title={navigationT("admin")}>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-primary text-sm font-medium">
            {shellT("adminEyebrow")}
          </p>
          <h2 className="text-2xl font-semibold tracking-tight">
            {shellT("adminTitle")}
          </h2>
        </div>
        <Button asChild variant="outline">
          <Link href={`${appRoutes.admin}/content`}>
            <BarChart3Icon aria-hidden="true" className="size-4" />
            {shellT("contentRegistry")}
          </Link>
        </Button>
        <Button asChild variant="outline">
          <Link href={appRoutes.adminBilling}>
            <CreditCardIcon aria-hidden="true" className="size-4" />
            {shellT("billingRegistry")}
          </Link>
        </Button>
        <Button asChild variant="outline">
          <Link href={appRoutes.adminObservability}>
            <ActivityIcon aria-hidden="true" className="size-4" />
            {shellT("observabilityRegistry")}
          </Link>
        </Button>
        <Button asChild variant="outline">
          <Link href={appRoutes.adminUsers}>
            <UsersIcon aria-hidden="true" className="size-4" />
            {shellT("identityRegistry")}
          </Link>
        </Button>
        <Button asChild variant="outline">
          <Link href={appRoutes.adminSuper}>
            <ShieldIcon aria-hidden="true" className="size-4" />
            {shellT("tenantRegistry")}
          </Link>
        </Button>
      </div>
      {children}
    </DashboardShell>
  );
}
