"use client";

import { Button } from "@nextjs-saas/ui";
import { MoonIcon, SunIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useTheme } from "next-themes";

export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  const t = useTranslations("Theme");
  const nextTheme = resolvedTheme === "dark" ? "light" : "dark";

  return (
    <Button
      aria-label={t("switch", { theme: t(nextTheme) })}
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
