import { appConfig } from "@nextjs-saas/config/app";

type DocsLocale = (typeof appConfig.locales)[number];

type DocsHomeContent = {
  badge: string;
  description: string;
  direction: "ltr" | "rtl";
  locale: DocsLocale;
  metadataDescription: string;
  sections: Array<{
    body: string;
    key: "architecture" | "extensions" | "setup" | "upgrades";
    title: string;
  }>;
  title: string;
};

const docsHomeContent = {
  ar: {
    badge: "توثيق الإصدار 0.3.0",
    description:
      "تتوفر هنا أدلة الإعداد العامة ومراجع الوحدات وملاحظات الترقية بوصفها توثيقا متتبعا للمشروع.",
    direction: "rtl",
    locale: "ar",
    metadataDescription:
      "أدلة الإعداد العامة ومراجع الوحدات وملاحظات الترقية لقالب البرمجيات كخدمة.",
    sections: [
      {
        body: "يستخدم التطوير المحلي pnpm وخدمات Docker Compose وترحيلات قاعدة البيانات وبيانات المحتوى المُدار الأولية.",
        key: "setup",
        title: "الإعداد",
      },
      {
        body: "تضم مساحة العمل تطبيقي الويب والتوثيق، إضافة إلى حزم واجهة API والمصادقة والفوترة والتهيئة وقاعدة البيانات والبريد والمهام والتوطين والمراقبة والأمان والتخزين والمستأجر وواجهة المستخدم.",
        key: "architecture",
        title: "البنية",
      },
      {
        body: "توضح أدلة الحزم مسارات إجراءات المصادقة ومحولات الدفع وOAuth والتوطين وموفري التخزين والمراسلة ونقاط التكامل التشغيلية.",
        key: "extensions",
        title: "نقاط التوسعة",
      },
      {
        body: "توثق وسوم الإصدارات ومدخلات سجل التغييرات مراحل الأساس وتوقعات الترقية للمشروعات المعتمدة عليه.",
        key: "upgrades",
        title: "ملاحظات الترقية",
      },
    ],
    title: "التوثيق",
  },
  en: {
    badge: "v0.3.0 docs",
    description:
      "Public setup guides, module references, and upgrade notes live here as tracked project documentation.",
    direction: "ltr",
    locale: "en",
    metadataDescription:
      "Public setup guides, module references, and upgrade notes for the SaaS boilerplate.",
    sections: [
      {
        body: "Local development uses pnpm, Docker Compose services, database migrations, and managed content seed data.",
        key: "setup",
        title: "Setup",
      },
      {
        body: "The workspace includes web and docs apps plus API, auth, billing, config, database, email, jobs, localization, observability, security, storage, tenant, and UI packages.",
        key: "architecture",
        title: "Architecture",
      },
      {
        body: "Package guides document auth action routes, payment and OAuth adapters, localization, storage providers, messaging providers, and operational hooks.",
        key: "extensions",
        title: "Extension points",
      },
      {
        body: "Release tags and changelog entries document foundation milestones and downstream upgrade expectations.",
        key: "upgrades",
        title: "Upgrade notes",
      },
    ],
    title: "documentation",
  },
} satisfies Record<DocsLocale, DocsHomeContent>;

export function getDocsHomeContent(
  locale: DocsLocale = appConfig.defaultLocale,
) {
  return docsHomeContent[locale];
}
