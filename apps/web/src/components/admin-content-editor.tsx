"use client";

import {
  type ContactField,
  type ContactRouting,
  type LocalizationSettings,
  type ManagedPage,
  pageKinds,
  type PageSection,
  type PricingPlan,
  publishStates,
} from "@nextjs-saas/config/content";
import { type Locale, localeLabels, locales } from "@nextjs-saas/localization";
import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Field,
  SelectInput,
  Textarea,
  TextInput,
} from "@nextjs-saas/ui";
import { PlusIcon, SaveIcon, Trash2Icon } from "lucide-react";
import { useTranslations } from "next-intl";
import * as React from "react";

type FormAction = (formData: FormData) => void | Promise<void>;

function createEmptySection(): PageSection {
  return {
    body: "",
    id: crypto.randomUUID(),
    title: "",
  };
}

function createEmptyContactField(): ContactField {
  return {
    id: `custom-${crypto.randomUUID()}`,
    label: "",
    required: false,
    type: "text",
  };
}

function createEmptyPricingPlan(): PricingPlan {
  return {
    ctaLabel: "",
    description: "",
    features: [""],
    id: `plan-${crypto.randomUUID()}`,
    name: "",
    priceLabel: "",
  };
}

export function ManagedPageEditor({
  action,
  adminLocale,
  page,
}: {
  action: FormAction;
  adminLocale: Locale;
  page: ManagedPage;
}) {
  const t = useTranslations("AdminEditor");
  const stateT = useTranslations("PublicationState");
  const [sections, setSections] = React.useState<PageSection[]>(
    page.sections.length > 0 ? page.sections : [createEmptySection()],
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("editManagedPage")}</CardTitle>
        <CardDescription>{t("editDescription")}</CardDescription>
      </CardHeader>
      <CardContent>
        <form
          action={action}
          aria-label={t("editManagedPage")}
          className="grid gap-6"
        >
          <input name="adminLocale" type="hidden" value={adminLocale} />
          <input name="id" type="hidden" value={page.id} />
          <input name="sectionCount" type="hidden" value={sections.length} />
          <div className="grid gap-4 md:grid-cols-2">
            <Field label={t("title")} required>
              <TextInput name="title" required defaultValue={page.title} />
            </Field>
            <Field label={t("slug")} required>
              <TextInput name="slug" required defaultValue={page.slug} />
            </Field>
            <Field label={t("publishState")} required>
              <SelectInput
                defaultValue={page.publishState}
                name="publishState"
                required
              >
                {publishStates.map((state) => (
                  <option key={state} value={state}>
                    {stateT(state)}
                  </option>
                ))}
              </SelectInput>
            </Field>
            <Field label={t("contentVersion")}>
              <TextInput name="version" defaultValue={page.version} />
            </Field>
            <Field label={t("description")} required>
              <TextInput
                name="description"
                required
                defaultValue={page.description}
              />
            </Field>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <Field label={t("seoTitle")} required>
              <TextInput
                name="seoTitle"
                required
                defaultValue={page.seo.title}
              />
            </Field>
            <Field label={t("openGraphImage")}>
              <TextInput name="ogImage" defaultValue={page.seo.ogImage} />
            </Field>
            <Field
              className="md:col-span-2"
              label={t("seoDescription")}
              required
            >
              <Textarea
                name="seoDescription"
                required
                defaultValue={page.seo.description}
              />
            </Field>
          </div>
          <div className="grid gap-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="text-base font-semibold">{t("sections")}</h3>
                <p className="text-muted-foreground text-sm">
                  {t("sectionsDescription")}
                </p>
              </div>
              <Button
                type="button"
                variant="outline"
                onClick={() =>
                  setSections((current) => [...current, createEmptySection()])
                }
              >
                <PlusIcon aria-hidden="true" className="size-4" />
                {t("addSection")}
              </Button>
            </div>
            {sections.map((section, index) => (
              <div
                className="grid gap-4 rounded-md border p-4"
                key={section.id}
              >
                <input
                  name={`section.${index}.id`}
                  type="hidden"
                  value={section.id}
                />
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <h4 className="font-medium">
                    {t("section", { number: index + 1 })}
                  </h4>
                  <Button
                    disabled={sections.length === 1}
                    type="button"
                    variant="ghost"
                    onClick={() =>
                      setSections((current) =>
                        current.filter((item) => item.id !== section.id),
                      )
                    }
                  >
                    <Trash2Icon aria-hidden="true" className="size-4" />
                    {t("remove")}
                  </Button>
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  <Field label={t("eyebrow")}>
                    <TextInput
                      name={`section.${index}.eyebrow`}
                      defaultValue={section.eyebrow}
                    />
                  </Field>
                  <Field label={t("sectionTitle")} required>
                    <TextInput
                      name={`section.${index}.title`}
                      required
                      defaultValue={section.title}
                    />
                  </Field>
                  <Field
                    className="md:col-span-2"
                    label={t("sectionBody")}
                    required
                  >
                    <Textarea
                      name={`section.${index}.body`}
                      required
                      defaultValue={section.body}
                    />
                  </Field>
                  <Field label={t("ctaLabel")}>
                    <TextInput
                      name={`section.${index}.ctaLabel`}
                      defaultValue={section.cta?.label}
                    />
                  </Field>
                  <Field label={t("ctaHref")}>
                    <TextInput
                      name={`section.${index}.ctaHref`}
                      defaultValue={section.cta?.href}
                    />
                  </Field>
                  <Field
                    className="md:col-span-2"
                    label={t("items")}
                    description={t("oneItemPerLine")}
                  >
                    <Textarea
                      name={`section.${index}.items`}
                      defaultValue={section.items?.join("\n")}
                    />
                  </Field>
                </div>
              </div>
            ))}
          </div>
          <div className="flex justify-end">
            <Button type="submit">
              <SaveIcon aria-hidden="true" className="size-4" />
              {t("savePage")}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

export function CreateManagedPageForm({
  action,
  adminLocale,
}: {
  action: FormAction;
  adminLocale: Locale;
}) {
  const t = useTranslations("AdminEditor");
  const kindT = useTranslations("PageKind");
  const stateT = useTranslations("PublicationState");

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("createManagedPage")}</CardTitle>
        <CardDescription>{t("createDescription")}</CardDescription>
      </CardHeader>
      <CardContent>
        <form
          action={action}
          aria-label={t("createManagedPage")}
          className="grid gap-4"
        >
          <input name="adminLocale" type="hidden" value={adminLocale} />
          <div className="grid gap-4 md:grid-cols-2">
            <Field label={t("locale")} required>
              <SelectInput name="locale" required>
                {locales.map((locale) => (
                  <option key={locale} value={locale}>
                    {localeLabels[locale]}
                  </option>
                ))}
              </SelectInput>
            </Field>
            <Field label={t("type")} required>
              <SelectInput name="kind" required>
                {pageKinds.map((kind) => (
                  <option key={kind} value={kind}>
                    {kindT(kind)}
                  </option>
                ))}
              </SelectInput>
            </Field>
            <Field label={t("publishState")} required>
              <SelectInput defaultValue="draft" name="publishState" required>
                {publishStates.map((state) => (
                  <option key={state} value={state}>
                    {stateT(state)}
                  </option>
                ))}
              </SelectInput>
            </Field>
            <Field label={t("contentVersion")}>
              <TextInput name="version" />
            </Field>
            <Field label={t("slug")} required>
              <TextInput name="slug" required />
            </Field>
            <Field label={t("title")} required>
              <TextInput name="title" required />
            </Field>
            <Field label={t("description")} required>
              <TextInput name="description" required />
            </Field>
            <Field
              className="md:col-span-2"
              label={t("firstSectionBody")}
              required
            >
              <Textarea name="body" required />
            </Field>
          </div>
          <div className="flex justify-end">
            <Button type="submit">
              <PlusIcon aria-hidden="true" className="size-4" />
              {t("createPage")}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

export function LocalizationSettingsEditor({
  action,
  adminLocale,
  selectedPageId,
  settings,
}: {
  action: FormAction;
  adminLocale: Locale;
  selectedPageId: string;
  settings: LocalizationSettings;
}) {
  const t = useTranslations("AdminEditor");

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("localizationSettings")}</CardTitle>
        <CardDescription>{t("localizationDescription")}</CardDescription>
      </CardHeader>
      <CardContent>
        <form
          action={action}
          aria-label={t("localizationSettings")}
          className="grid gap-4"
        >
          <input name="adminLocale" type="hidden" value={adminLocale} />
          <input name="selected" type="hidden" value={selectedPageId} />
          <Field label={t("defaultLocale")} required>
            <SelectInput
              defaultValue={settings.defaultLocale}
              name="defaultLocale"
              required
            >
              {locales.map((locale) => (
                <option key={locale} value={locale}>
                  {localeLabels[locale]}
                </option>
              ))}
            </SelectInput>
          </Field>
          <fieldset className="grid gap-2">
            <legend className="text-sm font-medium">
              {t("enabledLocales")}
            </legend>
            <div className="grid gap-2 sm:grid-cols-2">
              {locales.map((locale) => (
                <label
                  className="flex min-h-11 items-center gap-3 rounded-md border px-3 py-2 text-sm"
                  key={locale}
                >
                  <input
                    className="accent-primary size-4"
                    defaultChecked={settings.enabledLocales.includes(locale)}
                    name="enabledLocales"
                    type="checkbox"
                    value={locale}
                  />
                  <span>{localeLabels[locale]}</span>
                </label>
              ))}
            </div>
          </fieldset>
          <Button type="submit">
            <SaveIcon aria-hidden="true" className="size-4" />
            {t("saveLocalizationSettings")}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

export function ContactSettingsEditor({
  action,
  adminLocale,
  fields,
  locale,
  routing,
}: {
  action: FormAction;
  adminLocale: Locale;
  fields: ContactField[];
  locale: Locale;
  routing: ContactRouting;
}) {
  const t = useTranslations("AdminEditor");
  const typeT = useTranslations("ContactFieldType");
  const [contactFields, setContactFields] = React.useState<ContactField[]>(
    fields.length > 0 ? fields : [createEmptyContactField()],
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("contactSettings")}</CardTitle>
        <CardDescription>{t("contactDescription")}</CardDescription>
      </CardHeader>
      <CardContent>
        <form
          action={action}
          aria-label={t("contactSettings")}
          className="grid gap-4"
        >
          <input name="adminLocale" type="hidden" value={adminLocale} />
          <input name="locale" type="hidden" value={locale} />
          <input name="fieldCount" type="hidden" value={contactFields.length} />
          <div className="bg-muted/40 rounded-md border px-3 py-2 text-sm">
            {t("contactEditing", { locale: localeLabels[locale] })}
          </div>
          <div className="grid gap-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h3 className="text-base font-semibold">{t("fields")}</h3>
              <Button
                type="button"
                variant="outline"
                onClick={() =>
                  setContactFields((current) => [
                    ...current,
                    createEmptyContactField(),
                  ])
                }
              >
                <PlusIcon aria-hidden="true" className="size-4" />
                {t("addField")}
              </Button>
            </div>
            {contactFields.map((field, index) => (
              <div className="grid gap-3 rounded-md border p-3" key={field.id}>
                <input
                  name={`field.${index}.id`}
                  type="hidden"
                  value={field.id}
                />
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <h4 className="font-medium">
                    {t("field", { number: index + 1 })}
                  </h4>
                  <Button
                    disabled={contactFields.length === 1}
                    type="button"
                    variant="ghost"
                    onClick={() =>
                      setContactFields((current) =>
                        current.filter((item) => item.id !== field.id),
                      )
                    }
                  >
                    <Trash2Icon aria-hidden="true" className="size-4" />
                    {t("remove")}
                  </Button>
                </div>
                <div className="grid gap-3 md:grid-cols-2">
                  <Field label={t("label")} required>
                    <TextInput
                      name={`field.${index}.label`}
                      required
                      defaultValue={field.label}
                    />
                  </Field>
                  <Field label={t("type")} required>
                    <SelectInput
                      defaultValue={field.type}
                      name={`field.${index}.type`}
                      required
                    >
                      <option value="text">{typeT("text")}</option>
                      <option value="email">{typeT("email")}</option>
                      <option value="textarea">{typeT("textarea")}</option>
                    </SelectInput>
                  </Field>
                  <Field label={t("required")} required>
                    <SelectInput
                      defaultValue={String(field.required)}
                      name={`field.${index}.required`}
                      required
                    >
                      <option value="true">{t("required")}</option>
                      <option value="false">{t("optional")}</option>
                    </SelectInput>
                  </Field>
                  <Field label={t("minimumLength")}>
                    <TextInput
                      min={0}
                      name={`field.${index}.minLength`}
                      type="number"
                      defaultValue={field.minLength}
                    />
                  </Field>
                  <Field label={t("maximumLength")}>
                    <TextInput
                      min={1}
                      name={`field.${index}.maxLength`}
                      type="number"
                      defaultValue={field.maxLength}
                    />
                  </Field>
                </div>
              </div>
            ))}
          </div>
          <Field label={t("recipientEmail")} required>
            <TextInput
              name="recipientEmail"
              required
              type="email"
              defaultValue={routing.recipientEmail}
            />
          </Field>
          <Field label={t("subjectPrefix")} required>
            <TextInput
              name="subjectPrefix"
              required
              defaultValue={routing.subjectPrefix}
            />
          </Field>
          <Field label={t("successMessage")} required>
            <TextInput
              name="successMessage"
              required
              defaultValue={routing.successMessage}
            />
          </Field>
          <Field label={t("spamProtection")} required>
            <SelectInput
              defaultValue={String(routing.spamProtectionEnabled)}
              name="spamProtectionEnabled"
              required
            >
              <option value="true">{t("enabled")}</option>
              <option value="false">{t("disabled")}</option>
            </SelectInput>
          </Field>
          <Button type="submit">{t("saveContactSettings")}</Button>
        </form>
      </CardContent>
    </Card>
  );
}

export function PricingPlansEditor({
  action,
  adminLocale,
  locale,
  plans,
}: {
  action: FormAction;
  adminLocale: Locale;
  locale: Locale;
  plans: PricingPlan[];
}) {
  const t = useTranslations("AdminEditor");
  const [pricingPlans, setPricingPlans] = React.useState<PricingPlan[]>(
    plans.length > 0 ? plans : [createEmptyPricingPlan()],
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("pricingPlans")}</CardTitle>
        <CardDescription>{t("pricingDescription")}</CardDescription>
      </CardHeader>
      <CardContent>
        <form
          action={action}
          aria-label={t("pricingPlans")}
          className="grid gap-4"
        >
          <input name="adminLocale" type="hidden" value={adminLocale} />
          <input name="locale" type="hidden" value={locale} />
          <input name="planCount" type="hidden" value={pricingPlans.length} />
          <div className="bg-muted/40 rounded-md border px-3 py-2 text-sm">
            {t("pricingEditing", { locale: localeLabels[locale] })}
          </div>
          <div className="grid gap-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h3 className="text-base font-semibold">{t("plans")}</h3>
              <Button
                type="button"
                variant="outline"
                onClick={() =>
                  setPricingPlans((current) => [
                    ...current,
                    createEmptyPricingPlan(),
                  ])
                }
              >
                <PlusIcon aria-hidden="true" className="size-4" />
                {t("addPlan")}
              </Button>
            </div>
            {pricingPlans.map((plan, index) => (
              <div className="grid gap-3 rounded-md border p-3" key={plan.id}>
                <input
                  name={`plan.${index}.id`}
                  type="hidden"
                  value={plan.id}
                />
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <h4 className="font-medium">
                    {t("plan", { number: index + 1 })}
                  </h4>
                  <Button
                    disabled={pricingPlans.length === 1}
                    type="button"
                    variant="ghost"
                    onClick={() =>
                      setPricingPlans((current) =>
                        current.filter((item) => item.id !== plan.id),
                      )
                    }
                  >
                    <Trash2Icon aria-hidden="true" className="size-4" />
                    {t("remove")}
                  </Button>
                </div>
                <div className="grid gap-3 md:grid-cols-2">
                  <Field label={t("planName")} required>
                    <TextInput
                      name={`plan.${index}.name`}
                      required
                      defaultValue={plan.name}
                    />
                  </Field>
                  <Field label={t("priceLabel")} required>
                    <TextInput
                      name={`plan.${index}.priceLabel`}
                      required
                      defaultValue={plan.priceLabel}
                    />
                  </Field>
                  <Field label={t("ctaLabel")} required>
                    <TextInput
                      name={`plan.${index}.ctaLabel`}
                      required
                      defaultValue={plan.ctaLabel}
                    />
                  </Field>
                  <Field label={t("highlighted")} required>
                    <SelectInput
                      defaultValue={String(Boolean(plan.highlighted))}
                      name={`plan.${index}.highlighted`}
                      required
                    >
                      <option value="true">{t("highlighted")}</option>
                      <option value="false">{t("standard")}</option>
                    </SelectInput>
                  </Field>
                  <Field
                    className="md:col-span-2"
                    label={t("description")}
                    required
                  >
                    <Textarea
                      name={`plan.${index}.description`}
                      required
                      defaultValue={plan.description}
                    />
                  </Field>
                  <Field
                    className="md:col-span-2"
                    label={t("features")}
                    description={t("oneFeaturePerLine")}
                    required
                  >
                    <Textarea
                      name={`plan.${index}.features`}
                      required
                      defaultValue={plan.features.join("\n")}
                    />
                  </Field>
                </div>
              </div>
            ))}
          </div>
          <Button type="submit">{t("savePricingPlans")}</Button>
        </form>
      </CardContent>
    </Card>
  );
}
