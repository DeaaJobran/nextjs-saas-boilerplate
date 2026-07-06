import "./globals.css";

import { appConfig } from "@nextjs-saas/config/app";
import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: `${appConfig.name} Docs`,
  description:
    "Public setup guides, module references, and upgrade notes for the SaaS boilerplate.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html className={`${geistSans.variable} ${geistMono.variable}`} lang="en">
      <body className="min-h-dvh bg-background font-sans text-foreground">
        {children}
      </body>
    </html>
  );
}
