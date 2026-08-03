import { appConfig } from "@nextjs-saas/config/app";
import { Badge, Card, CardContent, CardHeader, CardTitle } from "@nextjs-saas/ui";

import { getDocsHomeContent } from "../content";

export default function DocsHome() {
  const content = getDocsHomeContent();

  return (
    <main className="mx-auto grid min-h-dvh w-full max-w-5xl gap-8 px-4 py-12 sm:px-6 lg:px-8">
      <section className="space-y-4">
        <Badge variant="outline">{content.badge}</Badge>
        <h1 className="text-4xl font-semibold tracking-tight">
          {appConfig.name} {content.title}
        </h1>
        <p className="max-w-2xl text-lg text-muted-foreground">
          {content.description}
        </p>
      </section>
      <div className="grid gap-4 md:grid-cols-2">
        {content.sections.map((section) => (
          <Card key={section.key}>
            <CardHeader>
              <CardTitle>{section.title}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                {section.body}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>
    </main>
  );
}
