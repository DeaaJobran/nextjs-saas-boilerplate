import "../globals.css";

import { appConfig } from "@nextjs-saas/config/app";
import { env } from "@nextjs-saas/config/env";
import {
  getLocaleTypographyClassName,
  getTextDirection,
  locales,
} from "@nextjs-saas/localization";
import type { Metadata } from "next";
import { Geist, Geist_Mono, Noto_Sans_Arabic } from "next/font/google";
import { NextIntlClientProvider } from "next-intl";
import { getMessages } from "next-intl/server";

import { assertActiveLocale } from "../../lib/locale";
import { Providers } from "../providers";

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

export const metadata: Metadata = {
  metadataBase: new URL(env.NEXT_PUBLIC_APP_URL),
  title: {
    default: appConfig.name,
    template: `%s | ${appConfig.name}`,
  },
  description: appConfig.description,
};

export function generateStaticParams() {
  return locales.map((locale) => ({ locale }));
}

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale: value } = await params;
  const [locale, messages] = await Promise.all([
    assertActiveLocale(value),
    getMessages(),
  ]);
  const typographyClassName = getLocaleTypographyClassName(locale);

  return (
    <html
      className={`${geistSans.variable} ${geistMono.variable} ${notoArabic.variable} h-full antialiased`}
      dir={getTextDirection(locale)}
      lang={locale}
      suppressHydrationWarning
    >
      <body
        className={`bg-background text-foreground min-h-full ${typographyClassName}`}
      >
        <NextIntlClientProvider messages={messages}>
          <Providers>{children}</Providers>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
