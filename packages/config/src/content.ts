import type { Locale } from "@nextjs-saas/localization";

import { appConfig, appRoutes } from "./app";

export type PublishState = "draft" | "published" | "scheduled" | "archived";

export type PageKind = "landing" | "pricing" | "contact" | "legal";

export type PageSeo = {
  title: string;
  description: string;
  ogImage?: string;
};

export type PageSection = {
  id: string;
  eyebrow?: string;
  title: string;
  body: string;
  items?: string[];
  cta?: {
    label: string;
    href: string;
  };
};

export type ManagedPage = {
  id: string;
  kind: PageKind;
  slug: string;
  locale: Locale;
  title: string;
  description: string;
  seo: PageSeo;
  publishState: PublishState;
  publishedAt?: string;
  updatedAt: string;
  sections: PageSection[];
};

export type PricingPlan = {
  id: string;
  name: string;
  priceLabel: string;
  description: string;
  features: string[];
  ctaLabel: string;
  highlighted?: boolean;
};

export type ContactField = {
  id: string;
  label: string;
  type: "email" | "text" | "textarea";
  required: boolean;
};

export type ContentRepository = {
  listPages(locale: Locale): ManagedPage[];
  getPage(input: {
    kind: PageKind;
    locale: Locale;
    slug?: string;
  }): ManagedPage | undefined;
  listPricingPlans(locale: Locale): PricingPlan[];
  listContactFields(locale: Locale): ContactField[];
};

const updatedAt = "2026-07-06T00:00:00.000Z";

const pages = [
  {
    id: "landing-en",
    kind: "landing",
    slug: "home",
    locale: "en",
    title: appConfig.name,
    description: appConfig.description,
    seo: {
      title: appConfig.name,
      description: appConfig.description,
    },
    publishState: "published",
    publishedAt: updatedAt,
    updatedAt,
    sections: [
      {
        id: "hero",
        eyebrow: "Open-source SaaS starter",
        title: "A serious foundation for modern SaaS products.",
        body: "Ship with a clean App Router architecture, reusable UI primitives, localization, testing, and a path to self-hosted production infrastructure.",
        cta: {
          label: "View dashboard",
          href: appRoutes.dashboard,
        },
      },
      {
        id: "capabilities",
        title: "Built for teams that care about maintainability.",
        body: "Every core surface is designed around configuration, extension points, and verification instead of throwaway demo code.",
        items: [
          "Responsive application layouts",
          "RTL and LTR-ready localization foundation",
          "Reusable form, table, chart, modal, state, and toast primitives",
        ],
      },
    ],
  },
  {
    id: "landing-ar",
    kind: "landing",
    slug: "home",
    locale: "ar",
    title: appConfig.name,
    description:
      "قالب SaaS مفتوح المصدر مبني على Next.js لإطلاق منتجات جادة بسرعة.",
    seo: {
      title: appConfig.name,
      description:
        "قالب SaaS مفتوح المصدر مبني على Next.js مع واجهات مرنة ودعم RTL و LTR.",
    },
    publishState: "published",
    publishedAt: updatedAt,
    updatedAt,
    sections: [
      {
        id: "hero",
        eyebrow: "قالب SaaS مفتوح المصدر",
        title: "أساس قوي لبناء منتجات SaaS حديثة.",
        body: "ابدأ بهيكل App Router نظيف، ومكونات واجهة قابلة لإعادة الاستخدام، ودعم تعريب، واختبارات، ومسار واضح للاستضافة الذاتية.",
        cta: {
          label: "عرض لوحة التحكم",
          href: appRoutes.dashboard,
        },
      },
      {
        id: "capabilities",
        title: "مصمم للفرق التي تهتم بقابلية الصيانة.",
        body: "كل واجهة أساسية مبنية حول الإعدادات ونقاط التوسعة والتحقق بدلا من أمثلة مؤقتة.",
        items: [
          "تخطيطات متجاوبة للتطبيق",
          "أساس تعريب يدعم RTL و LTR",
          "مكونات قابلة لإعادة الاستخدام للنماذج والجداول والرسوم والحوارات والحالات والتنبيهات",
        ],
      },
    ],
  },
  {
    id: "pricing-en",
    kind: "pricing",
    slug: "pricing",
    locale: "en",
    title: "Pricing",
    description: "Transparent starter tiers for demo and entitlement wiring.",
    seo: {
      title: `Pricing | ${appConfig.name}`,
      description: "Plan presentation configured from shared content data.",
    },
    publishState: "published",
    publishedAt: updatedAt,
    updatedAt,
    sections: [
      {
        id: "intro",
        title: "Pricing content is data-driven from day one.",
        body: "Plan cards are rendered from content and billing configuration so real providers can be added behind stable boundaries.",
      },
    ],
  },
  {
    id: "pricing-ar",
    kind: "pricing",
    slug: "pricing",
    locale: "ar",
    title: "الأسعار",
    description: "باقات تجريبية واضحة لعرض الصلاحيات والاشتراكات.",
    seo: {
      title: `الأسعار | ${appConfig.name}`,
      description: "واجهة الأسعار مبنية من بيانات إعدادات مشتركة.",
    },
    publishState: "published",
    publishedAt: updatedAt,
    updatedAt,
    sections: [
      {
        id: "intro",
        title: "محتوى الأسعار مبني على البيانات من البداية.",
        body: "بطاقات الباقات تعرض من إعدادات المحتوى والفوترة حتى يمكن إضافة مزودي الدفع لاحقا خلف حدود ثابتة.",
      },
    ],
  },
  {
    id: "contact-en",
    kind: "contact",
    slug: "contact",
    locale: "en",
    title: "Contact",
    description:
      "A configurable contact surface for product and support flows.",
    seo: {
      title: `Contact | ${appConfig.name}`,
      description:
        "Contact page fields and routing are controlled by shared configuration.",
    },
    publishState: "published",
    publishedAt: updatedAt,
    updatedAt,
    sections: [
      {
        id: "intro",
        title: "Keep contact flows configurable.",
        body: "The form schema, routing intent, copy, and validation labels are centralized so each tenant can eventually customize them.",
      },
    ],
  },
  {
    id: "legal-privacy-en",
    kind: "legal",
    slug: "privacy",
    locale: "en",
    title: "Privacy Policy",
    description: "Versioned legal content placeholder for the boilerplate.",
    seo: {
      title: `Privacy Policy | ${appConfig.name}`,
      description:
        "Versioned legal content rendered through the managed page system.",
    },
    publishState: "published",
    publishedAt: updatedAt,
    updatedAt,
    sections: [
      {
        id: "privacy",
        title: "Privacy content source",
        body: "This starter ships a configurable legal page renderer. Downstream products must replace this content with their own reviewed policy before launch.",
      },
    ],
  },
  {
    id: "legal-privacy-ar",
    kind: "legal",
    slug: "privacy",
    locale: "ar",
    title: "سياسة الخصوصية",
    description: "محتوى قانوني قابل للإصدار داخل القالب.",
    seo: {
      title: `سياسة الخصوصية | ${appConfig.name}`,
      description: "محتوى قانوني بإصدارات يعرض عبر نظام الصفحات المدار.",
    },
    publishState: "published",
    publishedAt: updatedAt,
    updatedAt,
    sections: [
      {
        id: "privacy",
        title: "مصدر محتوى الخصوصية",
        body: "يوفر هذا القالب عارض صفحات قانونية قابل للضبط. يجب على المنتجات المبنية عليه استبدال هذا النص بسياسة مراجعة خاصة بها قبل الإطلاق.",
      },
    ],
  },
] satisfies ManagedPage[];

const pricingPlans = {
  en: [
    {
      id: "starter",
      name: "Starter",
      priceLabel: "$0",
      description: "For evaluating the boilerplate locally.",
      features: [
        "Core app shell",
        "Reusable UI primitives",
        "Localization foundation",
      ],
      ctaLabel: "Start building",
    },
    {
      id: "team",
      name: "Team",
      priceLabel: "Configurable",
      description: "For teams wiring real billing providers.",
      features: ["Tenant-aware shell", "Admin surface", "Provider boundaries"],
      ctaLabel: "Review setup",
      highlighted: true,
    },
  ],
  ar: [
    {
      id: "starter",
      name: "البداية",
      priceLabel: "$0",
      description: "لتجربة القالب محليا.",
      features: [
        "هيكل التطبيق الأساسي",
        "مكونات واجهة قابلة لإعادة الاستخدام",
        "أساس التعريب",
      ],
      ctaLabel: "ابدأ البناء",
    },
    {
      id: "team",
      name: "الفريق",
      priceLabel: "قابل للضبط",
      description: "للفرق التي تربط مزودي فوترة حقيقيين.",
      features: ["هيكل يدعم المستأجرين", "واجهة إدارة", "حدود مزودين واضحة"],
      ctaLabel: "راجع الإعداد",
      highlighted: true,
    },
  ],
} satisfies Record<Locale, PricingPlan[]>;

const contactFields = {
  en: [
    { id: "name", label: "Name", type: "text", required: true },
    { id: "email", label: "Email", type: "email", required: true },
    { id: "message", label: "Message", type: "textarea", required: true },
  ],
  ar: [
    { id: "name", label: "الاسم", type: "text", required: true },
    { id: "email", label: "البريد الإلكتروني", type: "email", required: true },
    { id: "message", label: "الرسالة", type: "textarea", required: true },
  ],
} satisfies Record<Locale, ContactField[]>;

export function createContentRepository(): ContentRepository {
  return {
    listPages(locale) {
      return pages.filter((page) => page.locale === locale);
    },
    getPage({ kind, locale, slug }) {
      return pages.find(
        (page) =>
          page.kind === kind &&
          page.locale === locale &&
          (slug === undefined || page.slug === slug),
      );
    },
    listPricingPlans(locale) {
      return pricingPlans[locale];
    },
    listContactFields(locale) {
      return contactFields[locale];
    },
  };
}
