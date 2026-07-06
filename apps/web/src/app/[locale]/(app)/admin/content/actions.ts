"use server";

import {
  type ContactField,
  type ContactRouting,
  createContentRepository,
  type ManagedPage,
  type PageKind,
  pageKinds,
  type PricingPlan,
  type PublishState,
  publishStates,
  updateContactConfiguration,
  updatePricingPlans,
  upsertManagedPage,
} from "@nextjs-saas/config/content";
import { isLocale, type Locale } from "@nextjs-saas/localization";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireAdminAuth } from "../../../../../lib/admin-auth";
import {
  readContentSnapshot,
  updateContentSnapshot,
} from "../../../../../lib/content-store";

const contactFieldTypes = ["email", "text", "textarea"] as const;

function readText(formData: FormData, key: string) {
  const value = formData.get(key);

  return typeof value === "string" ? value.trim() : "";
}

function readOptionalText(formData: FormData, key: string) {
  const value = readText(formData, key);

  return value.length > 0 ? value : undefined;
}

function readLocale(formData: FormData, key: string) {
  const value = readText(formData, key);

  if (!isLocale(value)) {
    throw new Error(`Invalid locale: ${value}`);
  }

  return value;
}

function readPublishState(formData: FormData): PublishState {
  const value = readText(formData, "publishState");

  if (!publishStates.includes(value as PublishState)) {
    throw new Error(`Invalid publish state: ${value}`);
  }

  return value as PublishState;
}

function readPageKind(formData: FormData): PageKind {
  const value = readText(formData, "kind");

  if (!pageKinds.includes(value as PageKind)) {
    throw new Error(`Invalid page kind: ${value}`);
  }

  return value as PageKind;
}

function readNumber(formData: FormData, key: string) {
  const value = readText(formData, key);

  if (!value) {
    return undefined;
  }

  const number = Number(value);

  if (!Number.isFinite(number)) {
    throw new Error(`Invalid number for ${key}`);
  }

  return number;
}

function slugify(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\u0600-\u06ff]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function readSections(formData: FormData): ManagedPage["sections"] {
  const sectionCount = Number(readText(formData, "sectionCount"));

  if (!Number.isInteger(sectionCount) || sectionCount < 1) {
    throw new Error("At least one page section is required.");
  }

  return Array.from({ length: sectionCount }, (_, index) => {
    const prefix = `section.${index}`;
    const ctaLabel = readOptionalText(formData, `${prefix}.ctaLabel`);
    const ctaHref = readOptionalText(formData, `${prefix}.ctaHref`);
    const items = readText(formData, `${prefix}.items`)
      .split(/\r?\n/)
      .flatMap((item) => {
        const trimmedItem = item.trim();

        return trimmedItem ? [trimmedItem] : [];
      });

    return {
      body: readText(formData, `${prefix}.body`),
      cta:
        ctaLabel && ctaHref
          ? {
              href: ctaHref,
              label: ctaLabel,
            }
          : undefined,
      eyebrow: readOptionalText(formData, `${prefix}.eyebrow`),
      id: readOptionalText(formData, `${prefix}.id`) ?? crypto.randomUUID(),
      items: items.length > 0 ? items : undefined,
      title: readText(formData, `${prefix}.title`),
    };
  });
}

function revalidateManagedPage(page: ManagedPage, adminLocale: Locale) {
  revalidatePath(`/${adminLocale}/admin`);
  revalidatePath(`/${adminLocale}/admin/content`);

  if (page.kind === "landing") {
    revalidatePath(`/${page.locale}`);
  }

  if (page.kind === "pricing") {
    revalidatePath(`/${page.locale}/pricing`);
  }

  if (page.kind === "contact") {
    revalidatePath(`/${page.locale}/contact`);
  }

  if (page.kind === "legal") {
    revalidatePath(`/${page.locale}/legal/${page.slug}`);
  }
}

function redirectToAdminContent({
  adminLocale,
  saved,
  selected,
}: {
  adminLocale: Locale;
  saved: string;
  selected: string;
}) {
  const query = new URLSearchParams({
    revision: Date.now().toString(),
    saved,
    selected,
  });

  redirect(`/${adminLocale}/admin/content?${query.toString()}`);
}

export async function saveManagedPageAction(formData: FormData) {
  await requireAdminAuth();

  const adminLocale = readLocale(formData, "adminLocale");
  const id = readText(formData, "id");
  const snapshot = await readContentSnapshot();
  const repository = createContentRepository(snapshot);
  const existingPage = repository.getPageById(id);

  if (!existingPage) {
    throw new Error(`Managed page not found: ${id}`);
  }

  const publishState = readPublishState(formData);
  const now = new Date().toISOString();
  const nextPage: ManagedPage = {
    ...existingPage,
    description: readText(formData, "description"),
    publishedAt:
      publishState === "published"
        ? (existingPage.publishedAt ?? now)
        : existingPage.publishedAt,
    publishState,
    sections: readSections(formData),
    seo: {
      description: readText(formData, "seoDescription"),
      ogImage: readOptionalText(formData, "ogImage"),
      title: readText(formData, "seoTitle"),
    },
    slug: slugify(readText(formData, "slug")),
    title: readText(formData, "title"),
    updatedAt: now,
    version: readOptionalText(formData, "version"),
  };

  await updateContentSnapshot((currentSnapshot) =>
    upsertManagedPage(currentSnapshot, nextPage),
  );

  revalidateManagedPage(nextPage, adminLocale);
  redirectToAdminContent({
    adminLocale,
    saved: "page",
    selected: nextPage.id,
  });
}

export async function createManagedPageAction(formData: FormData) {
  await requireAdminAuth();

  const adminLocale = readLocale(formData, "adminLocale");
  const locale = readLocale(formData, "locale");
  const kind = readPageKind(formData);
  const slug = slugify(readText(formData, "slug"));
  const title = readText(formData, "title");
  const body = readText(formData, "body");
  const now = new Date().toISOString();
  const publishState = readPublishState(formData);
  const page: ManagedPage = {
    description: readText(formData, "description"),
    id: `${kind}-${locale}-${slug}`,
    kind,
    locale,
    publishedAt: publishState === "published" ? now : undefined,
    publishState,
    sections: [
      {
        body,
        id: `${kind}-${slug}-section`,
        title,
      },
    ],
    seo: {
      description: readText(formData, "description"),
      title,
    },
    slug,
    title,
    updatedAt: now,
    version: readOptionalText(formData, "version"),
  };

  await updateContentSnapshot((currentSnapshot) =>
    upsertManagedPage(currentSnapshot, page),
  );

  revalidateManagedPage(page, adminLocale);
  redirectToAdminContent({
    adminLocale,
    saved: "page",
    selected: page.id,
  });
}

export async function saveContactSettingsAction(formData: FormData) {
  await requireAdminAuth();

  const adminLocale = readLocale(formData, "adminLocale");
  const locale = readLocale(formData, "locale");
  const fieldCount = Number(readText(formData, "fieldCount"));

  if (!Number.isInteger(fieldCount) || fieldCount < 1) {
    throw new Error("At least one contact field is required.");
  }

  const fields: ContactField[] = Array.from(
    { length: fieldCount },
    (_, index) => {
      const prefix = `field.${index}`;
      const type = readText(formData, `${prefix}.type`);

      if (!contactFieldTypes.includes(type as ContactField["type"])) {
        throw new Error(`Invalid contact field type: ${type}`);
      }

      return {
        id: readText(formData, `${prefix}.id`),
        label: readText(formData, `${prefix}.label`),
        maxLength: readNumber(formData, `${prefix}.maxLength`),
        minLength: readNumber(formData, `${prefix}.minLength`),
        required: readText(formData, `${prefix}.required`) === "true",
        type: type as ContactField["type"],
      };
    },
  );

  const routing: ContactRouting = {
    recipientEmail: readText(formData, "recipientEmail"),
    spamProtectionEnabled:
      readText(formData, "spamProtectionEnabled") === "true",
    subjectPrefix: readText(formData, "subjectPrefix"),
    successMessage: readText(formData, "successMessage"),
  };

  await updateContentSnapshot((currentSnapshot) =>
    updateContactConfiguration(currentSnapshot, locale, fields, routing),
  );

  revalidatePath(`/${locale}/contact`);
  revalidatePath(`/${adminLocale}/admin/content`);
  redirectToAdminContent({
    adminLocale,
    saved: "contact",
    selected: `contact-${locale}`,
  });
}

export async function savePricingPlansAction(formData: FormData) {
  await requireAdminAuth();

  const adminLocale = readLocale(formData, "adminLocale");
  const locale = readLocale(formData, "locale");
  const planCount = Number(readText(formData, "planCount"));

  if (!Number.isInteger(planCount) || planCount < 1) {
    throw new Error("At least one pricing plan is required.");
  }

  const plans: PricingPlan[] = Array.from({ length: planCount }, (_, index) => {
    const prefix = `plan.${index}`;
    const features = readText(formData, `${prefix}.features`)
      .split(/\r?\n/)
      .flatMap((feature) => {
        const trimmedFeature = feature.trim();

        return trimmedFeature ? [trimmedFeature] : [];
      });

    return {
      ctaLabel: readText(formData, `${prefix}.ctaLabel`),
      description: readText(formData, `${prefix}.description`),
      features,
      highlighted: readText(formData, `${prefix}.highlighted`) === "true",
      id: readText(formData, `${prefix}.id`),
      name: readText(formData, `${prefix}.name`),
      priceLabel: readText(formData, `${prefix}.priceLabel`),
    };
  });

  await updateContentSnapshot((currentSnapshot) =>
    updatePricingPlans(currentSnapshot, locale, plans),
  );

  revalidatePath(`/${locale}/pricing`);
  revalidatePath(`/${adminLocale}/admin/content`);
  redirectToAdminContent({
    adminLocale,
    saved: "pricing",
    selected: `pricing-${locale}`,
  });
}
