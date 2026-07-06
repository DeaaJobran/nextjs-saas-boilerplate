import {
  defaultLocale,
  type Locale,
  locales,
  uniqueLocales,
} from "@nextjs-saas/localization";
import { z } from "zod";

import { appConfig, appRoutes } from "./app";

export const publishStates = [
  "draft",
  "published",
  "scheduled",
  "archived",
] as const;

export const pageKinds = ["landing", "pricing", "contact", "legal"] as const;

export type PublishState = (typeof publishStates)[number];
export type PageKind = (typeof pageKinds)[number];

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
  version?: string;
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
  minLength?: number;
  maxLength?: number;
};

export type ContactRouting = {
  recipientEmail: string;
  subjectPrefix: string;
  spamProtectionEnabled: boolean;
  successMessage: string;
};

export type ContactSubmission = {
  id: string;
  locale: Locale;
  name: string;
  email: string;
  message: string;
  submittedAt: string;
  status: "new" | "reviewed";
  values: Record<string, string>;
};

export type LocalizationSettings = {
  defaultLocale: Locale;
  enabledLocales: Locale[];
};

export type ContentSnapshot = {
  pages: ManagedPage[];
  pricingPlans: Record<Locale, PricingPlan[]>;
  contactFields: Record<Locale, ContactField[]>;
  contactRouting: Record<Locale, ContactRouting>;
  contactSubmissions: ContactSubmission[];
  localization: LocalizationSettings;
};

export type ContentRepository = {
  getSnapshot(): ContentSnapshot;
  getLocalizationSettings(): LocalizationSettings;
  isLocaleEnabled(locale: Locale): boolean;
  listEnabledLocales(): Locale[];
  listPages(locale: Locale): ManagedPage[];
  listAllPages(): ManagedPage[];
  getPage(input: {
    kind: PageKind;
    locale: Locale;
    slug?: string;
  }): ManagedPage | undefined;
  getPageById(id: string): ManagedPage | undefined;
  listPricingPlans(locale: Locale): PricingPlan[];
  listContactFields(locale: Locale): ContactField[];
  getContactRouting(locale: Locale): ContactRouting;
  listContactSubmissions(locale?: Locale): ContactSubmission[];
};

const nonEmptyString = z.string().trim().min(1);
const isoDateString = z.iso.datetime();

const localeSchema = z.enum(locales);
const publishStateSchema = z.enum(publishStates);
const pageKindSchema = z.enum(pageKinds);

function localizedRecordSchema<T extends z.ZodType>(
  valueSchema: T,
): z.ZodType<Record<Locale, z.infer<T>>> {
  return z.object(
    Object.fromEntries(
      locales.map((locale) => [locale, valueSchema]),
    ) as Record<Locale, T>,
  ) as unknown as z.ZodType<Record<Locale, z.infer<T>>>;
}

const pageSeoSchema = z.object({
  title: nonEmptyString,
  description: nonEmptyString,
  ogImage: z.string().trim().optional(),
});

const pageSectionSchema = z.object({
  id: nonEmptyString,
  eyebrow: z.string().trim().optional(),
  title: nonEmptyString,
  body: nonEmptyString,
  items: z.array(nonEmptyString).optional(),
  cta: z
    .object({
      label: nonEmptyString,
      href: nonEmptyString,
    })
    .optional(),
});

export const managedPageSchema = z.object({
  id: nonEmptyString,
  kind: pageKindSchema,
  slug: nonEmptyString,
  locale: localeSchema,
  version: z.string().trim().optional(),
  title: nonEmptyString,
  description: nonEmptyString,
  seo: pageSeoSchema,
  publishState: publishStateSchema,
  publishedAt: isoDateString.optional(),
  updatedAt: isoDateString,
  sections: z.array(pageSectionSchema).min(1),
});

const pricingPlanSchema = z.object({
  id: nonEmptyString,
  name: nonEmptyString,
  priceLabel: nonEmptyString,
  description: nonEmptyString,
  features: z.array(nonEmptyString).min(1),
  ctaLabel: nonEmptyString,
  highlighted: z.boolean().optional(),
});

const contactFieldSchema = z.object({
  id: nonEmptyString,
  label: nonEmptyString,
  type: z.enum(["email", "text", "textarea"]),
  required: z.boolean(),
  minLength: z.number().int().min(0).optional(),
  maxLength: z.number().int().min(1).optional(),
});

const contactRoutingSchema = z.object({
  recipientEmail: z.email(),
  subjectPrefix: nonEmptyString,
  spamProtectionEnabled: z.boolean(),
  successMessage: nonEmptyString,
});

export const contactSubmissionSchema = z.object({
  id: nonEmptyString,
  locale: localeSchema,
  name: nonEmptyString,
  email: z.email(),
  message: nonEmptyString,
  submittedAt: isoDateString,
  status: z.enum(["new", "reviewed"]),
  values: z.record(z.string(), z.string()),
});

const localizedPricingPlansSchema = localizedRecordSchema(
  z.array(pricingPlanSchema),
);

const localizedContactFieldsSchema = localizedRecordSchema(
  z.array(contactFieldSchema),
);

const localizedContactRoutingSchema =
  localizedRecordSchema(contactRoutingSchema);

export const localizationSettingsSchema: z.ZodType<LocalizationSettings> = z
  .object({
    defaultLocale: localeSchema,
    enabledLocales: z.array(localeSchema).min(1),
  })
  .transform((settings) => ({
    defaultLocale: settings.defaultLocale,
    enabledLocales: uniqueLocales(settings.enabledLocales),
  }))
  .refine(
    (settings) => settings.enabledLocales.includes(settings.defaultLocale),
    "The default locale must be enabled.",
  )
  .refine(
    (settings) => settings.enabledLocales.includes(defaultLocale),
    "The compiled routing default locale must remain enabled.",
  ) as z.ZodType<LocalizationSettings>;

export const contentSnapshotSchema: z.ZodType<ContentSnapshot> = z.object({
  pages: z.array(managedPageSchema),
  pricingPlans: localizedPricingPlansSchema,
  contactFields: localizedContactFieldsSchema,
  contactRouting: localizedContactRoutingSchema,
  contactSubmissions: z.array(contactSubmissionSchema),
  localization: localizationSettingsSchema,
});

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
    id: "contact-ar",
    kind: "contact",
    slug: "contact",
    locale: "ar",
    title: "تواصل معنا",
    description: "واجهة تواصل قابلة للضبط لمسارات المنتج والدعم.",
    seo: {
      title: `تواصل معنا | ${appConfig.name}`,
      description: "حقول التواصل والتوجيه تتحكم بها إعدادات مشتركة.",
    },
    publishState: "published",
    publishedAt: updatedAt,
    updatedAt,
    sections: [
      {
        id: "intro",
        title: "اجعل مسارات التواصل قابلة للضبط.",
        body: "مخطط النموذج والتوجيه والنصوص وقواعد التحقق مركزية حتى يمكن تخصيصها لكل مستأجر لاحقا.",
      },
    ],
  },
  {
    id: "legal-privacy-en",
    kind: "legal",
    slug: "privacy",
    locale: "en",
    title: "Privacy Policy",
    version: "2026.07",
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
    version: "2026.07",
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
    {
      id: "name",
      label: "Name",
      maxLength: 120,
      minLength: 2,
      required: true,
      type: "text",
    },
    {
      id: "email",
      label: "Email",
      maxLength: 180,
      required: true,
      type: "email",
    },
    {
      id: "message",
      label: "Message",
      maxLength: 5000,
      minLength: 10,
      required: true,
      type: "textarea",
    },
  ],
  ar: [
    {
      id: "name",
      label: "الاسم",
      maxLength: 120,
      minLength: 2,
      required: true,
      type: "text",
    },
    {
      id: "email",
      label: "البريد الإلكتروني",
      maxLength: 180,
      required: true,
      type: "email",
    },
    {
      id: "message",
      label: "الرسالة",
      maxLength: 5000,
      minLength: 10,
      required: true,
      type: "textarea",
    },
  ],
} satisfies Record<Locale, ContactField[]>;

const contactRouting = {
  en: {
    recipientEmail: "support@example.com",
    subjectPrefix: "[Next.js SaaS Boilerplate]",
    spamProtectionEnabled: true,
    successMessage: "Thanks. Your message has been saved for review.",
  },
  ar: {
    recipientEmail: "support@example.com",
    subjectPrefix: "[Next.js SaaS Boilerplate]",
    spamProtectionEnabled: true,
    successMessage: "شكرا لك. تم حفظ رسالتك للمراجعة.",
  },
} satisfies Record<Locale, ContactRouting>;

export const defaultLocalizationSettings = localizationSettingsSchema.parse({
  defaultLocale,
  enabledLocales: locales,
});

export const defaultContentSnapshot = contentSnapshotSchema.parse({
  contactFields,
  contactRouting,
  contactSubmissions: [],
  localization: defaultLocalizationSettings,
  pages,
  pricingPlans,
});

export function cloneContentSnapshot(
  snapshot: ContentSnapshot,
): ContentSnapshot {
  return structuredClone(snapshot);
}

export function parseContentSnapshot(value: unknown): ContentSnapshot {
  return contentSnapshotSchema.parse(value);
}

export function createContentRepository(
  snapshot: ContentSnapshot = defaultContentSnapshot,
): ContentRepository {
  const content = parseContentSnapshot(snapshot);

  return {
    getSnapshot() {
      return cloneContentSnapshot(content);
    },
    getLocalizationSettings() {
      return { ...content.localization };
    },
    isLocaleEnabled(locale) {
      return content.localization.enabledLocales.includes(locale);
    },
    listEnabledLocales() {
      return [...content.localization.enabledLocales];
    },
    listPages(locale) {
      return content.pages.filter((page) => page.locale === locale);
    },
    listAllPages() {
      return [...content.pages];
    },
    getPage({ kind, locale, slug }) {
      return content.pages.find(
        (page) =>
          page.kind === kind &&
          page.locale === locale &&
          (slug === undefined || page.slug === slug),
      );
    },
    getPageById(id) {
      return content.pages.find((page) => page.id === id);
    },
    listPricingPlans(locale) {
      return content.pricingPlans[locale];
    },
    listContactFields(locale) {
      return content.contactFields[locale];
    },
    getContactRouting(locale) {
      return content.contactRouting[locale];
    },
    listContactSubmissions(locale) {
      return locale
        ? content.contactSubmissions.filter(
            (submission) => submission.locale === locale,
          )
        : [...content.contactSubmissions];
    },
  };
}

export function updateLocalizationSettings(
  snapshot: ContentSnapshot,
  settings: LocalizationSettings,
): ContentSnapshot {
  const nextSnapshot = cloneContentSnapshot(snapshot);

  nextSnapshot.localization = localizationSettingsSchema.parse(settings);

  return parseContentSnapshot(nextSnapshot);
}

export function upsertManagedPage(
  snapshot: ContentSnapshot,
  page: ManagedPage,
): ContentSnapshot {
  const nextPage = managedPageSchema.parse(page);
  const nextSnapshot = cloneContentSnapshot(snapshot);
  const existingIndex = nextSnapshot.pages.findIndex(
    (item) => item.id === nextPage.id,
  );

  const duplicateSlug = nextSnapshot.pages.find(
    (item) =>
      item.id !== nextPage.id &&
      item.locale === nextPage.locale &&
      item.kind === nextPage.kind &&
      item.slug === nextPage.slug,
  );

  if (duplicateSlug) {
    throw new Error(
      `Managed page slug "${nextPage.slug}" already exists for ${nextPage.locale}/${nextPage.kind}.`,
    );
  }

  if (existingIndex >= 0) {
    nextSnapshot.pages[existingIndex] = nextPage;
  } else {
    nextSnapshot.pages.push(nextPage);
  }

  return parseContentSnapshot(nextSnapshot);
}

export function updateContactConfiguration(
  snapshot: ContentSnapshot,
  locale: Locale,
  fields: ContactField[],
  routing: ContactRouting,
): ContentSnapshot {
  const nextSnapshot = cloneContentSnapshot(snapshot);

  nextSnapshot.contactFields[locale] = z
    .array(contactFieldSchema)
    .parse(fields);
  nextSnapshot.contactRouting[locale] = contactRoutingSchema.parse(routing);

  return parseContentSnapshot(nextSnapshot);
}

export function updatePricingPlans(
  snapshot: ContentSnapshot,
  locale: Locale,
  plans: PricingPlan[],
): ContentSnapshot {
  const nextSnapshot = cloneContentSnapshot(snapshot);
  nextSnapshot.pricingPlans[locale] = z.array(pricingPlanSchema).parse(plans);

  return parseContentSnapshot(nextSnapshot);
}

export function recordContactSubmission(
  snapshot: ContentSnapshot,
  submission: ContactSubmission,
): ContentSnapshot {
  const nextSnapshot = cloneContentSnapshot(snapshot);
  nextSnapshot.contactSubmissions.unshift(
    contactSubmissionSchema.parse(submission),
  );

  return parseContentSnapshot(nextSnapshot);
}
