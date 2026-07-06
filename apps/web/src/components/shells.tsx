import { appConfig, appRoutes } from "@nextjs-saas/config/app";
import type { Locale } from "@nextjs-saas/localization";
import { Button } from "@nextjs-saas/ui";
import {
  BarChart3Icon,
  Building2Icon,
  GaugeIcon,
  LayoutDashboardIcon,
  SettingsIcon,
  ShieldIcon,
  UsersIcon,
} from "lucide-react";
import { getTranslations } from "next-intl/server";

import { Link } from "../i18n/navigation";
import { getContentRepository } from "../lib/content-store";
import { LocaleSwitcher } from "./locale-switcher";
import { ThemeToggle } from "./theme-toggle";

const appNav = [
  {
    href: appRoutes.dashboard,
    icon: LayoutDashboardIcon,
    labelKey: "dashboard",
  },
  {
    href: appRoutes.organizationSettings,
    icon: Building2Icon,
    labelKey: "organization",
  },
  { href: appRoutes.settings, icon: SettingsIcon, labelKey: "settings" },
  { href: appRoutes.admin, icon: ShieldIcon, labelKey: "admin" },
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

  return (
    <div className="bg-background min-h-dvh">
      <header className="bg-background/90 sticky top-0 z-40 border-b backdrop-blur">
        <div className="mx-auto flex min-h-16 w-full max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-2 sm:flex-nowrap sm:gap-4 sm:px-6 lg:px-8">
          <Link
            className="max-w-24 min-w-0 truncate font-semibold sm:max-w-none"
            href={appRoutes.marketing}
          >
            {appConfig.shortName}
          </Link>
          <nav
            aria-label={shellT("mainNavigation")}
            className="hidden items-center gap-1 md:flex"
          >
            <Button asChild variant="ghost">
              <Link href={appRoutes.marketing}>{t("home")}</Link>
            </Button>
            <Button asChild variant="ghost">
              <Link href={appRoutes.pricing}>{t("pricing")}</Link>
            </Button>
            <Button asChild variant="ghost">
              <Link href={appRoutes.contact}>{t("contact")}</Link>
            </Button>
          </nav>
          <div className="flex shrink-0 items-center gap-1 sm:gap-2">
            <ThemeToggle />
            <LocaleSwitcher availableLocales={availableLocales} />
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
  const [t, shellT] = await Promise.all([
    getTranslations({ locale, namespace: "Navigation" }),
    getTranslations({ locale, namespace: "Shell" }),
  ]);

  return (
    <main className="bg-background grid min-h-dvh lg:grid-cols-[minmax(0,1fr)_minmax(24rem,34rem)]">
      <section className="bg-muted/40 hidden border-e p-10 lg:flex lg:flex-col lg:justify-between">
        <Link className="font-semibold" href={appRoutes.marketing}>
          {appConfig.shortName}
        </Link>
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
  tenantControls,
  title,
}: {
  children: React.ReactNode;
  impersonationNotice?: string;
  locale: Locale;
  tenantControls?: React.ReactNode;
  title: string;
}) {
  const [t, shellT, repository] = await Promise.all([
    getTranslations({ locale, namespace: "Navigation" }),
    getTranslations({ locale, namespace: "Shell" }),
    getContentRepository(),
  ]);
  const availableLocales = repository.listEnabledLocales();

  return (
    <div className="bg-muted/30 min-h-dvh lg:grid lg:grid-cols-[16rem_minmax(0,1fr)]">
      <aside className="bg-background hidden border-e lg:block">
        <div className="flex h-16 items-center border-b px-5 font-semibold">
          {appConfig.shortName}
        </div>
        <nav
          aria-label={shellT("applicationNavigation")}
          className="grid gap-1 p-3"
        >
          {appNav.map((item) => {
            const Icon = item.icon;
            return (
              <Button
                asChild
                className="justify-start"
                key={item.href}
                variant="ghost"
              >
                <Link href={item.href}>
                  <Icon aria-hidden="true" className="size-4" />
                  {t(item.labelKey)}
                </Link>
              </Button>
            );
          })}
        </nav>
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
        <main className="mx-auto w-full max-w-7xl p-4 pb-24 sm:p-6 sm:pb-24 lg:p-8">
          {children}
        </main>
      </div>
      <nav
        aria-label={shellT("mobileApplicationNavigation")}
        className="bg-background/95 fixed inset-x-0 bottom-0 z-40 border-t p-2 backdrop-blur lg:hidden"
      >
        <div className="grid grid-cols-4 gap-1">
          {appNav.map((item) => {
            const Icon = item.icon;

            return (
              <Button
                asChild
                className="h-auto min-h-14 flex-col gap-1 px-2 py-2 text-xs"
                key={item.href}
                variant="ghost"
              >
                <Link href={item.href}>
                  <Icon aria-hidden="true" className="size-4" />
                  {t(item.labelKey)}
                </Link>
              </Button>
            );
          })}
        </div>
      </nav>
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
    <DashboardShell locale={locale} title={navigationT("admin")}>
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
