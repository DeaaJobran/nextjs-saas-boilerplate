"use client";

import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@nextjs-saas/ui";
import {
  BookOpenIcon,
  Building2Icon,
  CreditCardIcon,
  LayoutDashboardIcon,
  MenuIcon,
  SettingsIcon,
  ShieldIcon,
} from "lucide-react";
import { useState } from "react";

import { Link, usePathname } from "../i18n/navigation";

type ApplicationNavigationKey =
  "admin" | "billing" | "dashboard" | "organization" | "settings";

export type ApplicationNavigationItem = {
  href: string;
  key: ApplicationNavigationKey;
  label: string;
};

export type MarketingNavigationItem = {
  href: string;
  key: "api" | "contact" | "home" | "pricing";
  label: string;
};

const applicationIcons = {
  admin: ShieldIcon,
  billing: CreditCardIcon,
  dashboard: LayoutDashboardIcon,
  organization: Building2Icon,
  settings: SettingsIcon,
} satisfies Record<ApplicationNavigationKey, typeof LayoutDashboardIcon>;

function isRouteActive(pathname: string, href: string) {
  return href === "/"
    ? pathname === href
    : pathname === href || pathname.startsWith(`${href}/`);
}

function getActiveHref<TItem extends { href: string }>(
  pathname: string,
  items: TItem[],
) {
  return items
    .filter((item) => isRouteActive(pathname, item.href))
    .sort((left, right) => right.href.length - left.href.length)[0]?.href;
}

export function MarketingNavigation({
  closeLabel,
  description,
  items,
  menuLabel,
  navigationLabel,
  title,
}: {
  closeLabel: string;
  description: string;
  items: MarketingNavigationItem[];
  menuLabel: string;
  navigationLabel: string;
  title: string;
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const activeHref = getActiveHref(pathname, items);

  return (
    <>
      <nav
        aria-label={navigationLabel}
        className="hidden items-center gap-1 md:flex"
      >
        {items.map((item) => (
          <Button
            asChild
            key={item.key}
            variant={activeHref === item.href ? "secondary" : "ghost"}
          >
            <Link
              aria-current={activeHref === item.href ? "page" : undefined}
              href={item.href}
            >
              {item.key === "api" ? (
                <BookOpenIcon aria-hidden="true" className="size-4" />
              ) : null}
              {item.label}
            </Link>
          </Button>
        ))}
      </nav>
      <Dialog onOpenChange={setOpen} open={open}>
        <DialogTrigger asChild>
          <Button
            aria-label={menuLabel}
            className="md:hidden"
            size="icon"
            type="button"
            variant="ghost"
          >
            <MenuIcon aria-hidden="true" className="size-5" />
          </Button>
        </DialogTrigger>
        <DialogContent closeLabel={closeLabel}>
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
            <DialogDescription>{description}</DialogDescription>
          </DialogHeader>
          <nav aria-label={navigationLabel} className="grid gap-2 pt-2">
            {items.map((item) => (
              <Button
                asChild
                className="justify-start"
                key={item.key}
                variant={activeHref === item.href ? "secondary" : "ghost"}
              >
                <Link
                  aria-current={activeHref === item.href ? "page" : undefined}
                  href={item.href}
                  onClick={() => setOpen(false)}
                >
                  {item.label}
                </Link>
              </Button>
            ))}
          </nav>
        </DialogContent>
      </Dialog>
    </>
  );
}

export function ApplicationNavigation({
  items,
  mobileNavigationLabel,
  navigationLabel,
  variant,
}: {
  items: ApplicationNavigationItem[];
  mobileNavigationLabel: string;
  navigationLabel: string;
  variant: "desktop" | "mobile";
}) {
  const pathname = usePathname();
  const activeHref = getActiveHref(pathname, items);

  if (variant === "desktop") {
    return (
      <nav aria-label={navigationLabel} className="grid gap-1 p-3">
        {items.map((item) => {
          const Icon = applicationIcons[item.key];
          const active = item.href === activeHref;

          return (
            <Button
              asChild
              className="justify-start"
              key={item.key}
              variant={active ? "secondary" : "ghost"}
            >
              <Link aria-current={active ? "page" : undefined} href={item.href}>
                <Icon aria-hidden="true" className="size-4" />
                {item.label}
              </Link>
            </Button>
          );
        })}
      </nav>
    );
  }

  return (
    <nav
      aria-label={mobileNavigationLabel}
      className="bg-background/95 fixed inset-x-0 bottom-0 z-40 border-t px-2 pt-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] backdrop-blur lg:hidden"
    >
      <div
        className="grid gap-1"
        style={{
          gridTemplateColumns: `repeat(${items.length}, minmax(0, 1fr))`,
        }}
      >
        {items.map((item) => {
          const Icon = applicationIcons[item.key];
          const active = item.href === activeHref;

          return (
            <Button
              asChild
              className="h-auto min-h-14 flex-col gap-1 px-1 py-2 text-center text-xs leading-tight whitespace-normal"
              key={item.key}
              variant={active ? "secondary" : "ghost"}
            >
              <Link aria-current={active ? "page" : undefined} href={item.href}>
                <Icon aria-hidden="true" className="size-4" />
                {item.label}
              </Link>
            </Button>
          );
        })}
      </div>
    </nav>
  );
}
