"use server";

import {
  type ContactSubmission,
  createContentRepository,
  recordContactSubmission,
} from "@nextjs-saas/config/content";
import { isLocale, locales } from "@nextjs-saas/localization";
import { revalidatePath } from "next/cache";

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

  if (!isLocale(localeValue)) {
    return {
      fieldErrors: {},
      message: "The selected locale is not supported.",
      status: "error",
    };
  }

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
      fieldErrors[field.id] = `${field.label} is required.`;
      continue;
    }

    if (field.type === "email" && value && !isValidEmail(value)) {
      fieldErrors[field.id] = `${field.label} must be a valid email address.`;
      continue;
    }

    if (field.minLength && value.length < field.minLength) {
      fieldErrors[field.id] =
        `${field.label} must be at least ${field.minLength} characters.`;
      continue;
    }

    if (field.maxLength && value.length > field.maxLength) {
      fieldErrors[field.id] =
        `${field.label} must be ${field.maxLength} characters or less.`;
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
