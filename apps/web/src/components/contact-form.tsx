"use client";

import type { ContactField, ContactRouting } from "@nextjs-saas/config/content";
import type { Locale } from "@nextjs-saas/localization";
import {
  Button,
  Card,
  CardContent,
  Field,
  Textarea,
  TextInput,
} from "@nextjs-saas/ui";
import { SendIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";

type ContactFormState = {
  fieldErrors?: Record<string, string>;
  message?: string;
  status: "idle" | "error" | "success";
  values?: Record<string, string>;
};

type ContactAction = (
  state: ContactFormState,
  formData: FormData,
) => Promise<ContactFormState>;

function SubmitButton() {
  const { pending } = useFormStatus();
  const t = useTranslations("ContactForm");

  return (
    <Button disabled={pending} type="submit">
      <SendIcon aria-hidden="true" className="size-4" />
      {pending ? t("sending") : t("submit")}
    </Button>
  );
}

export function ContactForm({
  action,
  fields,
  locale,
  routing,
}: {
  action: ContactAction;
  fields: ContactField[];
  locale: Locale;
  routing: ContactRouting;
}) {
  const t = useTranslations("ContactForm");
  const [state, formAction] = useActionState(action, { status: "idle" });
  const formKey = state.status === "success" ? state.message : "contact-form";

  return (
    <Card>
      <CardContent className="pt-5">
        {state.status === "success" && state.message ? (
          <div
            className="mb-4 rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-950 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-50"
            role="status"
          >
            {state.message}
          </div>
        ) : null}
        {state.status === "error" && state.message ? (
          <div
            className="text-destructive mb-4 rounded-md border px-4 py-3 text-sm font-medium"
            role="alert"
          >
            {state.message}
          </div>
        ) : null}
        <form
          action={formAction}
          aria-label={t("ariaLabel")}
          className="grid gap-4"
          key={formKey}
        >
          <input name="locale" type="hidden" value={locale} />
          {routing.spamProtectionEnabled ? (
            <div aria-hidden="true" className="hidden">
              <label htmlFor="company">{t("company")}</label>
              <input
                autoComplete="off"
                id="company"
                name="company"
                tabIndex={-1}
                type="text"
              />
            </div>
          ) : null}
          {fields.map((field) => {
            const error = state.fieldErrors?.[field.id];
            const value = state.values?.[field.id];

            return (
              <Field
                key={field.id}
                label={field.label}
                required={field.required}
                error={error}
              >
                {field.type === "textarea" ? (
                  <Textarea
                    name={field.id}
                    required={field.required}
                    minLength={field.minLength}
                    maxLength={field.maxLength}
                    defaultValue={value}
                  />
                ) : (
                  <TextInput
                    name={field.id}
                    required={field.required}
                    minLength={field.minLength}
                    maxLength={field.maxLength}
                    type={field.type}
                    defaultValue={value}
                  />
                )}
              </Field>
            );
          })}
          <SubmitButton />
        </form>
      </CardContent>
    </Card>
  );
}
