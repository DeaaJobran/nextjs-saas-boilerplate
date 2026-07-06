import { appConfig } from "@nextjs-saas/config/app";
import { Badge, Card, CardContent, CardHeader, CardTitle } from "@nextjs-saas/ui";

const documentationSections = [
  {
    title: "Setup",
    body: "Local development uses pnpm, Docker Compose services, database migrations, and managed content seed data.",
  },
  {
    title: "Architecture",
    body: "The current foundation includes web, docs, auth, config, database, jobs, localization, tenant, and UI packages.",
  },
  {
    title: "Upgrade notes",
    body: "Release tags and changelog entries document foundation milestones and downstream upgrade expectations.",
  },
];

export default function DocsHome() {
  return (
    <main className="mx-auto grid min-h-dvh w-full max-w-5xl gap-8 px-4 py-12 sm:px-6 lg:px-8">
      <section className="space-y-4">
        <Badge variant="outline">v0.3.0 docs</Badge>
        <h1 className="text-4xl font-semibold tracking-tight">
          {appConfig.name} documentation
        </h1>
        <p className="max-w-2xl text-lg text-muted-foreground">
          Public setup guides, module references, and upgrade notes live here
          as tracked project documentation.
        </p>
      </section>
      <div className="grid gap-4 md:grid-cols-3">
        {documentationSections.map((section) => (
          <Card key={section.title}>
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
