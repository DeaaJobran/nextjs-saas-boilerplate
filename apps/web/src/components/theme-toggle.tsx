"use client";

import { Button } from "@nextjs-saas/ui";
import { MoonIcon, SunIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useTheme } from "next-themes";
import { useSyncExternalStore } from "react";

const subscribeToHydration = () => () => undefined;

export function ThemeToggle() {
  const { resolvedTheme, setTheme, theme } = useTheme();
  const mounted = useSyncExternalStore(
    subscribeToHydration,
    () => true,
    () => false,
  );
  const t = useTranslations("Theme");

  const renderedTheme = mounted
    ? theme === "system"
      ? resolvedTheme
      : theme
    : undefined;
  const hasResolvedTheme =
    renderedTheme === "dark" || renderedTheme === "light";
  const nextTheme = renderedTheme === "dark" ? "light" : "dark";

  return (
    <Button
      aria-label={t("switch", { theme: t(nextTheme) })}
      disabled={!hasResolvedTheme}
      onClick={() => setTheme(nextTheme)}
      size="icon"
      type="button"
      variant="ghost"
    >
      <SunIcon aria-hidden="true" className="size-4 dark:hidden" />
      <MoonIcon aria-hidden="true" className="hidden size-4 dark:block" />
    </Button>
  );
}
