import "./globals.css";

import { appConfig } from "@nextjs-saas/config/app";
import type { Metadata } from "next";
import { Geist, Geist_Mono, Noto_Sans_Arabic } from "next/font/google";

import { getDocsHomeContent } from "../content";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const notoArabic = Noto_Sans_Arabic({
  variable: "--font-arabic",
  subsets: ["arabic"],
});

const content = getDocsHomeContent();

export const metadata: Metadata = {
  description: content.metadataDescription,
  title: `${appConfig.name} ${content.title}`,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      className={`${geistSans.variable} ${geistMono.variable} ${notoArabic.variable}`}
      dir={content.direction}
      lang={content.locale}
    >
      <body className="min-h-dvh bg-background font-locale text-foreground">
        {children}
      </body>
    </html>
  );
}
