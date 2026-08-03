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
import { getMessages, getTranslations } from "next-intl/server";

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
  const locale = await assertActiveLocale(value);
  const [messages, shellT, toastT] = await Promise.all([
    getMessages(),
    getTranslations({ locale, namespace: "Shell" }),
    getTranslations({ locale, namespace: "Toast" }),
  ]);
  const typographyClassName = getLocaleTypographyClassName(locale);
  const direction = getTextDirection(locale);

  return (
    <html
      className={`${geistSans.variable} ${geistMono.variable} ${notoArabic.variable} h-full antialiased`}
      dir={direction}
      lang={locale}
      suppressHydrationWarning
    >
      <body
        className={`bg-background text-foreground min-h-full ${typographyClassName}`}
      >
        <NextIntlClientProvider messages={messages}>
          <a
            className="bg-primary text-primary-foreground focus-visible:ring-ring fixed start-4 top-4 z-[100] -translate-y-24 rounded-md px-4 py-3 font-medium shadow-lg transition-transform focus:translate-y-0 focus:outline-none focus-visible:ring-2"
            href="#main-content"
          >
            {shellT("skipToContent")}
          </a>
          <Providers
            direction={direction}
            toastDismissLabel={toastT("dismiss")}
            toastLabel={toastT("label")}
          >
            {children}
          </Providers>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
