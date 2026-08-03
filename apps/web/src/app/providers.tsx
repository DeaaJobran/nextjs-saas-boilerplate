"use client";

import { ToastProvider } from "@nextjs-saas/ui";
import { ThemeProvider } from "next-themes";

export function Providers({
  children,
  direction,
  toastDismissLabel,
  toastLabel,
}: {
  children: React.ReactNode;
  direction: "ltr" | "rtl";
  toastDismissLabel: string;
  toastLabel: string;
}) {
  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="system"
      disableTransitionOnChange
      enableSystem
    >
      <ToastProvider
        dismissLabel={toastDismissLabel}
        label={toastLabel}
        swipeDirection={direction === "rtl" ? "left" : "right"}
      >
        {children}
      </ToastProvider>
    </ThemeProvider>
  );
}
