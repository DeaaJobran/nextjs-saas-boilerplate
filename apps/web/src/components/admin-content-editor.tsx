"use client";

import {
  type ContactField,
  type ContactRouting,
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
  Textarea,
  TextInput,
} from "@nextjs-saas/ui";
import { PlusIcon, SaveIcon, Trash2Icon } from "lucide-react";
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

function selectClassName() {
  return "bg-background focus-visible:ring-ring min-h-11 w-full rounded-md border px-3 py-2 text-base shadow-sm outline-none focus-visible:ring-2 disabled:cursor-not-allowed disabled:opacity-50";
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
  const [sections, setSections] = React.useState<PageSection[]>(
    page.sections.length > 0 ? page.sections : [createEmptySection()],
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle>Edit managed page</CardTitle>
        <CardDescription>
          Updates are written to the active content store and immediately
          revalidated for the public route.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form
          action={action}
          aria-label="Edit managed page"
          className="grid gap-6"
        >
          <input name="adminLocale" type="hidden" value={adminLocale} />
          <input name="id" type="hidden" value={page.id} />
          <input name="sectionCount" type="hidden" value={sections.length} />
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Title" required>
              <TextInput name="title" required defaultValue={page.title} />
            </Field>
            <Field label="Slug" required>
              <TextInput name="slug" required defaultValue={page.slug} />
            </Field>
            <Field label="Publish state" required>
              <select
                className={selectClassName()}
                defaultValue={page.publishState}
                name="publishState"
                required
              >
                {publishStates.map((state) => (
                  <option key={state} value={state}>
                    {state}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Content version">
              <TextInput name="version" defaultValue={page.version} />
            </Field>
            <Field label="Description" required>
              <TextInput
                name="description"
                required
                defaultValue={page.description}
              />
            </Field>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="SEO title" required>
              <TextInput
                name="seoTitle"
                required
                defaultValue={page.seo.title}
              />
            </Field>
            <Field label="Open Graph image">
              <TextInput name="ogImage" defaultValue={page.seo.ogImage} />
            </Field>
            <Field className="md:col-span-2" label="SEO description" required>
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
                <h3 className="text-base font-semibold">Sections</h3>
                <p className="text-muted-foreground text-sm">
                  Add, remove, and reorder content blocks through structured
                  fields.
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
                Add section
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
                  <h4 className="font-medium">Section {index + 1}</h4>
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
                    Remove
                  </Button>
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  <Field label="Eyebrow">
                    <TextInput
                      name={`section.${index}.eyebrow`}
                      defaultValue={section.eyebrow}
                    />
                  </Field>
                  <Field label="Section title" required>
                    <TextInput
                      name={`section.${index}.title`}
                      required
                      defaultValue={section.title}
                    />
                  </Field>
                  <Field
                    className="md:col-span-2"
                    label="Section body"
                    required
                  >
                    <Textarea
                      name={`section.${index}.body`}
                      required
                      defaultValue={section.body}
                    />
                  </Field>
                  <Field label="CTA label">
                    <TextInput
                      name={`section.${index}.ctaLabel`}
                      defaultValue={section.cta?.label}
                    />
                  </Field>
                  <Field label="CTA href">
                    <TextInput
                      name={`section.${index}.ctaHref`}
                      defaultValue={section.cta?.href}
                    />
                  </Field>
                  <Field
                    className="md:col-span-2"
                    label="Items"
                    description="One item per line."
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
              Save page
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
  return (
    <Card>
      <CardHeader>
        <CardTitle>Create managed page</CardTitle>
        <CardDescription>
          Adds a new localized page record to the same content system used by
          the public routes.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form
          action={action}
          aria-label="Create managed page"
          className="grid gap-4"
        >
          <input name="adminLocale" type="hidden" value={adminLocale} />
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Locale" required>
              <select className={selectClassName()} name="locale" required>
                {locales.map((locale) => (
                  <option key={locale} value={locale}>
                    {localeLabels[locale]}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Type" required>
              <select className={selectClassName()} name="kind" required>
                {pageKinds.map((kind) => (
                  <option key={kind} value={kind}>
                    {kind}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Publish state" required>
              <select
                className={selectClassName()}
                defaultValue="draft"
                name="publishState"
                required
              >
                {publishStates.map((state) => (
                  <option key={state} value={state}>
                    {state}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Content version">
              <TextInput name="version" />
            </Field>
            <Field label="Slug" required>
              <TextInput name="slug" required />
            </Field>
            <Field label="Title" required>
              <TextInput name="title" required />
            </Field>
            <Field label="Description" required>
              <TextInput name="description" required />
            </Field>
            <Field
              className="md:col-span-2"
              label="First section body"
              required
            >
              <Textarea name="body" required />
            </Field>
          </div>
          <div className="flex justify-end">
            <Button type="submit">
              <PlusIcon aria-hidden="true" className="size-4" />
              Create page
            </Button>
          </div>
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
  const [contactFields, setContactFields] = React.useState<ContactField[]>(
    fields.length > 0 ? fields : [createEmptyContactField()],
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle>Contact settings</CardTitle>
        <CardDescription>
          Configure field labels, validation limits, recipient routing, and spam
          protection for the selected locale.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form
          action={action}
          aria-label="Contact settings"
          className="grid gap-4"
        >
          <input name="adminLocale" type="hidden" value={adminLocale} />
          <input name="locale" type="hidden" value={locale} />
          <input name="fieldCount" type="hidden" value={contactFields.length} />
          <div className="bg-muted/40 rounded-md border px-3 py-2 text-sm">
            Editing contact settings for {localeLabels[locale]}.
          </div>
          <div className="grid gap-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h3 className="text-base font-semibold">Fields</h3>
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
                Add field
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
                  <h4 className="font-medium">Field {index + 1}</h4>
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
                    Remove
                  </Button>
                </div>
                <div className="grid gap-3 md:grid-cols-2">
                  <Field label="Label" required>
                    <TextInput
                      name={`field.${index}.label`}
                      required
                      defaultValue={field.label}
                    />
                  </Field>
                  <Field label="Type" required>
                    <select
                      className={selectClassName()}
                      defaultValue={field.type}
                      name={`field.${index}.type`}
                      required
                    >
                      <option value="text">text</option>
                      <option value="email">email</option>
                      <option value="textarea">textarea</option>
                    </select>
                  </Field>
                  <Field label="Required" required>
                    <select
                      className={selectClassName()}
                      defaultValue={String(field.required)}
                      name={`field.${index}.required`}
                      required
                    >
                      <option value="true">Required</option>
                      <option value="false">Optional</option>
                    </select>
                  </Field>
                  <Field label="Minimum length">
                    <TextInput
                      min={0}
                      name={`field.${index}.minLength`}
                      type="number"
                      defaultValue={field.minLength}
                    />
                  </Field>
                  <Field label="Maximum length">
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
          <Field label="Recipient email" required>
            <TextInput
              name="recipientEmail"
              required
              type="email"
              defaultValue={routing.recipientEmail}
            />
          </Field>
          <Field label="Subject prefix" required>
            <TextInput
              name="subjectPrefix"
              required
              defaultValue={routing.subjectPrefix}
            />
          </Field>
          <Field label="Success message" required>
            <TextInput
              name="successMessage"
              required
              defaultValue={routing.successMessage}
            />
          </Field>
          <Field label="Spam protection" required>
            <select
              className={selectClassName()}
              defaultValue={String(routing.spamProtectionEnabled)}
              name="spamProtectionEnabled"
              required
            >
              <option value="true">Enabled</option>
              <option value="false">Disabled</option>
            </select>
          </Field>
          <Button type="submit">Save contact settings</Button>
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
  const [pricingPlans, setPricingPlans] = React.useState<PricingPlan[]>(
    plans.length > 0 ? plans : [createEmptyPricingPlan()],
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle>Pricing plans</CardTitle>
        <CardDescription>
          Manage localized plan presentation while billing adapters own payment
          provider behavior.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form action={action} aria-label="Pricing plans" className="grid gap-4">
          <input name="adminLocale" type="hidden" value={adminLocale} />
          <input name="locale" type="hidden" value={locale} />
          <input name="planCount" type="hidden" value={pricingPlans.length} />
          <div className="bg-muted/40 rounded-md border px-3 py-2 text-sm">
            Editing pricing plans for {localeLabels[locale]}.
          </div>
          <div className="grid gap-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h3 className="text-base font-semibold">Plans</h3>
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
                Add plan
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
                  <h4 className="font-medium">Plan {index + 1}</h4>
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
                    Remove
                  </Button>
                </div>
                <div className="grid gap-3 md:grid-cols-2">
                  <Field label="Plan name" required>
                    <TextInput
                      name={`plan.${index}.name`}
                      required
                      defaultValue={plan.name}
                    />
                  </Field>
                  <Field label="Price label" required>
                    <TextInput
                      name={`plan.${index}.priceLabel`}
                      required
                      defaultValue={plan.priceLabel}
                    />
                  </Field>
                  <Field label="CTA label" required>
                    <TextInput
                      name={`plan.${index}.ctaLabel`}
                      required
                      defaultValue={plan.ctaLabel}
                    />
                  </Field>
                  <Field label="Highlighted" required>
                    <select
                      className={selectClassName()}
                      defaultValue={String(Boolean(plan.highlighted))}
                      name={`plan.${index}.highlighted`}
                      required
                    >
                      <option value="true">Highlighted</option>
                      <option value="false">Standard</option>
                    </select>
                  </Field>
                  <Field className="md:col-span-2" label="Description" required>
                    <Textarea
                      name={`plan.${index}.description`}
                      required
                      defaultValue={plan.description}
                    />
                  </Field>
                  <Field
                    className="md:col-span-2"
                    label="Features"
                    description="One feature per line."
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
          <Button type="submit">Save pricing plans</Button>
        </form>
      </CardContent>
    </Card>
  );
}
