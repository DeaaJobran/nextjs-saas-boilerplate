"use server";

import {
  type ContactSubmission,
  createContentRepository,
  recordContactSubmission,
} from "@nextjs-saas/config/content";
import { defaultLocale, isLocale, locales } from "@nextjs-saas/localization";
import { checkBotProtection, SecurityError } from "@nextjs-saas/security";
import { revalidatePath } from "next/cache";
import { getTranslations } from "next-intl/server";

import type { ContactFormState } from "../../../../lib/contact-form-state";
import {
  readContentSnapshot,
  updateContentSnapshot,
} from "../../../../lib/content-store";
import { getPublicManagedPage } from "../../../../lib/public-content";
import { requirePublicFormAuth } from "../../../../lib/public-form-auth";

class ContactPageUnavailableError extends Error {}

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

  let requestContext: Awaited<ReturnType<typeof requirePublicFormAuth>>;

  try {
    requestContext = await requirePublicFormAuth(readText(formData, "email"));
  } catch (error) {
    if (error instanceof SecurityError) {
      const t = await getTranslations({
        locale: localeValue,
        namespace: "ContactValidation",
      });

      return {
        fieldErrors: {},
        message: t("rateLimited"),
        status: "error",
      };
    }

    throw error;
  }

  const t = await getTranslations({
    locale: localeValue,
    namespace: "ContactValidation",
  });
  const snapshot = await readContentSnapshot();
  const repository = createContentRepository(snapshot);

  if (
    !repository.isLocaleEnabled(localeValue) ||
    !getPublicManagedPage(snapshot.pages, {
      kind: "contact",
      locale: localeValue,
    })
  ) {
    return {
      fieldErrors: {},
      message: t("unavailable"),
      status: "error",
    };
  }

  const fields = repository.listContactFields(localeValue);
  const routing = repository.getContactRouting(localeValue);

  const values = Object.fromEntries(
    fields.map((field) => [field.id, readText(formData, field.id)]),
  );

  const botCheck = await checkBotProtection({
    action: "contact.submit",
    honeypot: routing.spamProtectionEnabled
      ? readText(formData, "company")
      : undefined,
    ipAddress: requestContext.ipAddress,
  });
  if (!botCheck.allowed) {
    return {
      message: routing.successMessage,
      resultToken: crypto.randomUUID(),
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

  try {
    await updateContentSnapshot((currentSnapshot) => {
      if (
        !currentSnapshot.localization.enabledLocales.includes(localeValue) ||
        !getPublicManagedPage(currentSnapshot.pages, {
          kind: "contact",
          locale: localeValue,
        })
      ) {
        throw new ContactPageUnavailableError();
      }

      return recordContactSubmission(currentSnapshot, submission);
    });
  } catch (error) {
    if (error instanceof ContactPageUnavailableError) {
      return {
        fieldErrors: {},
        message: t("unavailable"),
        status: "error",
      };
    }

    throw error;
  }

  for (const locale of locales) {
    revalidatePath(`/${locale}/admin/content`);
  }

  return {
    message: routing.successMessage,
    resultToken: submission.id,
    status: "success",
  };
}
