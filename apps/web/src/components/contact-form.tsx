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
  useToast,
} from "@nextjs-saas/ui";
import { SendIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useActionState, useEffect, useRef } from "react";
import { useFormStatus } from "react-dom";

import type { ContactFormAction } from "../lib/contact-form-state";

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
  action: ContactFormAction;
  fields: ContactField[];
  locale: Locale;
  routing: ContactRouting;
}) {
  const t = useTranslations("ContactForm");
  const [state, formAction] = useActionState(action, { status: "idle" });
  const { notify } = useToast();
  const notifiedResult = useRef<string | undefined>(undefined);
  const successMessage = state.status === "success" ? state.message : undefined;
  const resultToken =
    state.status === "success" ? state.resultToken : undefined;
  const formKey = resultToken ?? "contact-form";

  useEffect(() => {
    if (
      successMessage &&
      resultToken &&
      resultToken !== notifiedResult.current
    ) {
      notifiedResult.current = resultToken;
      notify({ description: successMessage, title: t("successTitle") });
    }
  }, [notify, resultToken, successMessage, t]);

  return (
    <Card>
      <CardContent className="pt-5">
        {successMessage ? (
          <div className="mb-4 rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-950 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-50">
            {successMessage}
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
            const error =
              state.status === "error"
                ? state.fieldErrors?.[field.id]
                : undefined;
            const value =
              state.status === "error" ? state.values?.[field.id] : undefined;

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
