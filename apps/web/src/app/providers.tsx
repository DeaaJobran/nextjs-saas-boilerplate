"use client";

import { ToastProvider } from "@nextjs-saas/ui";
import { ThemeProvider } from "next-themes";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="system"
      disableTransitionOnChange
      enableSystem
    >
      <ToastProvider>{children}</ToastProvider>
    </ThemeProvider>
  );
}
