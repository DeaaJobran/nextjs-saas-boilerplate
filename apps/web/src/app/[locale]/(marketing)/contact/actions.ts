"use server";

import {
  type ContactSubmission,
  createContentRepository,
  recordContactSubmission,
} from "@nextjs-saas/config/content";
import { defaultLocale, isLocale, locales } from "@nextjs-saas/localization";
import { revalidatePath } from "next/cache";
import { getTranslations } from "next-intl/server";

import {
  readContentSnapshot,
  updateContentSnapshot,
} from "../../../../lib/content-store";
import { requirePublicFormAuth } from "../../../../lib/public-form-auth";

export type ContactFormState = {
  fieldErrors?: Record<string, string>;
  message?: string;
  status: "idle" | "error" | "success";
  values?: Record<string, string>;
};

function readText(formData: FormData, key: string) {
  const value = formData.get(key);

  return typeof value === "string" ? value.trim() : "";
}

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export async function submitContactMessageAction(
  _state: ContactFormState,
  formData: FormData,
): Promise<ContactFormState> {
  await requirePublicFormAuth();

  const localeValue = readText(formData, "locale");
  const fallbackT = await getTranslations({
    locale: defaultLocale,
    namespace: "ContactValidation",
  });

  if (!isLocale(localeValue)) {
    return {
      fieldErrors: {},
      message: fallbackT("locale"),
      status: "error",
    };
  }

  const t = await getTranslations({
    locale: localeValue,
    namespace: "ContactValidation",
  });
  const snapshot = await readContentSnapshot();
  const repository = createContentRepository(snapshot);
  const fields = repository.listContactFields(localeValue);
  const routing = repository.getContactRouting(localeValue);
  const values = Object.fromEntries(
    fields.map((field) => [field.id, readText(formData, field.id)]),
  );

  if (routing.spamProtectionEnabled && readText(formData, "company")) {
    return {
      message: routing.successMessage,
      status: "success",
    };
  }

  const fieldErrors: Record<string, string> = {};

  for (const field of fields) {
    const value = values[field.id] ?? "";

    if (field.required && !value) {
      fieldErrors[field.id] = t("required", { field: field.label });
      continue;
    }

    if (field.type === "email" && value && !isValidEmail(value)) {
      fieldErrors[field.id] = t("email", { field: field.label });
      continue;
    }

    if (field.minLength && value.length < field.minLength) {
      fieldErrors[field.id] = t("minLength", {
        field: field.label,
        min: field.minLength,
      });
      continue;
    }

    if (field.maxLength && value.length > field.maxLength) {
      fieldErrors[field.id] = t("maxLength", {
        field: field.label,
        max: field.maxLength,
      });
    }
  }

  if (Object.keys(fieldErrors).length > 0) {
    return {
      fieldErrors,
      status: "error",
      values,
    };
  }

  const submission: ContactSubmission = {
    email: values.email ?? "",
    id: crypto.randomUUID(),
    locale: localeValue,
    message: values.message ?? "",
    name: values.name ?? "",
    status: "new",
    submittedAt: new Date().toISOString(),
    values,
  };

  await updateContentSnapshot((currentSnapshot) =>
    recordContactSubmission(currentSnapshot, submission),
  );

  for (const locale of locales) {
    revalidatePath(`/${locale}/admin/content`);
  }

  return {
    message: routing.successMessage,
    status: "success",
  };
}
