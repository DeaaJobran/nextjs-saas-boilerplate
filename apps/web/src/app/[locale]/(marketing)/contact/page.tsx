import { createContentRepository } from "@nextjs-saas/config/content";
import { createPageMetadata } from "@nextjs-saas/config/seo";
import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Field,
  Textarea,
  TextInput,
} from "@nextjs-saas/ui";
import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { assertLocale } from "../../../../lib/locale";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale: value } = await params;
  const locale = assertLocale(value);
  const page = createContentRepository().getPage({ kind: "contact", locale });

  if (!page) {
    notFound();
  }

  return createPageMetadata(page.seo);
}

export default async function ContactPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale: value } = await params;
  const locale = assertLocale(value);
  const repository = createContentRepository();
  const page = repository.getPage({ kind: "contact", locale });

  if (!page) {
    notFound();
  }

  return (
    <main className="mx-auto grid w-full max-w-5xl gap-8 px-4 py-12 sm:px-6 lg:grid-cols-[0.9fr_1.1fr] lg:px-8">
      <section className="space-y-4">
        <p className="text-primary text-sm font-medium">Managed contact</p>
        <h1 className="text-4xl font-semibold tracking-tight">{page.title}</h1>
        <p className="text-muted-foreground text-lg">{page.description}</p>
      </section>
      <Card>
        <CardHeader>
          <CardTitle>{page.sections[0]?.title}</CardTitle>
        </CardHeader>
        <CardContent>
          <form className="grid gap-4">
            {/* TODO: Submit through the validated notification workflow once email delivery and spam protection exist. */}
            {repository.listContactFields(locale).map((field) => (
              <Field
                key={field.id}
                label={field.label}
                required={field.required}
              >
                {field.type === "textarea" ? (
                  <Textarea name={field.id} required={field.required} />
                ) : (
                  <TextInput
                    name={field.id}
                    required={field.required}
                    type={field.type}
                  />
                )}
              </Field>
            ))}
            <Button type="submit">Submit</Button>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}
